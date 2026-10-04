/**
 * IndexedDB Repository Implementations for WardWit
 */

import { getDatabase, deleteLocalDatabase } from './db';
import type {
  IQuestionRepository,
  ISessionRepository,
  IProfileRepository,
  ISettingsRepository,
  IDailyActivityRepository,
  IReviewQueueRepository,
  IErrorNotebookRepository,
  IFlashcardRepository,
  IQuestionReportRepository,
  IAchievementRepository,
  IDiscoverCardRepository,
  BackupData,
  FinalizeSessionResult,
} from './repositories';
import type {
  Question,
  QuestionOption,
  QuestionImageMetadata,
  StudySession,
  UserProfile,
  UserSettings,
  DailyActivityRecord,
  ReviewQueueItem,
  ReviewItemReason,
  ErrorNotebookEntry,
  Flashcard,
  QuestionReport,
  DiscoverCard,
  SaveToReviewResult,
  QuestionUserAnswer,
} from '../domain/types';
import { finalizeSession } from '../domain/scoring';
import { recordReviewAttempt, createReviewQueueItem, REVIEW_INTERVAL_DAYS } from '../domain/spacedReview';
import { sanitizeEducationalMedia, migrateLegacyImageMetadata } from '../domain/mediaSanitizer';
import { getKarachiDayKey } from '../domain/studyDay';
import {
  canonicalizeQuestionId,
  recordQualifyingItem,
  recordQualifyingBatch,
} from '../domain/dailyHabit';

// Sanitize untrusted imported text: strip dangerous tags and script patterns
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+=["'][^"']*["']/gi, '')
    .replace(/javascript:[^"'\s]*/gi, '');
}

export class IndexedDBQuestionRepository implements IQuestionRepository {
  async getAll(): Promise<Question[]> {
    const db = await getDatabase();
    return db.getAll('questions');
  }

  async getApproved(): Promise<Question[]> {
    const all = await this.getAll();
    return all.filter((q) => q.editorialStatus === 'approved');
  }

  async getById(id: string): Promise<Question | undefined> {
    const db = await getDatabase();
    return db.get('questions', id);
  }

  async save(question: Question): Promise<void> {
    const db = await getDatabase();
    await db.put('questions', question);
  }

  async saveBatch(questions: Question[]): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('questions', 'readwrite');
    for (const q of questions) {
      await tx.store.put(q);
    }
    await tx.done;
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('questions', id);
  }
}

export class IndexedDBSessionRepository implements ISessionRepository {
  async getAll(): Promise<StudySession[]> {
    const db = await getDatabase();
    return db.getAllFromIndex('sessions', 'by-created-at');
  }

  async getById(id: string): Promise<StudySession | undefined> {
    const db = await getDatabase();
    return db.get('sessions', id);
  }

  async getActiveSession(): Promise<StudySession | undefined> {
    const db = await getDatabase();
    const sessions = await db.getAllFromIndex('sessions', 'by-status', 'in-progress');
    return sessions.sort((a, b) => b.startedAt - a.startedAt)[0];
  }

  async save(session: StudySession): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('sessions', 'readwrite');
    const existing = await tx.store.get(session.id);
    if (existing && existing.status === 'completed' && session.status !== 'completed') {
      // Late autosave protection: reject overwriting a completed session with in-progress state
      await tx.done;
      return;
    }
    await tx.store.put(session);
    await tx.done;
  }

  async finalizeSessionTransaction(
    sessionToFinish: StudySession,
    todayStr: string,
    now = Date.now()
  ): Promise<FinalizeSessionResult> {
    const db = await getDatabase();
    const tx = db.transaction(['sessions', 'dailyActivity', 'reviewQueue'], 'readwrite');

    try {
      const sessionStore = tx.objectStore('sessions');
      const persisted = await sessionStore.get(sessionToFinish.id);

      // Completed sessions must not be completed twice, even when callers hold stale in-progress objects
      if (persisted && persisted.status === 'completed') {
        await tx.done;
        return {
          success: true,
          alreadyCompleted: true,
          session: persisted,
        };
      }

      // Authoritative finalization
      const finalized = finalizeSession(sessionToFinish, now);
      await sessionStore.put(finalized);

      // Commit activity credit together with session completion
      const activeDayKey = todayStr || getKarachiDayKey(now);
      const actStore = tx.objectStore('dailyActivity');
      const existingAct = (await actStore.get(activeDayKey)) || {
        date: activeDayKey,
        questionsAnswered: 0,
        correctCount: 0,
        sessionsCompleted: 0,
        flashcardsReviewed: 0,
      };

      const answeredCount = finalized.score?.correctCount !== undefined
        ? (finalized.score.correctCount + finalized.score.incorrectCount)
        : 0;
      const correctCount = finalized.score?.correctCount || 0;

      // Collect distinct canonical question IDs for questions answered in this session block
      const answeredCanonicalIds: string[] = [];
      for (const q of finalized.questionSnapshots) {
        const ans = finalized.answers[q.id];
        if (!ans) continue;
        const chosen = ans.firstSubmittedOptionId ?? ans.selectedOptionId;
        if (chosen) {
          answeredCanonicalIds.push(canonicalizeQuestionId(q.id));
        }
      }

      const batchResult = recordQualifyingBatch(
        existingAct,
        activeDayKey,
        answeredCanonicalIds,
        {
          questionsAnswered: answeredCount,
          correctCount: correctCount,
          sessionsCompleted: 1,
          flashcardsReviewed: 0,
        },
        now
      );
      const updatedActivity = batchResult.record;
      await actStore.put(updatedActivity);

      // Commit review changes together
      const rqStore = tx.objectStore('reviewQueue');
      const updatedReviewItems: ReviewQueueItem[] = [];
      const newReviewItems: ReviewQueueItem[] = [];

      for (const q of finalized.questionSnapshots) {
        const ans = finalized.answers[q.id];
        if (!ans) continue;
        const chosen = ans.firstSubmittedOptionId ?? ans.selectedOptionId;
        if (!chosen) continue;

        const isCorrect = chosen === q.correctOptionId;
        const mapping = finalized.reviewMappings?.[q.id];

        if (mapping && mapping.originatingItemIds && mapping.originatingItemIds.length > 0) {
          // Advance/reset mapped original item(s) exactly once
          for (const origId of mapping.originatingItemIds) {
            const origItem = await rqStore.get(origId);
            if (origItem && origItem.status === 'pending') {
              const updatedItem = recordReviewAttempt(origItem, isCorrect, ans.confidence, now);
              await rqStore.put(updatedItem);
              updatedReviewItems.push(updatedItem);
            }
          }
          // Do not create extra pending item for the mapped review attempt
        } else {
          // Regular practice question
          if (!isCorrect || ans.confidence === 'guessed' || ans.confidence === 'unsure') {
            const reason: ReviewItemReason = !isCorrect
              ? 'incorrect'
              : ans.confidence === 'guessed'
              ? 'guessed'
              : 'unsure';
            const qIndex = rqStore.index('by-question-id');
            const existingForQ = await qIndex.getAll(q.id);
            const existingPending = existingForQ.find((item) => item.status === 'pending');

            if (existingPending) {
              const updatedItem: ReviewQueueItem = {
                ...existingPending,
                reason,
                dueAt: now + REVIEW_INTERVAL_DAYS[0] * 24 * 60 * 60 * 1000,
                intervalDays: REVIEW_INTERVAL_DAYS[0],
                reviewCount: 0,
              };
              await rqStore.put(updatedItem);
              updatedReviewItems.push(updatedItem);
            } else {
              const newItem = createReviewQueueItem(q.id, q.conceptId, reason, now);
              await rqStore.put(newItem);
              newReviewItems.push(newItem);
            }
          }
        }
      }

      await tx.done;

      return {
        success: true,
        alreadyCompleted: false,
        session: finalized,
        updatedActivity,
        updatedReviewItems,
        newReviewItems,
        justQualified: batchResult.justQualified,
      };
    } catch (err) {
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('sessions', id);
  }
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'default-profile',
  displayName: 'Doctor-in-Training',
  mbbsYear: 'Year 3',
  college: '',
  targetExamDate: '',
  preferredStudyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  dailyQuestionGoal: 10,
  onboardingCompleted: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export class IndexedDBProfileRepository implements IProfileRepository {
  async getProfile(): Promise<UserProfile | null> {
    const db = await getDatabase();
    const profile = await db.get('profiles', 'default-profile');
    return profile || null;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const db = await getDatabase();
    await db.put('profiles', { ...profile, id: 'default-profile', updatedAt: Date.now() });
  }
}

export const DEFAULT_SETTINGS: UserSettings = {
  quietMode: false,
  theme: 'warm-ivory',
  fontSize: 'normal',
  soundEffects: false,
  reviewScheduling: {
    includeUnsureGuessed: true,
    intervalStepDays: [1, 3, 7, 14],
  },
};

export class IndexedDBSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<UserSettings> {
    const db = await getDatabase();
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const settings = await (store as any).get('app-settings');
    return settings || DEFAULT_SETTINGS;
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    await (store as any).put(settings, 'app-settings');
    await tx.done;
  }
}

export class IndexedDBDailyActivityRepository implements IDailyActivityRepository {
  async getAll(): Promise<DailyActivityRecord[]> {
    const db = await getDatabase();
    const all = await db.getAll('dailyActivity');
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }

  async getActivityForDate(dateStr: string): Promise<DailyActivityRecord | null> {
    const db = await getDatabase();
    const record = await db.get('dailyActivity', dateStr);
    return record || null;
  }

  async recordActivity(
    dateStr: string,
    questionsDelta: number,
    correctDelta: number,
    sessionCompleted: boolean,
    flashcardsReviewedDelta = 0
  ): Promise<DailyActivityRecord> {
    const db = await getDatabase();
    const existing = (await db.get('dailyActivity', dateStr)) || {
      date: dateStr,
      questionsAnswered: 0,
      correctCount: 0,
      sessionsCompleted: 0,
      flashcardsReviewed: 0,
    };

    const updated: DailyActivityRecord = {
      ...existing,
      date: dateStr,
      questionsAnswered: Math.max(0, existing.questionsAnswered + questionsDelta),
      correctCount: Math.max(0, existing.correctCount + correctDelta),
      sessionsCompleted: existing.sessionsCompleted + (sessionCompleted ? 1 : 0),
      flashcardsReviewed: Math.max(0, (existing.flashcardsReviewed || 0) + flashcardsReviewedDelta),
    };

    await db.put('dailyActivity', updated);
    return updated;
  }

  async recordQualifyingAction(
    dateStr: string,
    canonicalItemId: string,
    statsDelta?: {
      questionsAnswered?: number;
      correctCount?: number;
      sessionsCompleted?: number;
      flashcardsReviewed?: number;
    },
    now = Date.now()
  ): Promise<{ record: DailyActivityRecord; wasNewAction: boolean; justQualified: boolean }> {
    const db = await getDatabase();
    const existing = await db.get('dailyActivity', dateStr);
    const result = recordQualifyingItem(existing || null, dateStr, canonicalItemId, statsDelta, now);
    await db.put('dailyActivity', result.record);
    return result;
  }

  async getRecentActivity(days = 30): Promise<DailyActivityRecord[]> {
    const db = await getDatabase();
    const all = await db.getAll('dailyActivity');
    return all.sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  }
}

export class IndexedDBReviewQueueRepository implements IReviewQueueRepository {
  async getAll(): Promise<ReviewQueueItem[]> {
    const db = await getDatabase();
    return db.getAll('reviewQueue');
  }

  async getDue(now = Date.now()): Promise<ReviewQueueItem[]> {
    const all = await this.getAll();
    return all.filter((i) => i.status === 'pending' && i.dueAt <= now);
  }

  async save(item: ReviewQueueItem): Promise<void> {
    const db = await getDatabase();
    await db.put('reviewQueue', item);
  }

  async saveBatch(items: ReviewQueueItem[]): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('reviewQueue', 'readwrite');
    for (const item of items) {
      await tx.store.put(item);
    }
    await tx.done;
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('reviewQueue', id);
  }
}

export class IndexedDBErrorNotebookRepository implements IErrorNotebookRepository {
  async getAll(): Promise<ErrorNotebookEntry[]> {
    const db = await getDatabase();
    const all = await db.getAll('errorNotebook');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getById(id: string): Promise<ErrorNotebookEntry | undefined> {
    const db = await getDatabase();
    return db.get('errorNotebook', id);
  }

  async getByQuestionId(questionId: string): Promise<ErrorNotebookEntry[]> {
    const db = await getDatabase();
    return db.getAllFromIndex('errorNotebook', 'by-question-id', questionId);
  }

  async save(entry: ErrorNotebookEntry): Promise<void> {
    const db = await getDatabase();
    await db.put('errorNotebook', entry);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('errorNotebook', id);
  }
}

export class IndexedDBFlashcardRepository implements IFlashcardRepository {
  async getAll(): Promise<Flashcard[]> {
    const db = await getDatabase();
    const all = await db.getAll('flashcards');
    return all.sort((a, b) => a.dueAt - b.dueAt);
  }

  async getById(id: string): Promise<Flashcard | undefined> {
    const db = await getDatabase();
    return db.get('flashcards', id);
  }

  async getDue(now = Date.now()): Promise<Flashcard[]> {
    const all = await this.getAll();
    return all.filter((c) => c.dueAt <= now);
  }

  async save(card: Flashcard): Promise<void> {
    const db = await getDatabase();
    await db.put('flashcards', card);
  }

  async saveBatch(cards: Flashcard[]): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('flashcards', 'readwrite');
    for (const c of cards) {
      await tx.store.put(c);
    }
    await tx.done;
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('flashcards', id);
  }
}

export class IndexedDBQuestionReportRepository implements IQuestionReportRepository {
  async getAll(): Promise<QuestionReport[]> {
    const db = await getDatabase();
    const all = await db.getAll('questionReports');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async save(report: QuestionReport): Promise<void> {
    const db = await getDatabase();
    await db.put('questionReports', report);
  }

  async markResolved(id: string, note?: string): Promise<void> {
    const db = await getDatabase();
    const rep = await db.get('questionReports', id);
    if (rep) {
      rep.resolved = true;
      rep.resolvedAt = Date.now();
      rep.resolutionNote = note || 'Reviewed and addressed.';
      await db.put('questionReports', rep);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('questionReports', id);
  }
}

export class IndexedDBAchievementRepository implements IAchievementRepository {
  async getEarned(): Promise<Record<string, number>> {
    const db = await getDatabase();
    const list = await db.getAll('achievements');
    const map: Record<string, number> = {};
    for (const item of list) {
      map[item.id] = item.earnedAt;
    }
    return map;
  }

  async saveEarned(earnedMap: Record<string, number>): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction('achievements', 'readwrite');
    for (const [id, earnedAt] of Object.entries(earnedMap)) {
      await tx.store.put({ id, earnedAt });
    }
    await tx.done;
  }
}

export class IndexedDBDiscoverCardRepository implements IDiscoverCardRepository {
  async getAll(): Promise<DiscoverCard[]> {
    const db = await getDatabase();
    return db.getAll('discoverCards');
  }

  async getApproved(): Promise<DiscoverCard[]> {
    const db = await getDatabase();
    return db.getAllFromIndex('discoverCards', 'by-editorial-status', 'approved');
  }

  async getById(id: string): Promise<DiscoverCard | undefined> {
    const db = await getDatabase();
    return db.get('discoverCards', id);
  }

  async save(card: DiscoverCard): Promise<void> {
    const db = await getDatabase();
    await db.put('discoverCards', card);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('discoverCards', id);
  }
}

// Singletons
export const questionRepo = new IndexedDBQuestionRepository();
export const sessionRepo = new IndexedDBSessionRepository();
export const profileRepo = new IndexedDBProfileRepository();
export const settingsRepo = new IndexedDBSettingsRepository();
export const dailyActivityRepo = new IndexedDBDailyActivityRepository();
export const reviewQueueRepo = new IndexedDBReviewQueueRepository();
export const errorNotebookRepo = new IndexedDBErrorNotebookRepository();
export const flashcardRepo = new IndexedDBFlashcardRepository();
export const questionReportRepo = new IndexedDBQuestionReportRepository();
export const achievementRepo = new IndexedDBAchievementRepository();
export const discoverCardRepo = new IndexedDBDiscoverCardRepository();

/**
 * Idempotently saves a question concept to the student's review collection.
 * Retains versioned question snapshot, original prompt/options, submitted answer,
 * authored explanation, and source metadata.
 * Returns honest feedback: saved vs already_saved vs error.
 */
export async function saveQuestionToReview(
  question: Question,
  answer?: QuestionUserAnswer
): Promise<SaveToReviewResult> {
  try {
    const db = await getDatabase();
    const allCards = await db.getAll('flashcards');

    // Idempotent check by (sourceQuestionId, sourceQuestionVersion)
    const existing = allCards.find(
      (c) => c.sourceQuestionId === question.id && c.sourceQuestionVersion === question.version
    );
    if (existing) {
      return {
        status: 'already_saved',
        message: `"${question.topic}" is already in your Review deck.`,
        card: existing,
      };
    }

    const now = Date.now();
    // Deep clone question to preserve snapshot
    const questionSnapshot: Question = JSON.parse(JSON.stringify(question));

    const newCard: Flashcard = {
      id: `fc-q-${question.id}-v${question.version}-${now}`,
      front: question.vignette,
      back: question.explanation,
      sourceQuestionId: question.id,
      sourceQuestionVersion: question.version,
      questionSnapshot,
      submittedOptionId: answer?.selectedOptionId || null,
      confidence: answer?.confidence,
      cardKind: 'question_derived',
      topic: question.topic,
      intervalDays: 1,
      dueAt: now,
      repetitions: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.put('flashcards', newCard);

    // Also ensure reviewQueue has a pending record so review queue metrics stay in sync
    const existingQueue = await db.getAllFromIndex('reviewQueue', 'by-question-id', question.id);
    const hasPending = existingQueue.some((item) => item.status === 'pending');
    if (!hasPending) {
      const rqItem: ReviewQueueItem = {
        id: `rev-saved-${question.id}-${now}`,
        questionId: question.id,
        conceptId: question.conceptId,
        reason: 'incorrect',
        addedAt: now,
        dueAt: now,
        intervalDays: 1,
        reviewCount: 0,
        status: 'pending',
      };
      await db.put('reviewQueue', rqItem);
    }

    return {
      status: 'saved',
      message: `Saved "${question.topic}" to Review deck.`,
      card: newCard,
    };
  } catch (err: any) {
    return {
      status: 'error',
      message: `Failed to save to Review: ${err.message || 'Storage error'}`,
    };
  }
}

/**
 * Idempotently saves a Discover concept card to the student's review collection.
 * Preserves stable ID/version, curiosity prompt, concept explanation, and diagrams.
 * Returns honest feedback: saved vs already_saved vs error.
 */
export async function saveDiscoverCardToReview(
  discoverCard: DiscoverCard
): Promise<SaveToReviewResult> {
  try {
    const db = await getDatabase();
    const allCards = await db.getAll('flashcards');

    // Idempotent check by (sourceDiscoverCardId, sourceDiscoverVersion)
    const existing = allCards.find(
      (c) => c.sourceDiscoverCardId === discoverCard.id && c.sourceDiscoverVersion === discoverCard.version
    );
    if (existing) {
      return {
        status: 'already_saved',
        message: `"${discoverCard.revealedConcept}" is already in your Review deck.`,
        card: existing,
      };
    }

    const now = Date.now();
    const discoverSnapshot: DiscoverCard = JSON.parse(JSON.stringify(discoverCard));

    const newCard: Flashcard = {
      id: `fc-disc-${discoverCard.id}-v${discoverCard.version}-${now}`,
      front: discoverCard.curiosityPrompt,
      back: `${discoverCard.revealedConcept}\n\n${discoverCard.conciseExplanation}\n\nWhy it matters: ${discoverCard.whyItMatters}`,
      sourceDiscoverCardId: discoverCard.id,
      sourceDiscoverVersion: discoverCard.version,
      discoverSnapshot,
      cardKind: 'discover_derived',
      topic: discoverCard.curriculumMapping.topic,
      intervalDays: 1,
      dueAt: now,
      repetitions: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.put('flashcards', newCard);

    return {
      status: 'saved',
      message: `Saved "${discoverCard.revealedConcept}" to Review deck.`,
      card: newCard,
    };
  } catch (err: any) {
    return {
      status: 'error',
      message: `Failed to save to Review: ${err.message || 'Storage error'}`,
    };
  }
}

/**
 * Validation for an educational or demo question before it can be marked approved.
 */
export function validateQuestionForApproval(q: Partial<Question>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!q.id || typeof q.id !== 'string' || !q.id.trim()) {
    errors.push('Stable Question ID is required.');
  }
  if (!q.vignette || typeof q.vignette !== 'string' || q.vignette.trim().length < 15) {
    errors.push('Vignette / Scenario prompt must be at least 15 characters.');
  }
  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push('At least 2 answer options are required.');
  }
  
  if (Array.isArray(q.options)) {
    for (const opt of q.options) {
      if (!opt.id || !opt.text || !opt.text.trim()) {
        errors.push(`Option ${opt.id || '?'} text cannot be blank.`);
      }
    }
    const optionIds = q.options.map((o) => o.id);
    if (!q.correctOptionId || !optionIds.includes(q.correctOptionId)) {
      errors.push(`Correct Option ID must match one of the available options (${optionIds.join(', ')}).`);
    }
  } else if (!q.correctOptionId) {
    errors.push('Correct Option ID is required.');
  }
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 10) {
    errors.push('Comprehensive explanation must be at least 10 characters.');
  }
  if (!q.learningObjective || typeof q.learningObjective !== 'string' || !q.learningObjective.trim()) {
    errors.push('Learning objective cannot be empty.');
  }
  if (!q.system || !q.system.trim()) {
    errors.push('Medical system taxonomy is required.');
  }
  if (!q.discipline || !q.discipline.trim()) {
    errors.push('Discipline taxonomy is required.');
  }
  if (!q.topic || !q.topic.trim()) {
    errors.push('Topic taxonomy is required.');
  }
  if (q.contentKind === 'educational') {
    if (!q.reviewer?.name || typeof q.reviewer.name !== 'string' || !q.reviewer.name.trim()) {
      errors.push('Educational questions require a named reviewer before approval.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface DryRunRowResult {
  rowNumber: number;
  id: string;
  topic: string;
  isValid: boolean;
  isUpdate: boolean;
  errors: string[];
}

export interface DryRunImportSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicatesInFile: string[];
  proposedUpdates: string[];
  proposedInserts: string[];
  rowResults: DryRunRowResult[];
  cleanQuestions: Question[];
}

/**
 * Dry-run import parser: does NOT write to database.
 * Parses, sanitizes untrusted input, checks duplicates, validates required fields.
 * Handles null JSON, null records, invalid option arrays, and duplicate IDs with clear errors.
 * Preserves supported imageMetadata.
 */
export function dryRunImportQuestions(
  jsonString: string,
  existingQuestions: Question[]
): { success: boolean; error?: string; summary?: DryRunImportSummary } {
  if (jsonString === null || jsonString === undefined || typeof jsonString !== 'string' || !jsonString.trim()) {
    return { success: false, error: 'Input is empty or not a valid JSON string.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return { success: false, error: `JSON Parse Error: ${err.message}` };
  }

  if (parsed === null || typeof parsed !== 'object') {
    return { success: false, error: 'Invalid format: JSON payload must be an object or an array.' };
  }

  const items = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(items)) {
    return {
      success: false,
      error: 'Invalid format: Expected a JSON array of questions or an object with a "questions" array.',
    };
  }

  const existingMap = new Map<string, Question>(existingQuestions.map((q) => [q.id, q]));
  const seenIdsInFile = new Set<string>();
  const duplicateIdsInFile: string[] = [];

  const rowResults: DryRunRowResult[] = [];
  const cleanQuestions: Question[] = [];
  const proposedUpdates: string[] = [];
  const proposedInserts: string[] = [];

  items.forEach((item, index) => {
    const rowNumber = index + 1;
    if (item === null || typeof item !== 'object') {
      rowResults.push({
        rowNumber,
        id: `(Row ${rowNumber})`,
        topic: 'Invalid Record',
        isValid: false,
        isUpdate: false,
        errors: ['Record is null or not a valid JSON object.'],
      });
      return;
    }

    const rawId = sanitizeText(item.id);
    const rowErrors: string[] = [];

    if (!rawId) {
      rowErrors.push('Question ID is missing or empty.');
    } else if (seenIdsInFile.has(rawId)) {
      duplicateIdsInFile.push(rawId);
      rowErrors.push(`Duplicate Question ID "${rawId}" found within import file.`);
    } else {
      seenIdsInFile.add(rawId);
    }

    // Validate options array
    let sanitizedOptions: QuestionOption[] = [];
    if (!Array.isArray(item.options)) {
      rowErrors.push('Question options must be an array with at least 2 options.');
    } else if (item.options.length < 2) {
      rowErrors.push('Question options array must contain at least 2 options.');
    } else {
      for (let optIdx = 0; optIdx < item.options.length; optIdx++) {
        const opt = item.options[optIdx];
        if (!opt || typeof opt !== 'object') {
          rowErrors.push(`Option at index ${optIdx} is not a valid object.`);
        } else {
          const optId = sanitizeText(opt.id);
          const optText = sanitizeText(opt.text);
          if (!optId) rowErrors.push(`Option at index ${optIdx} is missing an ID.`);
          if (!optText) rowErrors.push(`Option at index ${optIdx} text cannot be blank.`);
          sanitizedOptions.push({ id: optId, text: optText });
        }
      }
    }

    const sanitizedOptionExplanations: Record<string, string> = {};
    if (item.optionExplanations && typeof item.optionExplanations === 'object' && !Array.isArray(item.optionExplanations)) {
      for (const [k, v] of Object.entries(item.optionExplanations)) {
        sanitizedOptionExplanations[sanitizeText(k)] = sanitizeText(v);
      }
    }

    // Preserve supported imageMetadata and migrate/sanitize questionMedia & explanationMedia
    let sanitizedImageMetadata: QuestionImageMetadata | undefined;
    if (item.imageMetadata && typeof item.imageMetadata === 'object') {
      sanitizedImageMetadata = {
        url: sanitizeText(item.imageMetadata.url),
        alt: item.imageMetadata.alt ? sanitizeText(item.imageMetadata.alt) : undefined,
        caption: item.imageMetadata.caption ? sanitizeText(item.imageMetadata.caption) : undefined,
        provenance: item.imageMetadata.provenance ? sanitizeText(item.imageMetadata.provenance) : undefined,
      };
    }

    // Sanitize questionMedia (vignette media) and explanationMedia
    let sanitizedQuestionMedia = sanitizeEducationalMedia(item.questionMedia);
    // If questionMedia is not explicitly supplied but legacy imageMetadata exists, migrate to vignette media
    if (!sanitizedQuestionMedia && sanitizedImageMetadata) {
      sanitizedQuestionMedia = migrateLegacyImageMetadata(sanitizedImageMetadata);
    }
    const sanitizedExplanationMedia = sanitizeEducationalMedia(item.explanationMedia);

    const candidateQuestion: Question = {
      id: rawId,
      version: typeof item.version === 'number' ? item.version : 1,
      contentKind: item.contentKind === 'educational' ? 'educational' : 'demo',
      editorialStatus: ['draft', 'in_review', 'approved', 'archived'].includes(item.editorialStatus)
        ? item.editorialStatus
        : 'draft',
      exam: sanitizeText(item.exam) || 'USMLE Step 1 (Demo Taxonomy)',
      system: sanitizeText(item.system),
      discipline: sanitizeText(item.discipline),
      topic: sanitizeText(item.topic),
      conceptId: item.conceptId ? sanitizeText(item.conceptId) : undefined,
      learningObjective: sanitizeText(item.learningObjective),
      vignette: sanitizeText(item.vignette),
      options: sanitizedOptions,
      correctOptionId: sanitizeText(item.correctOptionId),
      explanation: sanitizeText(item.explanation),
      optionExplanations: sanitizedOptionExplanations,
      keyTakeaway: sanitizeText(item.keyTakeaway),
      references: Array.isArray(item.references) ? item.references.map(sanitizeText) : undefined,
      sourceReference: item.sourceReference
        ? {
            source: sanitizeText(item.sourceReference.source),
            edition: sanitizeText(item.sourceReference.edition),
            page: sanitizeText(item.sourceReference.page),
          }
        : undefined,
      imageMetadata: sanitizedImageMetadata,
      questionMedia: sanitizedQuestionMedia,
      explanationMedia: sanitizedExplanationMedia,
      authorDifficulty: ['Easy', 'Medium', 'Hard'].includes(item.authorDifficulty)
        ? item.authorDifficulty
        : undefined,
      reviewer: {
        name: item.reviewer?.name ? sanitizeText(item.reviewer.name) : null,
        role: item.reviewer?.role ? sanitizeText(item.reviewer.role) : null,
      },
      reviewDate: item.reviewDate ? sanitizeText(item.reviewDate) : undefined,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    let validation = { isValid: rowErrors.length === 0, errors: [...rowErrors] };
    if (validation.isValid) {
      if (candidateQuestion.editorialStatus === 'approved') {
        const approvalCheck = validateQuestionForApproval(candidateQuestion);
        validation.isValid = approvalCheck.isValid;
        validation.errors.push(...approvalCheck.errors);
      } else if (!candidateQuestion.id || !candidateQuestion.vignette) {
        validation.isValid = false;
        validation.errors.push('ID and Vignette are required even for Drafts.');
      }
    }

    const isUpdate = existingMap.has(candidateQuestion.id);
    if (validation.isValid) {
      cleanQuestions.push(candidateQuestion);
      if (isUpdate) proposedUpdates.push(candidateQuestion.id);
      else proposedInserts.push(candidateQuestion.id);
    }

    rowResults.push({
      rowNumber,
      id: candidateQuestion.id || `(Row ${rowNumber})`,
      topic: candidateQuestion.topic || 'Untitled Item',
      isValid: validation.isValid,
      isUpdate,
      errors: validation.errors,
    });
  });

  const validCount = cleanQuestions.length;
  const invalidCount = items.length - validCount;

  return {
    success: true,
    summary: {
      totalRows: items.length,
      validCount,
      invalidCount,
      duplicatesInFile: duplicateIdsInFile,
      proposedUpdates,
      proposedInserts,
      rowResults,
      cleanQuestions,
    },
  };
}

/**
 * Atomic question import: saves all clean questions in a single transaction.
 */
export async function atomicImportQuestions(
  questions: Question[]
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const db = await getDatabase();
    const tx = db.transaction('questions', 'readwrite');
    for (const q of questions) {
      await tx.store.put(q);
    }
    await tx.done;
    return {
      success: true,
      count: questions.length,
      message: `Successfully saved ${questions.length} questions into local workspace.`,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Atomic import transaction aborted: ${err.message}`,
    };
  }
}

/**
 * Creates a JSON backup object of all local data (v2 schema).
 * Exports all persisted activity history, not just 90 records.
 */
export async function exportLocalBackup(): Promise<string> {
  const profile = await profileRepo.getProfile();
  const settings = await settingsRepo.getSettings();
  const sessions = await sessionRepo.getAll();
  const questions = await questionRepo.getAll();
  const dailyActivity = await dailyActivityRepo.getAll(); // All activity records
  const reviewQueue = await reviewQueueRepo.getAll();
  const errorNotebook = await errorNotebookRepo.getAll();
  const flashcards = await flashcardRepo.getAll();
  const questionReports = await questionReportRepo.getAll();
  const achievements = await achievementRepo.getEarned();
  const discoverCards = await discoverCardRepo.getAll();

  const backup: BackupData = {
    version: 3,
    exportedAt: new Date().toISOString(),
    app: 'WardWit',
    profile,
    settings,
    sessions,
    questions,
    dailyActivity,
    reviewQueue,
    errorNotebook,
    flashcards,
    questionReports,
    achievements,
    discoverCards,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Validates and imports a JSON backup into IndexedDB atomically.
 * - Deep structural pre-validation before any write.
 * - Restores all participating stores in a single atomic transaction.
 * - Documented collision policy: incoming records overwrite existing records by primary key (put).
 * - On any error, transaction rolls back leaving prior database completely intact.
 */
export async function importLocalBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    if (typeof jsonString !== 'string' || !jsonString.trim()) {
      return { success: false, message: 'Invalid backup: Payload must be a non-empty JSON string.' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr: any) {
      return { success: false, message: `Backup JSON Parse Error: ${parseErr.message}` };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { success: false, message: 'Invalid backup format: Expected a JSON object.' };
    }

    if (parsed.app !== 'WardWit' || ![1, 2, 3].includes(parsed.version)) {
      return { success: false, message: 'Invalid backup file format: Not a recognized WardWit backup.' };
    }

    if (!Array.isArray(parsed.questions) || !Array.isArray(parsed.sessions)) {
      return { success: false, message: 'Backup file is missing required questions or sessions array.' };
    }

    // Validate questions array
    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      if (!q || typeof q !== 'object' || !q.id || typeof q.id !== 'string') {
        return { success: false, message: `Validation failed: Question at index ${i} is invalid or missing ID.` };
      }
    }

    // Validate sessions array
    for (let i = 0; i < parsed.sessions.length; i++) {
      const s = parsed.sessions[i];
      if (!s || typeof s !== 'object' || !s.id || typeof s.id !== 'string') {
        return { success: false, message: `Validation failed: Session at index ${i} is invalid or missing ID.` };
      }
    }

    // Validate dailyActivity if present
    if (parsed.dailyActivity !== undefined) {
      if (!Array.isArray(parsed.dailyActivity)) {
        return { success: false, message: 'Validation failed: dailyActivity must be an array.' };
      }
      for (let i = 0; i < parsed.dailyActivity.length; i++) {
        const a = parsed.dailyActivity[i];
        if (!a || typeof a !== 'object' || !a.date || typeof a.date !== 'string') {
          return { success: false, message: `Validation failed: Activity at index ${i} is invalid or missing date.` };
        }
      }
    }

    // Validate reviewQueue if present
    if (parsed.reviewQueue !== undefined) {
      if (!Array.isArray(parsed.reviewQueue)) {
        return { success: false, message: 'Validation failed: reviewQueue must be an array.' };
      }
      for (let i = 0; i < parsed.reviewQueue.length; i++) {
        const r = parsed.reviewQueue[i];
        if (!r || typeof r !== 'object' || !r.id || typeof r.id !== 'string') {
          return { success: false, message: `Validation failed: Review item at index ${i} is invalid or missing ID.` };
        }
      }
    }

    // Validate flashcards if present
    if (parsed.flashcards !== undefined) {
      if (!Array.isArray(parsed.flashcards)) {
        return { success: false, message: 'Validation failed: flashcards must be an array.' };
      }
      for (let i = 0; i < parsed.flashcards.length; i++) {
        const f = parsed.flashcards[i];
        if (!f || typeof f !== 'object' || !f.id || typeof f.id !== 'string') {
          return { success: false, message: `Validation failed: Flashcard at index ${i} is invalid or missing ID.` };
        }
      }
    }

    // Validate errorNotebook if present
    if (parsed.errorNotebook !== undefined) {
      if (!Array.isArray(parsed.errorNotebook)) {
        return { success: false, message: 'Validation failed: errorNotebook must be an array.' };
      }
      for (let i = 0; i < parsed.errorNotebook.length; i++) {
        const e = parsed.errorNotebook[i];
        if (!e || typeof e !== 'object' || !e.id || typeof e.id !== 'string') {
          return { success: false, message: `Validation failed: Error notebook item at index ${i} is invalid or missing ID.` };
        }
      }
    }

    // Validate questionReports if present
    if (parsed.questionReports !== undefined) {
      if (!Array.isArray(parsed.questionReports)) {
        return { success: false, message: 'Validation failed: questionReports must be an array.' };
      }
      for (let i = 0; i < parsed.questionReports.length; i++) {
        const rep = parsed.questionReports[i];
        if (!rep || typeof rep !== 'object' || !rep.id || typeof rep.id !== 'string') {
          return { success: false, message: `Validation failed: Question report at index ${i} is invalid or missing ID.` };
        }
      }
    }

    // Validate discoverCards if present
    if (parsed.discoverCards !== undefined) {
      if (!Array.isArray(parsed.discoverCards)) {
        return { success: false, message: 'Validation failed: discoverCards must be an array.' };
      }
      for (let i = 0; i < parsed.discoverCards.length; i++) {
        const dc = parsed.discoverCards[i];
        if (!dc || typeof dc !== 'object' || !dc.id || typeof dc.id !== 'string') {
          return { success: false, message: `Validation failed: Discover card at index ${i} is invalid or missing ID.` };
        }
      }
    }

    const db = await getDatabase();

    // Participating stores restored in a single atomic transaction
    const tx = db.transaction(
      [
        'questions',
        'sessions',
        'profiles',
        'settings',
        'dailyActivity',
        'reviewQueue',
        'errorNotebook',
        'flashcards',
        'questionReports',
        'achievements',
        'discoverCards',
      ],
      'readwrite'
    );

    // Questions
    const qStore = tx.objectStore('questions');
    for (const q of parsed.questions) {
      await qStore.put(q);
    }

    // Sessions
    const sStore = tx.objectStore('sessions');
    for (const s of parsed.sessions) {
      await sStore.put(s);
    }

    // Profile
    if (parsed.profile && typeof parsed.profile === 'object') {
      const pStore = tx.objectStore('profiles');
      await pStore.put({ ...parsed.profile, id: 'default-profile', updatedAt: Date.now() });
    }

    // Settings
    if (parsed.settings && typeof parsed.settings === 'object') {
      const setStore = tx.objectStore('settings');
      await (setStore as any).put(parsed.settings, 'app-settings');
    }

    // Daily Activity
    if (Array.isArray(parsed.dailyActivity)) {
      const actStore = tx.objectStore('dailyActivity');
      for (const a of parsed.dailyActivity) {
        await actStore.put(a);
      }
    }

    // Review Queue
    if (Array.isArray(parsed.reviewQueue)) {
      const rqStore = tx.objectStore('reviewQueue');
      for (const r of parsed.reviewQueue) {
        await rqStore.put(r);
      }
    }

    // Error Notebook
    if (Array.isArray(parsed.errorNotebook)) {
      const enTx = tx.objectStore('errorNotebook');
      for (const e of parsed.errorNotebook) {
        await enTx.put(e);
      }
    }

    // Flashcards
    if (Array.isArray(parsed.flashcards)) {
      const fcStore = tx.objectStore('flashcards');
      for (const f of parsed.flashcards) {
        await fcStore.put(f);
      }
    }

    // Question Reports
    if (Array.isArray(parsed.questionReports)) {
      const qrStore = tx.objectStore('questionReports');
      for (const rep of parsed.questionReports) {
        await qrStore.put(rep);
      }
    }

    // Achievements
    if (parsed.achievements && typeof parsed.achievements === 'object') {
      const achStore = tx.objectStore('achievements');
      for (const [id, earnedAt] of Object.entries(parsed.achievements)) {
        if (typeof earnedAt === 'number') {
          await achStore.put({ id, earnedAt });
        }
      }
    }

    // Discover Cards
    if (Array.isArray(parsed.discoverCards)) {
      const dcStore = tx.objectStore('discoverCards');
      for (const dc of parsed.discoverCards) {
        await dcStore.put(dc);
      }
    }

    await tx.done;

    return {
      success: true,
      message: `Successfully imported backup with ${parsed.questions.length} questions, ${parsed.sessions.length} sessions, and study tools.`,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to import backup: ${err.message || 'Unknown transaction error'}` };
  }
}

/**
 * Clear local database and reset to clean slate.
 */
export async function clearAllLocalData(): Promise<void> {
  await deleteLocalDatabase();
}
