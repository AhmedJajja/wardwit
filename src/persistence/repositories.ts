/**
 * Repository Interfaces for WardWit
 */

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
  DiscoverCard,
} from '../domain/types';

export interface IQuestionRepository {
  getAll(): Promise<Question[]>;
  getApproved(): Promise<Question[]>;
  getById(id: string): Promise<Question | undefined>;
  save(question: Question): Promise<void>;
  saveBatch(questions: Question[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface FinalizeSessionResult {
  success: boolean;
  alreadyCompleted: boolean;
  session: StudySession;
  updatedActivity?: DailyActivityRecord;
  updatedReviewItems?: ReviewQueueItem[];
  newReviewItems?: ReviewQueueItem[];
  justQualified?: boolean;
}

export interface ISessionRepository {
  getAll(): Promise<StudySession[]>;
  getById(id: string): Promise<StudySession | undefined>;
  getActiveSession(): Promise<StudySession | undefined>;
  save(session: StudySession): Promise<void>;
  finalizeSessionTransaction(
    sessionToFinish: StudySession,
    todayStr: string,
    now?: number
  ): Promise<FinalizeSessionResult>;
  delete(id: string): Promise<void>;
}

export interface IProfileRepository {
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
}

export interface ISettingsRepository {
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;
}

export interface IDailyActivityRepository {
  getAll(): Promise<DailyActivityRecord[]>;
  getActivityForDate(dateStr: string): Promise<DailyActivityRecord | null>;
  recordActivity(
    dateStr: string,
    questionsAnsweredDelta: number,
    correctDelta: number,
    sessionCompleted: boolean,
    flashcardsReviewedDelta?: number
  ): Promise<DailyActivityRecord>;
  recordQualifyingAction(
    dateStr: string,
    canonicalItemId: string,
    statsDelta?: {
      questionsAnswered?: number;
      correctCount?: number;
      sessionsCompleted?: number;
      flashcardsReviewed?: number;
    },
    now?: number
  ): Promise<{ record: DailyActivityRecord; wasNewAction: boolean; justQualified: boolean }>;
  getRecentActivity(days: number): Promise<DailyActivityRecord[]>;
}

export interface IReviewQueueRepository {
  getAll(): Promise<ReviewQueueItem[]>;
  getDue(now?: number): Promise<ReviewQueueItem[]>;
  save(item: ReviewQueueItem): Promise<void>;
  saveBatch(items: ReviewQueueItem[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IErrorNotebookRepository {
  getAll(): Promise<ErrorNotebookEntry[]>;
  getById(id: string): Promise<ErrorNotebookEntry | undefined>;
  getByQuestionId(questionId: string): Promise<ErrorNotebookEntry[]>;
  save(entry: ErrorNotebookEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IFlashcardRepository {
  getAll(): Promise<Flashcard[]>;
  getById(id: string): Promise<Flashcard | undefined>;
  getDue(now?: number): Promise<Flashcard[]>;
  save(card: Flashcard): Promise<void>;
  saveBatch(cards: Flashcard[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IQuestionReportRepository {
  getAll(): Promise<QuestionReport[]>;
  save(report: QuestionReport): Promise<void>;
  markResolved(id: string, note?: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IAchievementRepository {
  getEarned(): Promise<Record<string, number>>;
  saveEarned(earnedMap: Record<string, number>): Promise<void>;
}

export interface IDiscoverCardRepository {
  getAll(): Promise<DiscoverCard[]>;
  getApproved(): Promise<DiscoverCard[]>;
  getById(id: string): Promise<DiscoverCard | undefined>;
  save(card: DiscoverCard): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface BackupData {
  version: 1 | 2 | 3;
  exportedAt: string;
  app: 'WardWit';
  profile: UserProfile | null;
  settings: UserSettings;
  sessions: StudySession[];
  questions: Question[];
  dailyActivity: DailyActivityRecord[];
  reviewQueue?: ReviewQueueItem[];
  errorNotebook?: ErrorNotebookEntry[];
  flashcards?: Flashcard[];
  questionReports?: QuestionReport[];
  achievements?: Record<string, number>;
  discoverCards?: DiscoverCard[];
}
