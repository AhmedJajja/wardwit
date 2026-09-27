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
  BackupData,
} from './repositories';
import type { Question, StudySession, UserProfile, UserSettings, DailyActivityRecord } from '../domain/types';

export class IndexedDBQuestionRepository implements IQuestionRepository {
  async getAll(): Promise<Question[]> {
    const db = await getDatabase();
    return db.getAll('questions');
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
    // Return most recently started in-progress session
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
};

export class IndexedDBSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<UserSettings> {
    const db = await getDatabase();
    // Use 'app-settings' key
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
    sessionCompleted: boolean
  ): Promise<DailyActivityRecord> {
    const db = await getDatabase();
    const existing = (await db.get('dailyActivity', dateStr)) || {
      date: dateStr,
      questionsAnswered: 0,
      correctCount: 0,
      sessionsCompleted: 0,
    };

    const updated: DailyActivityRecord = {
      date: dateStr,
      questionsAnswered: Math.max(0, existing.questionsAnswered + questionsDelta),
      correctCount: Math.max(0, existing.correctCount + correctDelta),
      sessionsCompleted: existing.sessionsCompleted + (sessionCompleted ? 1 : 0),
    };

    await db.put('dailyActivity', updated);
    return updated;
  }

  async getRecentActivity(days = 7): Promise<DailyActivityRecord[]> {
    const db = await getDatabase();
    const all = await db.getAll('dailyActivity');
    return all.sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
  }
}

// Global Singleton instances for app consumption
export const questionRepo = new IndexedDBQuestionRepository();
export const sessionRepo = new IndexedDBSessionRepository();
export const profileRepo = new IndexedDBProfileRepository();
export const settingsRepo = new IndexedDBSettingsRepository();
export const dailyActivityRepo = new IndexedDBDailyActivityRepository();

/**
 * Creates a JSON backup object of all local data.
 */
export async function exportLocalBackup(): Promise<string> {
  const profile = await profileRepo.getProfile();
  const settings = await settingsRepo.getSettings();
  const sessions = await sessionRepo.getAll();
  const questions = await questionRepo.getAll();
  const dailyActivity = await dailyActivityRepo.getRecentActivity(90);

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'WardWit',
    profile,
    settings,
    sessions,
    questions,
    dailyActivity,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Validates and imports a JSON backup into IndexedDB.
 */
export async function importLocalBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString) as BackupData;
    if (!parsed || parsed.app !== 'WardWit' || parsed.version !== 1) {
      return { success: false, message: 'Invalid backup file format: Not a recognized WardWit v1 backup.' };
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

    return {
      success: true,
      message: `Successfully imported ${parsed.questions.length} questions, ${parsed.sessions.length} sessions, and profile settings.`,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to import backup: ${err.message || 'Unknown parsing error'}` };
  }
}

/**
 * Completely clear local database and reset to clean slate.
 */
export async function clearAllLocalData(): Promise<void> {
  await deleteLocalDatabase();
}
