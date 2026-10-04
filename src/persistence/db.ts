/**
 * IndexedDB Schema and Initialization using 'idb'
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import { DEMO_DISCOVER_CARDS } from '../config/demoDiscoverCards';

export interface WardWitDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: {
      'by-system': string;
      'by-discipline': string;
      'by-content-kind': string;
      'by-editorial-status': string;
    };
  };
  sessions: {
    key: string;
    value: StudySession;
    indexes: {
      'by-status': string;
      'by-created-at': number;
    };
  };
  profiles: {
    key: string;
    value: UserProfile;
  };
  settings: {
    key: string;
    value: UserSettings;
  };
  dailyActivity: {
    key: string; // 'YYYY-MM-DD'
    value: DailyActivityRecord;
  };
  reviewQueue: {
    key: string;
    value: ReviewQueueItem;
    indexes: {
      'by-due-at': number;
      'by-question-id': string;
      'by-status': string;
    };
  };
  errorNotebook: {
    key: string;
    value: ErrorNotebookEntry;
    indexes: {
      'by-question-id': string;
      'by-cause': string;
      'by-created-at': number;
    };
  };
  flashcards: {
    key: string;
    value: Flashcard;
    indexes: {
      'by-due-at': number;
      'by-card-kind': string;
    };
  };
  questionReports: {
    key: string;
    value: QuestionReport;
    indexes: {
      'by-question-id': string;
      'by-resolved': number; // 0 or 1
    };
  };
  achievements: {
    key: string;
    value: { id: string; earnedAt: number };
  };
  discoverCards: {
    key: string;
    value: DiscoverCard;
    indexes: {
      'by-editorial-status': string;
      'by-content-kind': string;
      'by-topic': string;
    };
  };
}

const DB_NAME = 'wardwit_local_db';
const DB_VERSION = 3; // Incremented for Phase 3 Discover and learning-content stores

let dbPromise: Promise<IDBPDatabase<WardWitDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<WardWitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WardWitDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion) {
        // Questions store
        let qStore;
        if (!db.objectStoreNames.contains('questions')) {
          qStore = db.createObjectStore('questions', { keyPath: 'id' });
          qStore.createIndex('by-system', 'system');
          qStore.createIndex('by-discipline', 'discipline');
          qStore.createIndex('by-content-kind', 'contentKind');
        } else {
          // In an upgrade transaction, we can access existing stores directly via transaction
          // idb types wrap IDBTransaction
        }

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sStore.createIndex('by-status', 'status');
          sStore.createIndex('by-created-at', 'createdAt');
        }

        // Profiles store
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Daily Activity store
        if (!db.objectStoreNames.contains('dailyActivity')) {
          db.createObjectStore('dailyActivity', { keyPath: 'date' });
        }

        // Phase 2 stores:
        if (!db.objectStoreNames.contains('reviewQueue')) {
          const rqStore = db.createObjectStore('reviewQueue', { keyPath: 'id' });
          rqStore.createIndex('by-due-at', 'dueAt');
          rqStore.createIndex('by-question-id', 'questionId');
          rqStore.createIndex('by-status', 'status');
        }

        if (!db.objectStoreNames.contains('errorNotebook')) {
          const enStore = db.createObjectStore('errorNotebook', { keyPath: 'id' });
          enStore.createIndex('by-question-id', 'questionId');
          enStore.createIndex('by-cause', 'cause');
          enStore.createIndex('by-created-at', 'createdAt');
        }

        if (!db.objectStoreNames.contains('flashcards')) {
          const fcStore = db.createObjectStore('flashcards', { keyPath: 'id' });
          fcStore.createIndex('by-due-at', 'dueAt');
          fcStore.createIndex('by-card-kind', 'cardKind');
        }

        if (!db.objectStoreNames.contains('questionReports')) {
          const qrStore = db.createObjectStore('questionReports', { keyPath: 'id' });
          qrStore.createIndex('by-question-id', 'questionId');
          qrStore.createIndex('by-resolved', 'resolved');
        }

        if (!db.objectStoreNames.contains('achievements')) {
          db.createObjectStore('achievements', { keyPath: 'id' });
        }

        // Phase 3 stores:
        if (!db.objectStoreNames.contains('discoverCards')) {
          const dcStore = db.createObjectStore('discoverCards', { keyPath: 'id' });
          dcStore.createIndex('by-editorial-status', 'editorialStatus');
          dcStore.createIndex('by-content-kind', 'contentKind');
          dcStore.createIndex('by-topic', 'curriculumMapping.topic');
        }
      },
    }).then(async (db) => {
      // Seed default demo questions if empty
      const count = await db.count('questions');
      if (count === 0) {
        const tx = db.transaction('questions', 'readwrite');
        for (const q of DEMO_QUESTIONS) {
          await tx.store.put(q);
        }
        await tx.done;
      }

      // Seed default demo discover cards if empty
      const dcCount = await db.count('discoverCards');
      if (dcCount === 0) {
        const tx = db.transaction('discoverCards', 'readwrite');
        for (const dc of DEMO_DISCOVER_CARDS) {
          await tx.store.put(dc);
        }
        await tx.done;
      }

      return db;
    });
  }
  return dbPromise;
}

/**
 * Reset database (for tests or user-initiated reset)
 */
export async function deleteLocalDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
