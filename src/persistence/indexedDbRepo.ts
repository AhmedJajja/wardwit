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
  BackupData,
} from './repositories';
import type {
  Question,
  StudySession,
  UserProfile,
  UserSettings,
  DailyActivityRecord,
  ReviewQueueItem,
  ErrorNotebookEntry,
  Flashcard,
  QuestionReport,
} from '../domain/types';

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
    await db.put('sessions', session);
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
      date: dateStr,
      questionsAnswered: Math.max(0, existing.questionsAnswered + questionsDelta),
      correctCount: Math.max(0, existing.correctCount + correctDelta),
      sessionsCompleted: existing.sessionsCompleted + (sessionCompleted ? 1 : 0),
      flashcardsReviewed: Math.max(0, (existing.flashcardsReviewed || 0) + flashcardsReviewedDelta),
    };

    await db.put('dailyActivity', updated);
    return updated;
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
 */
export function dryRunImportQuestions(
  jsonString: string,
  existingQuestions: Question[]
): { success: boolean; error?: string; summary?: DryRunImportSummary } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return { success: false, error: `JSON Parse Error: ${err.message}` };
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
    const rawId = sanitizeText(item.id);

    if (seenIdsInFile.has(rawId)) {
      duplicateIdsInFile.push(rawId);
    } else {
      seenIdsInFile.add(rawId);
    }

    // Sanitize options
    const sanitizedOptions = Array.isArray(item.options)
      ? item.options.map((opt: any) => ({
          id: sanitizeText(opt.id),
          text: sanitizeText(opt.text),
        }))
      : [];

    const sanitizedOptionExplanations: Record<string, string> = {};
    if (item.optionExplanations && typeof item.optionExplanations === 'object') {
      for (const [k, v] of Object.entries(item.optionExplanations)) {
        sanitizedOptionExplanations[sanitizeText(k)] = sanitizeText(v);
      }
    }

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

    // If marked approved, must pass full validation; if draft/in_review, basic ID check
    let validation = { isValid: true, errors: [] as string[] };
    if (candidateQuestion.editorialStatus === 'approved') {
      validation = validateQuestionForApproval(candidateQuestion);
    } else if (!candidateQuestion.id || !candidateQuestion.vignette) {
      validation = { isValid: false, errors: ['ID and Vignette are required even for Drafts.'] };
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
 */
export async function exportLocalBackup(): Promise<string> {
  const profile = await profileRepo.getProfile();
  const settings = await settingsRepo.getSettings();
  const sessions = await sessionRepo.getAll();
  const questions = await questionRepo.getAll();
  const dailyActivity = await dailyActivityRepo.getRecentActivity(90);
  const reviewQueue = await reviewQueueRepo.getAll();
  const errorNotebook = await errorNotebookRepo.getAll();
  const flashcards = await flashcardRepo.getAll();
  const questionReports = await questionReportRepo.getAll();
  const achievements = await achievementRepo.getEarned();

  const backup: BackupData = {
    version: 2,
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
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Validates and imports a JSON backup into IndexedDB.
 */
export async function importLocalBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString) as BackupData;
    if (!parsed || parsed.app !== 'WardWit' || ![1, 2].includes(parsed.version)) {
      return { success: false, message: 'Invalid backup file format: Not a recognized WardWit backup.' };
    }

    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.questions)) {
      return { success: false, message: 'Backup file is missing required questions or sessions structure.' };
    }

    const db = await getDatabase();

    // Import questions
    const qTx = db.transaction('questions', 'readwrite');
    for (const q of parsed.questions) {
      if (q.id && q.options) {
        await qTx.store.put(q);
      }
    }
    await qTx.done;

    // Import sessions
    const sTx = db.transaction('sessions', 'readwrite');
    for (const s of parsed.sessions) {
      if (s.id && s.questionSnapshots) {
        await sTx.store.put(s);
      }
    }
    await sTx.done;

    // Import profile
    if (parsed.profile) {
      await profileRepo.saveProfile(parsed.profile);
    }

    // Import settings
    if (parsed.settings) {
      await settingsRepo.saveSettings(parsed.settings);
    }

    // Import daily activity
    if (Array.isArray(parsed.dailyActivity)) {
      const aTx = db.transaction('dailyActivity', 'readwrite');
      for (const a of parsed.dailyActivity) {
        if (a.date) {
          await aTx.store.put(a);
        }
      }
      await aTx.done;
    }

    // Import Phase 2 stores if present
    if (Array.isArray(parsed.reviewQueue)) {
      const rqTx = db.transaction('reviewQueue', 'readwrite');
      for (const r of parsed.reviewQueue) {
        if (r.id) await rqTx.store.put(r);
      }
      await rqTx.done;
    }

    if (Array.isArray(parsed.errorNotebook)) {
      const enTx = db.transaction('errorNotebook', 'readwrite');
      for (const e of parsed.errorNotebook) {
        if (e.id) await enTx.store.put(e);
      }
      await enTx.done;
    }

    if (Array.isArray(parsed.flashcards)) {
      const fcTx = db.transaction('flashcards', 'readwrite');
      for (const f of parsed.flashcards) {
        if (f.id) await fcTx.store.put(f);
      }
      await fcTx.done;
    }

    if (Array.isArray(parsed.questionReports)) {
      const qrTx = db.transaction('questionReports', 'readwrite');
      for (const rep of parsed.questionReports) {
        if (rep.id) await qrTx.store.put(rep);
      }
      await qrTx.done;
    }

    if (parsed.achievements) {
      await achievementRepo.saveEarned(parsed.achievements);
    }

    return {
      success: true,
      message: `Successfully imported backup with ${parsed.questions.length} questions, ${parsed.sessions.length} sessions, and study tools.`,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to import backup: ${err.message || 'Unknown parsing error'}` };
  }
}

/**
 * Clear local database and reset to clean slate.
 */
export async function clearAllLocalData(): Promise<void> {
  await deleteLocalDatabase();
}
