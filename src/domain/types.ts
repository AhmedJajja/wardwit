/**
 * Core Domain Types for WardWit
 */

export type ContentKind = 'demo' | 'educational';

export type AuthorDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuestionOption {
  id: string; // e.g. 'A', 'B', 'C', 'D', 'E'
  text: string;
}

export interface QuestionReviewer {
  name: string | null;
  role: string | null;
}

export interface QuestionImageMetadata {
  svg?: string;
  alt?: string;
  caption?: string;
}

export interface Question {
  id: string; // Stable ID e.g. 'demo-001'
  version: number; // Increment on edits
  contentKind: ContentKind; // 'demo' or 'educational'
  exam: string; // e.g. 'USMLE Step 1 (Demo Taxonomy)'
  system: string; // e.g. 'Cardiovascular (Demo)'
  discipline: string; // e.g. 'Physiology (Demo)'
  topic: string; // e.g. 'Cardiac Output Logic'
  learningObjective: string;
  vignette: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  optionExplanations: Record<string, string>;
  keyTakeaway: string;
  references?: string[];
  imageMetadata?: QuestionImageMetadata;
  authorDifficulty?: AuthorDifficulty; // Explicitly noted as author-assigned, not measured
  editorialStatus: 'Demo Reviewed' | 'Draft';
  reviewer: QuestionReviewer;
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
}

export type QuestionPool = 'all' | 'unused' | 'incorrect' | 'flagged';

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
}
