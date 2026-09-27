/**
 * Enjoyable Progress & Milestone Achievements for WardWit
 * 
 * DESIGN PRINCIPLE:
 * Defined from verifiable local database activity.
 * Rewarding sustained practice, review completion, and error reflection;
 * no inflated streaks or rewards for rapid unread guessing.
 */

import type { MilestoneAchievement, StudySession, ErrorNotebookEntry, Flashcard } from './types';

export const ALL_MILESTONES: MilestoneAchievement[] = [
  {
    id: 'first-block',
    title: 'First Ward Round',
    description: 'Complete your first practice block in WardWit.',
    iconName: 'BookCheck',
    criteriaRule: 'Complete at least 1 practice session.',
  },
  {
    id: 'error-detective',
    title: 'Error Detective',
    description: 'Document an entry in your Error Notebook with a personal takeaway.',
    iconName: 'FileSearch',
    criteriaRule: 'Log at least 1 missed question into your Error Notebook.',
  },
  {
    id: 'chai-marathon',
    title: 'Chai & Concepts',
    description: 'Answer 10 practice questions in a single day.',
    iconName: 'Coffee',
    criteriaRule: 'Answer 10 questions within a single calendar date.',
  },
  {
    id: 'spaced-scholar',
    title: 'Spaced Scholar',
    description: 'Review and complete a due item from your Spaced Review queue.',
    iconName: 'RotateCcw',
    criteriaRule: 'Complete at least 1 due item from your review queue.',
  },
  {
    id: 'flashcard-focus',
    title: 'Active Recall Ace',
    description: 'Create and review your first personal flashcard.',
    iconName: 'Layers',
    criteriaRule: 'Create at least 1 flashcard and record a review rating.',
  },
  {
    id: 'consistency-trio',
    title: 'Field Discipline',
    description: 'Study across 3 distinct calendar days.',
    iconName: 'CalendarCheck',
    criteriaRule: 'Have at least 1 completed block on 3 distinct calendar dates.',
  },
];

export function evaluateAchievements(
  sessions: StudySession[],
  errorEntries: ErrorNotebookEntry[],
  flashcards: Flashcard[],
  earnedMap: Record<string, number> = {}
): Record<string, number> {
  const updatedEarned = { ...earnedMap };
  const now = Date.now();

  const completedSessions = sessions.filter((s) => s.status === 'completed');

  // 1. first-block
  if (!updatedEarned['first-block'] && completedSessions.length >= 1) {
    updatedEarned['first-block'] = now;
  }

  // 2. error-detective
  if (!updatedEarned['error-detective'] && errorEntries.length >= 1) {
    updatedEarned['error-detective'] = now;
  }

  // 3. chai-marathon (check if any session or daily activity reached 10 questions)
  if (!updatedEarned['chai-marathon']) {
    const datesMap = new Map<string, number>();
    for (const s of completedSessions) {
      const d = new Date(s.createdAt).toISOString().slice(0, 10);
      datesMap.set(d, (datesMap.get(d) || 0) + s.questionSnapshots.length);
    }
    for (const count of datesMap.values()) {
      if (count >= 10) {
        updatedEarned['chai-marathon'] = now;
        break;
      }
    }
  }

  // 4. flashcard-focus
  if (!updatedEarned['flashcard-focus']) {
    const reviewedCards = flashcards.filter((c) => c.repetitions > 0);
    if (reviewedCards.length >= 1) {
      updatedEarned['flashcard-focus'] = now;
    }
  }

  // 5. consistency-trio
  if (!updatedEarned['consistency-trio']) {
    const uniqueDays = new Set(
      completedSessions.map((s) => new Date(s.createdAt).toISOString().slice(0, 10))
    );
    if (uniqueDays.size >= 3) {
      updatedEarned['consistency-trio'] = now;
    }
  }

  return updatedEarned;
}
