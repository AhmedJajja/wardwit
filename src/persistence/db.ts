/**
 * IndexedDB Schema and Initialization using 'idb'
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Question, StudySession, UserProfile, UserSettings, DailyActivityRecord } from '../domain/types';
import { DEMO_QUESTIONS } from '../config/demoQuestions';

export interface WardWitDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: {
      'by-system': string;
      'by-discipline': string;
      'by-content-kind': string;
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
}

const DB_NAME = 'wardwit_local_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WardWitDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<WardWitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WardWitDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Questions store
        if (!db.objectStoreNames.contains('questions')) {
          const qStore = db.createObjectStore('questions', { keyPath: 'id' });
          qStore.createIndex('by-system', 'system');
          qStore.createIndex('by-discipline', 'discipline');
          qStore.createIndex('by-content-kind', 'contentKind');
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
