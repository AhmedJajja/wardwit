/**
 * Session Eligibility and Filter Logic for WardWit
 */

import type { Question, SessionFilterCriteria, StudySession } from './types';

export interface QuestionHistoryStats {
  answeredQuestionIds: Set<string>;
  incorrectQuestionIds: Set<string>;
  flaggedQuestionIds: Set<string>;
  dueReviewQuestionIds?: Set<string>;
}

/**
 * Computes question history stats from past completed sessions.
 */
export function buildQuestionHistory(sessions: StudySession[]): QuestionHistoryStats {
  const answeredQuestionIds = new Set<string>();
  const incorrectQuestionIds = new Set<string>();
  const flaggedQuestionIds = new Set<string>();

  // Process sessions chronologically to establish latest attempt status
  const sortedSessions = [...sessions].sort((a, b) => a.createdAt - b.createdAt);

  for (const session of sortedSessions) {
    for (const q of session.questionSnapshots) {
      const ans = session.answers[q.id];
      if (!ans) continue;

      if (ans.isFlagged) {
        flaggedQuestionIds.add(q.id);
      } else {
        flaggedQuestionIds.delete(q.id);
      }

      const chosenOptionId = ans.firstSubmittedOptionId ?? ans.selectedOptionId;
      if (chosenOptionId) {
        answeredQuestionIds.add(q.id);
        const isCorrect = chosenOptionId === q.correctOptionId;
        if (isCorrect) {
          incorrectQuestionIds.delete(q.id);
        } else {
          incorrectQuestionIds.add(q.id);
        }
      }
    }
  }

  return {
    answeredQuestionIds,
    incorrectQuestionIds,
    flaggedQuestionIds,
  };
}

export interface EligibilityResult {
  eligibleQuestions: Question[];
  totalBankCount: number;
  totalMatchingFilters: number;
  requestedCount: number;
  actualCount: number;
  hasInsufficientQuestions: boolean;
  message?: string;
}

/**
 * Filters questions strictly based on user criteria and history.
 * Draft and archived questions are strictly excluded.
 * Never silently duplicates or fabricates questions.
 */
export function filterQuestionsForSession(
  allQuestions: Question[],
  history: QuestionHistoryStats,
  criteria: SessionFilterCriteria
): EligibilityResult {
  // CRITICAL RULE: Draft and archived questions must NOT leak into study sessions!
  const approvedQuestions = allQuestions.filter(
    (q) => q.editorialStatus === 'approved'
  );

  // 1. Filter by contentKind (educational vs demo vs all) to prevent cross-contamination
  const kindFiltered = approvedQuestions.filter((q) => {
    if (criteria.contentKind && criteria.contentKind !== 'all') {
      return q.contentKind === criteria.contentKind;
    }
    return true;
  });

  const totalBankCount = kindFiltered.length;

  // 2. Filter by taxonomy (System, Discipline, Topic)
  const taxonomyFiltered = kindFiltered.filter((q) => {
    if (criteria.systems.length > 0 && !criteria.systems.includes(q.system)) {
      return false;
    }
    if (criteria.disciplines.length > 0 && !criteria.disciplines.includes(q.discipline)) {
      return false;
    }
    if (criteria.topics.length > 0 && !criteria.topics.includes(q.topic)) {
      return false;
    }
    return true;
  });

  // 2. Filter by question pool
  const poolFiltered = taxonomyFiltered.filter((q) => {
    switch (criteria.pool) {
      case 'unused':
        return !history.answeredQuestionIds.has(q.id);
      case 'incorrect':
        return history.incorrectQuestionIds.has(q.id);
      case 'flagged':
        return history.flaggedQuestionIds.has(q.id);
      case 'due_review':
        return history.dueReviewQuestionIds ? history.dueReviewQuestionIds.has(q.id) : true;
      case 'all':
      default:
        return true;
    }
  });

  const totalMatchingFilters = poolFiltered.length;
  const requestedCount = Math.max(1, criteria.count);

  // 3. Slice to requested count without duplication
  const eligibleQuestions = poolFiltered.slice(0, requestedCount);
  const actualCount = eligibleQuestions.length;
  const hasInsufficientQuestions = actualCount < requestedCount;

  let message: string | undefined;
  if (actualCount === 0) {
    message = `0 approved questions match your selected criteria (${criteria.pool} pool). Try broadening your filters or checking the Content Workspace for approved content.`;
  } else if (hasInsufficientQuestions) {
    message = `Only ${actualCount} matching question${actualCount === 1 ? '' : 's'} available in this pool (requested ${requestedCount}).`;
  }

  return {
    eligibleQuestions,
    totalBankCount,
    totalMatchingFilters,
    requestedCount,
    actualCount,
    hasInsufficientQuestions,
    message,
  };
}
