/**
 * Core Domain Types for WardWit
 */

export type ContentKind = 'demo' | 'educational';

export type AuthorDifficulty = 'Easy' | 'Medium' | 'Hard';

export type EditorialStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export interface QuestionOption {
  id: string; // e.g. 'A', 'B', 'C', 'D', 'E'
  text: string;
}

export interface QuestionReviewer {
  name: string | null;
  role: string | null;
}

export interface SourceReference {
  source: string;
  edition?: string;
  page?: string;
}

export interface QuestionImageMetadata {
  svg?: string;
  url?: string;
  alt?: string;
  caption?: string;
  provenance?: string;
}

export interface Question {
  id: string; // Stable ID e.g. 'demo-001'
  version: number; // Increment on edits
  contentKind: ContentKind; // 'demo' or 'educational'
  editorialStatus: EditorialStatus; // 'draft', 'in_review', 'approved', 'archived'
  exam: string; // e.g. 'USMLE Step 1 (Demo Taxonomy)'
  system: string; // e.g. 'Cardiovascular (Demo)'
  discipline: string; // e.g. 'Physiology (Demo)'
  topic: string; // e.g. 'Cardiac Output Logic'
  conceptId?: string; // Concept identifier for tracking related questions
  learningObjective: string;
  vignette: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  optionExplanations: Record<string, string>;
  keyTakeaway: string;
  references?: string[];
  sourceReference?: SourceReference;
  imageMetadata?: QuestionImageMetadata;
  authorDifficulty?: AuthorDifficulty; // Explicitly noted as author-assigned, not measured
  reviewer: QuestionReviewer;
  reviewDate?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type ConfidenceLevel = 'confident' | 'unsure' | 'guessed';

export interface QuestionUserAnswer {
  selectedOptionId: string | null;
  firstSubmittedOptionId?: string | null; // Fixed in tutor mode on submit
  confidence?: ConfidenceLevel;
  isFlagged: boolean;
  eliminatedOptionIds: string[];
  submittedAt?: number;
  timeSpentSeconds: number;
}

export type SessionMode = 'tutor' | 'timed';
export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';

export interface ConfidenceStats {
  total: number;
  correct: number;
}

export interface SessionScore {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  percentage: number;
  totalTimeSeconds: number;
  confidenceBreakdown: {
    confident: ConfidenceStats;
    unsure: ConfidenceStats;
    guessed: ConfidenceStats;
    unrated: ConfidenceStats;
  };
}

export interface StudySession {
  id: string;
  name: string;
  mode: SessionMode;
  status: SessionStatus;
  createdAt: number;
  startedAt: number;
  completedAt?: number;
  durationMinutes: number; // configured duration for timed mode
  expiresAt?: number; // Absolute deadline timestamp for timed mode
  questionSnapshots: Question[]; // Snapshots of questions at session creation
  currentIndex: number;
  answers: Record<string, QuestionUserAnswer>;
  score?: SessionScore;
}

export type MBBSYear = 
  | 'Year 1'
  | 'Year 2'
  | 'Year 3'
  | 'Year 4'
  | 'Final Year 5'
  | 'Graduate / House Officer'
  | 'Other';

export interface UserProfile {
  id: string; // 'default-profile'
  displayName: string;
  mbbsYear: MBBSYear;
  college?: string; // Optional free text
  targetExamDate?: string; // ISO date string or empty
  preferredStudyDays: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  dailyQuestionGoal: number; // e.g. 5, 10, 20
  onboardingCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  quietMode: boolean; // Suppresses mascot banter and confetti animations
  theme: 'warm-ivory' | 'light' | 'dark';
  fontSize: 'normal' | 'large';
  soundEffects: boolean;
  reviewScheduling: {
    includeUnsureGuessed: boolean;
    intervalStepDays: number[]; // e.g. [1, 3, 7, 14]
  };
}

export type QuestionPool = 'all' | 'unused' | 'incorrect' | 'flagged' | 'due_review';

export interface SessionFilterCriteria {
  systems: string[];
  disciplines: string[];
  topics: string[];
  pool: QuestionPool;
  count: number;
  mode: SessionMode;
  durationMinutes?: number;
}

export interface DailyActivityRecord {
  date: string; // 'YYYY-MM-DD'
  questionsAnswered: number;
  correctCount: number;
  sessionsCompleted: number;
  flashcardsReviewed?: number;
}

// --- REVIEW QUEUE ---
export type ReviewItemReason = 'incorrect' | 'unsure' | 'guessed';

export interface ReviewQueueItem {
  id: string;
  questionId: string;
  conceptId?: string;
  reason: ReviewItemReason;
  addedAt: number;
  dueAt: number;
  intervalDays: number;
  reviewCount: number;
  lastReviewedAt?: number;
  status: 'pending' | 'completed' | 'dismissed';
}

// --- ERROR NOTEBOOK ---
export type ErrorCause =
  | 'knowledge_gap'
  | 'reasoning_mistake'
  | 'misread_question'
  | 'time_pressure'
  | 'other';

export interface ErrorNotebookEntry {
  id: string;
  questionId: string;
  questionSnapshot: Question;
  sessionRefId?: string;
  selectedOptionId?: string | null;
  cause: ErrorCause;
  studentNotes: string;
  personalTakeaway: string;
  createdAt: number;
  updatedAt: number;
}

// --- FLASHCARDS ---
export type CardRating = 'again' | 'difficult' | 'remembered';
export type CardKind = 'personal' | 'approved_demo';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  sourceQuestionId?: string;
  sourceNoteId?: string;
  cardKind: CardKind;
  topic?: string;
  intervalDays: number;
  dueAt: number;
  repetitions: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// --- QUESTION REPORTS (Local review inbox) ---
export type ReportIssueType =
  | 'possible_error'
  | 'ambiguous_wording'
  | 'missing_broken_media'
  | 'outdated_content'
  | 'typo';

export interface QuestionReport {
  id: string;
  questionId: string;
  questionVersion: number;
  issueType: ReportIssueType;
  comment: string;
  createdAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolutionNote?: string;
}

// --- MILESTONES & ACHIEVEMENTS ---
export interface MilestoneAchievement {
  id: string;
  title: string;
  description: string;
  iconName: string;
  criteriaRule: string;
  earnedAt?: number;
}

// --- ANALYTICS / PROGRESS REPORT ---
export interface TopicPerformanceStat {
  topic: string;
  system: string;
  attemptsCount: number;
  correctCount: number;
  percentage: number;
  signal: 'insufficient_data' | 'needs_practice' | 'developing' | 'steady_progress';
}

export interface WeeklyActivitySummary {
  weekLabel: string; // e.g. "Week of Sep 21"
  startDate: string;
  endDate: string;
  questionsCount: number;
  activeDaysCount: number;
}

export interface ComprehensiveProgressStats {
  totalAttempts: number;
  uniqueQuestionsAttempted: number;
  firstAttemptAccuracy: {
    correct: number;
    denominator: number;
    percentage: number;
  };
  repeatAttemptAccuracy: {
    correct: number;
    denominator: number;
    percentage: number;
  };
  weeklyActivity: WeeklyActivitySummary[];
  topicPerformance: TopicPerformanceStat[];
  insufficientDataTopicsCount: number;
}
