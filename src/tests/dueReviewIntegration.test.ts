import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createReviewQueueItem,
  buildDueReviewSessionPlan,
  resolveReviewQuestion,
} from '../domain/spacedReview';
import {
  sessionRepo,
  reviewQueueRepo,
  clearAllLocalData,
  questionRepo,
} from '../persistence/indexedDbRepo';
import type { Question, StudySession } from '../domain/types';

describe('Due Review Integration and Scheduling', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  const sampleQuestion: Question = {
    id: 'test-q-101',
    version: 1,
    contentKind: 'educational',
    editorialStatus: 'approved',
    exam: 'USMLE Step 1',
    system: 'Cardiovascular',
    discipline: 'Physiology',
    topic: 'Cardiac Output',
    conceptId: 'concept-cardiac-output',
    learningObjective: 'Understand Starling relationship.',
    vignette: 'A 45-year-old patient undergoes hemodynamic assessment showing normal preload.',
    options: [
      { id: 'A', text: 'Increased cardiac contractility' },
      { id: 'B', text: 'Decreased venous return' },
    ],
    correctOptionId: 'A',
    explanation: 'Positive inotropic agents shift the Frank-Starling curve upward.',
    optionExplanations: { A: 'Correct', B: 'Incorrect' },
    keyTakeaway: 'Contractility increases stroke volume at any given preload.',
    reviewer: { name: 'Dr. Reviewer', role: 'Physiologist' },
  };

  const alternateQuestion: Question = {
    id: 'test-q-102-alt',
    version: 1,
    contentKind: 'educational',
    editorialStatus: 'approved',
    exam: 'USMLE Step 1',
    system: 'Cardiovascular',
    discipline: 'Physiology',
    topic: 'Cardiac Output Dynamics',
    conceptId: 'concept-cardiac-output', // Same concept!
    learningObjective: 'Understand Starling relationship alternate presentation.',
    vignette: 'A 50-year-old marathon runner shows high cardiac index during exertion.',
    options: [
      { id: 'A', text: 'Augmented stroke work' },
      { id: 'B', text: 'Reduced left ventricular filling' },
    ],
    correctOptionId: 'A',
    explanation: 'Exercise increases stroke work via sympathetic stimulation.',
    optionExplanations: { A: 'Correct', B: 'Incorrect' },
    keyTakeaway: 'Sympathetic tone increases contractility.',
    reviewer: { name: 'Dr. Reviewer', role: 'Physiologist' },
  };

  it('reschedules original item once when review attempt is completed, without creating extra pending items', async () => {
    await questionRepo.save(sampleQuestion);

    const now = 1000000;
    // Create an item due for review
    const dueItem = createReviewQueueItem(sampleQuestion.id, sampleQuestion.conceptId, 'incorrect', now - 100000);
    dueItem.dueAt = now - 1000; // overdue
    dueItem.intervalDays = 1;
    await reviewQueueRepo.save(dueItem);

    // Build session plan
    const plan = buildDueReviewSessionPlan([dueItem], [sampleQuestion]);
    expect(plan.questions.length).toBe(1);
    expect(plan.questions[0].id).toBe(sampleQuestion.id);
    expect(plan.reviewMappings[sampleQuestion.id]).toBeDefined();
    expect(plan.reviewMappings[sampleQuestion.id].originatingItemIds).toEqual([dueItem.id]);

    // Construct study session with review mappings
    const session: StudySession = {
      id: 'session-due-1',
      name: 'Due Review Session',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots: [sampleQuestion],
      currentIndex: 0,
      answers: {
        [sampleQuestion.id]: {
          selectedOptionId: 'A', // correct!
          firstSubmittedOptionId: 'A',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 20,
          confidence: 'confident',
        },
      },
      reviewMappings: plan.reviewMappings,
    };

    // Authoritative finalization transaction
    const result = await sessionRepo.finalizeSessionTransaction(session, '2026-09-27', now);
    expect(result.success).toBe(true);
    expect(result.alreadyCompleted).toBe(false);

    // Verify queue in storage
    const allQueue = await reviewQueueRepo.getAll();
    // Exactly 1 item must exist: NO duplicate pending item created
    expect(allQueue.length).toBe(1);

    const updatedItem = allQueue[0];
    expect(updatedItem.id).toBe(dueItem.id);
    // Interval advanced from 1d to 3d
    expect(updatedItem.intervalDays).toBe(3);
    expect(updatedItem.dueAt).toBe(now + 3 * 24 * 60 * 60 * 1000);
    expect(updatedItem.reviewCount).toBe(1);
    expect(updatedItem.lastReviewedAt).toBe(now);
    expect(updatedItem.status).toBe('pending');
  });

  it('keeps correct-but-marked-guessed attempts in practice at 1-day interval rather than graduating', async () => {
    await questionRepo.save(sampleQuestion);

    const now = 2000000;
    // An item already at 7 days
    const itemAtStage2 = createReviewQueueItem(sampleQuestion.id, sampleQuestion.conceptId, 'incorrect', now - 100000);
    itemAtStage2.intervalDays = 7;
    itemAtStage2.reviewCount = 2;
    await reviewQueueRepo.save(itemAtStage2);

    const plan = buildDueReviewSessionPlan([itemAtStage2], [sampleQuestion]);

    // Student answers correctly, but marks 'guessed'
    const session: StudySession = {
      id: 'session-due-guessed',
      name: 'Guessed Review Session',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots: [sampleQuestion],
      currentIndex: 0,
      answers: {
        [sampleQuestion.id]: {
          selectedOptionId: 'A', // correct!
          firstSubmittedOptionId: 'A',
          confidence: 'guessed', // BUT guessed/unsure!
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 25,
        },
      },
      reviewMappings: plan.reviewMappings,
    };

    await sessionRepo.finalizeSessionTransaction(session, '2026-09-27', now);

    const allQueue = await reviewQueueRepo.getAll();
    expect(allQueue.length).toBe(1);
    const updated = allQueue[0];

    // Must remain in practice at 1-day interval, never graduate
    expect(updated.intervalDays).toBe(1);
    expect(updated.dueAt).toBe(now + 1 * 24 * 60 * 60 * 1000);
    expect(updated.status).toBe('pending');
    expect(updated.reviewCount).toBe(3);
  });

  it('resolves alternate questions with matching concept and maps results back to originating item', async () => {
    await questionRepo.saveBatch([sampleQuestion, alternateQuestion]);

    const now = 3000000;
    const dueItem = createReviewQueueItem(sampleQuestion.id, sampleQuestion.conceptId, 'incorrect', now - 50000);
    dueItem.dueAt = now - 1000;
    await reviewQueueRepo.save(dueItem);

    // Plan resolves alternate question because alternate has same conceptId and is approved
    const plan = buildDueReviewSessionPlan([dueItem], [sampleQuestion, alternateQuestion]);
    expect(plan.questions.length).toBe(1);
    expect(plan.questions[0].id).toBe(alternateQuestion.id); // alternate was selected!
    expect(plan.reviewMappings[alternateQuestion.id]).toBeDefined();
    expect(plan.reviewMappings[alternateQuestion.id].wasAlternate).toBe(true);
    expect(plan.reviewMappings[alternateQuestion.id].originatingItemIds).toEqual([dueItem.id]);
    expect(plan.reviewMappings[alternateQuestion.id].originalQuestionIds).toEqual([sampleQuestion.id]);

    // Student completes the session answering the alternate question
    const session: StudySession = {
      id: 'session-alternate-1',
      name: 'Alternate Review Session',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots: [alternateQuestion],
      currentIndex: 0,
      answers: {
        [alternateQuestion.id]: {
          selectedOptionId: 'A', // correct on alternate
          firstSubmittedOptionId: 'A',
          confidence: 'confident',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 18,
        },
      },
      reviewMappings: plan.reviewMappings,
    };

    await sessionRepo.finalizeSessionTransaction(session, '2026-09-27', now);

    const allQueue = await reviewQueueRepo.getAll();
    expect(allQueue.length).toBe(1);
    // Originating item was advanced!
    expect(allQueue[0].id).toBe(dueItem.id);
    expect(allQueue[0].intervalDays).toBe(3);
    expect(allQueue[0].reviewCount).toBe(1);
  });

  it('deterministically updates multiple originating items that resolve to the same question', async () => {
    await questionRepo.save(sampleQuestion);

    const now = 4000000;
    const item1 = createReviewQueueItem(sampleQuestion.id, sampleQuestion.conceptId, 'incorrect', now - 20000);
    const item2 = createReviewQueueItem(sampleQuestion.id, sampleQuestion.conceptId, 'guessed', now - 10000);
    await reviewQueueRepo.saveBatch([item1, item2]);

    const plan = buildDueReviewSessionPlan([item1, item2], [sampleQuestion]);
    expect(plan.questions.length).toBe(1);
    const mapping = plan.reviewMappings[sampleQuestion.id];
    expect(mapping.originatingItemIds).toHaveLength(2);
    expect(mapping.originatingItemIds).toContain(item1.id);
    expect(mapping.originatingItemIds).toContain(item2.id);

    const session: StudySession = {
      id: 'session-multi-resolve',
      name: 'Multi Resolve Session',
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots: [sampleQuestion],
      currentIndex: 0,
      answers: {
        [sampleQuestion.id]: {
          selectedOptionId: 'B', // Incorrect!
          firstSubmittedOptionId: 'B',
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 22,
        },
      },
      reviewMappings: plan.reviewMappings,
    };

    await sessionRepo.finalizeSessionTransaction(session, '2026-09-27', now);

    const allQueue = await reviewQueueRepo.getAll();
    expect(allQueue).toHaveLength(2);
    // Both items must be updated to 1d interval for incorrect attempt
    for (const item of allQueue) {
      expect(item.intervalDays).toBe(1);
      expect(item.reviewCount).toBe(1);
      expect(item.status).toBe('pending');
    }
  });

  it('preserves demo versus educational content boundaries during alternate resolution', () => {
    const demoOriginal: Question = {
      ...sampleQuestion,
      id: 'demo-orig',
      contentKind: 'demo',
      conceptId: 'concept-shared',
    };
    const educationalCandidate: Question = {
      ...alternateQuestion,
      id: 'edu-cand',
      contentKind: 'educational',
      conceptId: 'concept-shared',
    };

    const item = createReviewQueueItem(demoOriginal.id, demoOriginal.conceptId);
    // Even though conceptId matches, educational question must NEVER resolve for a demo item!
    const resolution = resolveReviewQuestion(item, [demoOriginal, educationalCandidate]);
    expect(resolution).not.toBeNull();
    expect(resolution!.question.id).toBe(demoOriginal.id);
    expect(resolution!.isOriginal).toBe(true);
  });

  it('explicitly reports unresolvable items and does not credit completion for them', () => {
    const orphanItem = createReviewQueueItem('non-existent-question-id', 'concept-x');
    const plan = buildDueReviewSessionPlan([orphanItem], [sampleQuestion]);

    expect(plan.questions).toHaveLength(0);
    expect(plan.unresolvableItemIds).toContain(orphanItem.id);
  });
});
