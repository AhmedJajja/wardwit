/**
 * Repository Interfaces for WardWit
 * 
 * Clean separation of storage operations so local IndexedDB can be tested,
 * mocked, or backed by an API in future phases.
 */

import type { Question, StudySession, UserProfile, UserSettings, DailyActivityRecord } from '../domain/types';

export interface IQuestionRepository {
  getAll(): Promise<Question[]>;
  getById(id: string): Promise<Question | undefined>;
  save(question: Question): Promise<void>;
  saveBatch(questions: Question[]): Promise<void>;
}

export interface ISessionRepository {
  getAll(): Promise<StudySession[]>;
  getById(id: string): Promise<StudySession | undefined>;
  getActiveSession(): Promise<StudySession | undefined>;
  save(session: StudySession): Promise<void>;
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
  getActivityForDate(dateStr: string): Promise<DailyActivityRecord | null>;
  recordActivity(dateStr: string, questionsAnsweredDelta: number, correctDelta: number, sessionCompleted: boolean): Promise<DailyActivityRecord>;
  getRecentActivity(days: number): Promise<DailyActivityRecord[]>;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  app: 'WardWit';
  profile: UserProfile | null;
  settings: UserSettings;
  sessions: StudySession[];
  questions: Question[];
  dailyActivity: DailyActivityRecord[];
}
