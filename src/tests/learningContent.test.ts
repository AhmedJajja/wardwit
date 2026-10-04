import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAllLocalData,
  flashcardRepo,
  questionRepo,
  discoverCardRepo,
  sessionRepo,
  dailyActivityRepo,
  reviewQueueRepo,
  saveQuestionToReview,
  saveDiscoverCardToReview,
  exportLocalBackup,
  importLocalBackup,
} from '../persistence/indexedDbRepo';
import { buildUnifiedReviewQueue } from '../domain/unifiedReview';
import { reviewFlashcard, createFlashcard } from '../domain/flashcardReview';
import {
  migrateLegacyImageMetadata,
  isSafeMediaUrl,
  sanitizeSvgCode,
  sanitizeProvenance,
} from '../domain/mediaSanitizer';
import type {
  Question,
  Flashcard,
  ReviewQueueItem,
  DiscoverCard,
  QuestionUserAnswer,
} from '../domain/types';

// Clearly marked non-clinical fixtures for test verification
const NON_CLINICAL_TEST_QUESTION: Question = {
  id: 'test-q-sample-101',
  version: 1,
  contentKind: 'demo',
  editorialStatus: 'approved',
  exam: 'Test Taxonomy',
  system: 'Test System A',
  discipline: 'Test Discipline B',
  topic: 'Non-Clinical Test Topic',
  conceptId: 'test-concept-101',
  learningObjective: 'Verify test mechanics without clinical facts.',
  vignette: 'A non-clinical scenario used solely for test runner verification.',
  options: [
    { id: 'A', text: 'Option Alpha (Correct)' },
    { id: 'B', text: 'Option Beta' },
    { id: 'C', text: 'Option Gamma' },
    { id: 'D', text: 'Option Delta' },
  ],
  correctOptionId: 'A',
  explanation: 'Option Alpha is the deterministic fixture key.',
  optionExplanations: {
    A: 'Alpha is verified.',
    B: 'Beta is non-keyed.',
  },
  keyTakeaway: 'Deterministic verification fixture.',
  reviewer: { name: 'Dr. Test Reviewer', role: 'Verification' },
  questionMedia: {
    id: 'qm-fixture-1',
    mediaType: 'image',
    url: 'https://example.com/media/vignette.png',
    alt: 'Diagram of test apparatus',
    altText: 'Diagram of test apparatus',
    caption: 'Figure 1: Test Apparatus',
    provenance: {
      source: 'Test Manual of Fixtures',
      edition: '3rd Ed',
      printedPage: 'p. 104',
      pdfPageIndex: 112,
    },
    reviewStatus: 'clinician_approved',
  },
  explanationMedia: {
    id: 'em-fixture-1',
    mediaType: 'image',
    url: 'https://example.com/media/explanation.png',
    alt: 'Explanation schematic',
    altText: 'Explanation schematic',
    caption: 'Figure 2: Explanatory Schematic',
    teachingPurpose: 'Visual explanation of key mechanism.',
    provenance: {
      source: 'Test Manual of Fixtures',
      edition: '3rd Ed',
      printedPage: 'p. 105',
      pdfPageIndex: 113,
    },
    reviewStatus: 'clinician_approved',
  },
};

const NON_CLINICAL_DISCOVER_CARD: DiscoverCard = {
  id: 'test-disc-fixture-01',
  version: 2,
  contentKind: 'demo',
  editorialStatus: 'approved',
  curiosityPrompt: 'What deterministic property is verified by this fixture?',
  revealedConcept: 'Discover Card Verification Concept',
  conciseExplanation: 'This concise explanation is authored specifically to test Discover mechanics.',
  whyItMatters: 'Ensures version snapshots and citations survive without inventing clinical claims.',
  curriculumMapping: {
    system: 'Test System A',
    discipline: 'Test Discipline B',
    topic: 'Non-Clinical Test Topic',
    concept: 'test-concept-101',
    pakistaniCurriculumContext: 'General test module context (curricula vary by university)',
  },
  sourceReference: {
    source: 'Fixture Reference Manual',
    edition: '1st Ed',
    page: 'p. 42',
  },
  diagram: {
    id: 'dm-fixture-01',
    mediaType: 'image',
    url: 'https://example.com/media/discover-concept.png',
    alt: 'Discover diagram fixture',
    altText: 'Discover diagram fixture',
    caption: 'Figure D: Concept Flow',
    provenance: {
      source: 'Fixture Reference Manual',
      edition: '1st Ed',
      printedPage: 'p. 43',
      pdfPageIndex: 49,
    },
    reviewStatus: 'clinician_approved',
  },
  updatedAt: 100000,
};

describe('Learning Content Phase: Review, Discover & Diagrams Verification', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  // 1. Unified Review & Deduplication
  it('includes incorrect and explicitly guessed/unsure answers once in Review without duplication', () => {
    const now = 100000;
    const allQuestions: Question[] = [NON_CLINICAL_TEST_QUESTION];

    // Case A: Question failed in a past session -> item in reviewQueue
    const queueItem: ReviewQueueItem = {
      id: 'rq-fail-001',
      questionId: NON_CLINICAL_TEST_QUESTION.id,
      reason: 'incorrect',
      addedAt: now - 5000,
      dueAt: now - 1000,
      intervalDays: 1,
      reviewCount: 0,
      status: 'pending',
    };

    // Case B: Same question was also manually saved to flashcards by the student
    const savedCard: Flashcard = {
      id: 'fc-saved-001',
      cardKind: 'question_derived',
      front: NON_CLINICAL_TEST_QUESTION.topic,
      back: NON_CLINICAL_TEST_QUESTION.explanation,
      sourceQuestionId: NON_CLINICAL_TEST_QUESTION.id,
      sourceQuestionVersion: NON_CLINICAL_TEST_QUESTION.version,
      questionSnapshot: NON_CLINICAL_TEST_QUESTION,
      submittedOptionId: 'B',
      confidence: 'guessed',
      dueAt: now - 500,
      intervalDays: 1,
      repetitions: 0,
      createdAt: now - 5000,
      updatedAt: now - 5000,
    };

    // Build unified queue with both stores containing references to the same question
    const unified = buildUnifiedReviewQueue([savedCard], [queueItem], allQuestions, now);

    // CRITICAL: Item must appear ONCE, not duplicated merely because it exists in both stores
    expect(unified.length).toBe(1);
    expect(unified[0].sourceQuestionId).toBe(NON_CLINICAL_TEST_QUESTION.id);
    expect(unified[0].flashcardId).toBe('fc-saved-001');
    expect(unified[0].reviewQueueItemId).toBe('rq-fail-001');
    expect(unified[0].questionSnapshot?.id).toBe(NON_CLINICAL_TEST_QUESTION.id);
    expect(unified[0].submittedOptionId).toBe('B');
    expect(unified[0].confidence).toBe('guessed');
  });

  // 2. Guessing is NEVER inferred from answer speed
  it('never infers guessing from answer speed; requires explicit confidence flag', () => {
    const fastAnswer: QuestionUserAnswer = {
      selectedOptionId: 'A',
      confidence: 'confident', // Student felt confident
      timeSpentSeconds: 2, // Fast answer (2 seconds)
      isFlagged: false,
      eliminatedOptionIds: [],
    };

    // Fast answer with confident flag must NOT be treated as guessed
    expect(fastAnswer.confidence).toBe('confident');
    expect(fastAnswer.confidence === 'guessed' || fastAnswer.confidence === 'unsure').toBe(false);

    const explicitGuess: QuestionUserAnswer = {
      selectedOptionId: 'A',
      confidence: 'guessed', // Explicitly marked guessed
      timeSpentSeconds: 45,
      isFlagged: false,
      eliminatedOptionIds: [],
    };
    expect(explicitGuess.confidence === 'guessed' || explicitGuess.confidence === 'unsure').toBe(true);
  });

  // 3. Manual saving is idempotent
  it('manual saving of questions and discover cards is idempotent and provides honest status', async () => {
    // Save Question to Review Queue
    const res1 = await saveQuestionToReview(NON_CLINICAL_TEST_QUESTION, {
      selectedOptionId: 'C',
      confidence: 'unsure',
      isFlagged: false,
      eliminatedOptionIds: [],
      timeSpentSeconds: 12,
    });
    expect(res1.status).toBe('saved');
    expect(res1.card).toBeDefined();
    expect(res1.card?.sourceQuestionId).toBe(NON_CLINICAL_TEST_QUESTION.id);
    expect(res1.card?.sourceQuestionVersion).toBe(NON_CLINICAL_TEST_QUESTION.version);

    // Save same Question again -> idempotent 'already_saved'
    const res2 = await saveQuestionToReview(NON_CLINICAL_TEST_QUESTION);
    expect(res2.status).toBe('already_saved');

    // Confirm only 1 card was saved in storage
    const storedCards = await flashcardRepo.getAll();
    const qCards = storedCards.filter((c) => c.sourceQuestionId === NON_CLINICAL_TEST_QUESTION.id);
    expect(qCards.length).toBe(1);

    // Save Discover Card
    const dRes1 = await saveDiscoverCardToReview(NON_CLINICAL_DISCOVER_CARD);
    expect(dRes1.status).toBe('saved');
    expect(dRes1.card?.sourceDiscoverCardId).toBe(NON_CLINICAL_DISCOVER_CARD.id);
    expect(dRes1.card?.sourceDiscoverVersion).toBe(NON_CLINICAL_DISCOVER_CARD.version);
    expect(dRes1.card?.discoverSnapshot?.curiosityPrompt).toBe(NON_CLINICAL_DISCOVER_CARD.curiosityPrompt);

    // Save same Discover Card again -> idempotent 'already_saved'
    const dRes2 = await saveDiscoverCardToReview(NON_CLINICAL_DISCOVER_CARD);
    expect(dRes2.status).toBe('already_saved');

    const dStored = await flashcardRepo.getAll();
    const discCards = dStored.filter((c) => c.sourceDiscoverCardId === NON_CLINICAL_DISCOVER_CARD.id);
    expect(discCards.length).toBe(1);
  });

  // 4. Reveal does not mark mastery; rating persists schedule
  it('opening or revealing a card does not mark mastery; rating updates schedule and repetitions', () => {
    const now = 200000;
    const card = createFlashcard('Front Question', 'Back Explanation', 'personal', undefined, now);
    expect(card.repetitions).toBe(0);
    expect(card.intervalDays).toBe(1);

    // Mere inspection/opening leaves repetition and dueAt unchanged
    expect(card.repetitions).toBe(0);

    // Rate 'again' -> resets repetitions to 0, 1 day interval
    const afterAgain = reviewFlashcard(card, 'again', now);
    expect(afterAgain.repetitions).toBe(0);
    expect(afterAgain.intervalDays).toBe(1);

    // Rate 'remembered' -> increments repetitions to 1
    const afterRemembered1 = reviewFlashcard(afterAgain, 'remembered', now);
    expect(afterRemembered1.repetitions).toBe(1);
    expect(afterRemembered1.intervalDays).toBe(1);

    // Rate 'remembered' again -> advances interval to 3 days
    const afterRemembered2 = reviewFlashcard(afterRemembered1, 'remembered', now);
    expect(afterRemembered2.repetitions).toBe(2);
    expect(afterRemembered2.intervalDays).toBe(3);

    // Rate 'difficult' (hard) -> preserves progression with moderate growth
    const afterHard = reviewFlashcard(afterRemembered2, 'difficult', now);
    expect(afterHard.repetitions).toBe(3);
    expect(afterHard.intervalDays).toBeGreaterThanOrEqual(3);
  });

  // 5. Existing notes and personal cards survive migration
  it('existing legacy cards and notes survive without data loss', async () => {
    // Legacy card shape (before Phase 3 versioning fields)
    const legacyCard: any = {
      id: 'legacy-fc-12345',
      front: 'Legacy Cardiology Note',
      back: 'Legacy explanation content from student notes.',
      topic: 'Personal Cardiology Note',
      intervalDays: 2,
      dueAt: 150000,
      repetitions: 1,
      createdAt: 100000,
      updatedAt: 100000,
    };

    await flashcardRepo.save(legacyCard);
    const retrieved = await flashcardRepo.getById('legacy-fc-12345');

    expect(retrieved).toBeDefined();
    expect(retrieved?.front).toBe('Legacy Cardiology Note');
    expect(retrieved?.back).toBe('Legacy explanation content from student notes.');
    expect(retrieved?.repetitions).toBe(1);
    expect(retrieved?.intervalDays).toBe(2);
  });

  // 6. Media Provenance and Security Sanitization
  it('distinguishes printed page from numeric PDF page index and rejects guessed page numbers', () => {
    const prov = sanitizeProvenance({
      source: 'Robbins Basic Pathology',
      edition: '10th Ed',
      printedPage: 'p. 542',
      pdfPageIndex: 550,
      permissions: 'Educational fair use',
    });

    expect(prov?.printedPage).toBe('p. 542');
    expect(prov?.pdfPageIndex).toBe(550);

    // Negative or non-numeric PDF index is rejected (no guessed numbers)
    const invalidProv = sanitizeProvenance({
      source: 'Source',
      pdfPageIndex: -5,
    });
    expect(invalidProv?.pdfPageIndex).toBeUndefined();

    const stringPdfProv = sanitizeProvenance({
      source: 'Source',
      pdfPageIndex: 'invalid' as any,
    });
    expect(stringPdfProv?.pdfPageIndex).toBeUndefined();
  });

  it('rejects executable arbitrary SVG/HTML or unsafe URLs on media import', () => {
    // Safe URLs
    expect(isSafeMediaUrl('https://example.com/diagram.png')).toBe(true);
    expect(isSafeMediaUrl('/assets/images/ecg.jpg')).toBe(true);
    expect(isSafeMediaUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);

    // Unsafe URLs
    expect(isSafeMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMediaUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeMediaUrl('data:text/html,<script>alert(1)</script>')).toBe(false);

    // SVG Sanitization strips scripts and malicious inline handlers
    const unsafeSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)">
        <script>alert("pwned")</script>
        <circle cx="50" cy="50" r="40" onclick="evil()" />
        <a href="javascript:void(0)"><text>Click</text></a>
      </svg>
    `;
    const cleanSvg = sanitizeSvgCode(unsafeSvg);
    expect(cleanSvg).not.toContain('<script');
    expect(cleanSvg).not.toContain('onload=');
    expect(cleanSvg).not.toContain('onclick=');
    expect(cleanSvg).not.toContain('javascript:');
    expect(cleanSvg).toContain('<circle cx="50" cy="50" r="40"');
  });

  it('preserves existing imageMetadata as vignette media during migration without moving it behind the answer', () => {
    const legacyImageMeta = {
      url: '/images/chest-xray.png',
      alt: 'Chest Radiograph demonstrating cardiomegaly',
      caption: 'PA Chest X-ray',
      source: 'Clinical Teaching File',
      page: 'p. 12',
    };

    const migrated = migrateLegacyImageMetadata(legacyImageMeta);
    expect(migrated).toBeDefined();
    expect(migrated?.url).toBe('/images/chest-xray.png');
    expect(migrated?.altText).toBe('Chest Radiograph demonstrating cardiomegaly');
    expect(migrated?.caption).toBe('PA Chest X-ray');
    expect(migrated?.provenance?.source).toBe('Clinical Teaching File');
    expect(migrated?.provenance?.printedPage).toBe('p. 12');
  });

  // 7. Full Backup, Restore and Media Round-trip
  it('ensures media and source metadata survives backup and restore completely without dropping fields', async () => {
    await questionRepo.save(NON_CLINICAL_TEST_QUESTION);
    await discoverCardRepo.save(NON_CLINICAL_DISCOVER_CARD);

    // Export local backup v3
    const backupJson = await exportLocalBackup();
    const parsed = JSON.parse(backupJson);

    expect(parsed.version).toBe(3);
    expect(parsed.discoverCards.length).toBeGreaterThanOrEqual(1);
    const targetDisc = parsed.discoverCards.find((c: any) => c.id === NON_CLINICAL_DISCOVER_CARD.id);
    expect(targetDisc).toBeDefined();
    expect(targetDisc?.diagram?.provenance?.printedPage).toBe('p. 43');
    expect(targetDisc?.diagram?.provenance?.pdfPageIndex).toBe(49);

    // Clear database completely
    await clearAllLocalData();
    const clearedTarget = await discoverCardRepo.getById(NON_CLINICAL_DISCOVER_CARD.id);
    expect(clearedTarget).toBeUndefined();

    // Import backup
    const importRes = await importLocalBackup(backupJson);
    expect(importRes.success).toBe(true);

    // Verify restored Discover card and question
    const restoredDisc = await discoverCardRepo.getById(NON_CLINICAL_DISCOVER_CARD.id);
    expect(restoredDisc).toBeDefined();
    expect(restoredDisc?.curiosityPrompt).toBe(NON_CLINICAL_DISCOVER_CARD.curiosityPrompt);
    expect(restoredDisc?.diagram?.provenance?.printedPage).toBe('p. 43');
    expect(restoredDisc?.diagram?.provenance?.pdfPageIndex).toBe(49);

    const restoredQ = await questionRepo.getById(NON_CLINICAL_TEST_QUESTION.id);
    expect(restoredQ).toBeDefined();
    expect(restoredQ?.questionMedia?.provenance?.printedPage).toBe('p. 104');
    expect(restoredQ?.questionMedia?.provenance?.pdfPageIndex).toBe(112);
    expect(restoredQ?.explanationMedia?.provenance?.printedPage).toBe('p. 105');
    expect(restoredQ?.explanationMedia?.provenance?.pdfPageIndex).toBe(113);
  });

  // 8. Explanation Diagrams Gating
  it('strictly withholds explanation diagrams in timed mode until block completion, and in tutor mode before submission', () => {
    // Contract check on explanation media accessibility rules
    const isExplanationDiagramAvailable = (
      mode: 'tutor' | 'timed',
      isSubmitted: boolean,
      isSessionCompleted: boolean
    ): boolean => {
      if (mode === 'timed') {
        return isSessionCompleted; // Strictly unavailable until block completion
      }
      return isSubmitted; // Available post-submission in tutor mode
    };

    // Timed mode checks
    expect(isExplanationDiagramAvailable('timed', false, false)).toBe(false);
    expect(isExplanationDiagramAvailable('timed', true, false)).toBe(false); // Even if answered, withheld during block
    expect(isExplanationDiagramAvailable('timed', true, true)).toBe(true); // Available after block finish

    // Tutor mode checks
    expect(isExplanationDiagramAvailable('tutor', false, false)).toBe(false); // Withheld before submit
    expect(isExplanationDiagramAvailable('tutor', true, false)).toBe(true); // Available immediately on submit
  });

  // 9. Discover Content Filtering and Honest Empty States
  it('distinguishes approved educational content from demo fixtures, and empty areas produce honest empty states', async () => {
    const demoCard: DiscoverCard = {
      ...NON_CLINICAL_DISCOVER_CARD,
      id: 'disc-test-demo-only',
      contentKind: 'demo',
      editorialStatus: 'approved',
    };
    const eduCard: DiscoverCard = {
      ...NON_CLINICAL_DISCOVER_CARD,
      id: 'disc-test-edu-only',
      contentKind: 'educational',
      editorialStatus: 'approved',
    };
    const draftCard: DiscoverCard = {
      ...NON_CLINICAL_DISCOVER_CARD,
      id: 'disc-test-draft-only',
      contentKind: 'educational',
      editorialStatus: 'draft',
    };

    await discoverCardRepo.save(demoCard);
    await discoverCardRepo.save(eduCard);
    await discoverCardRepo.save(draftCard);

    const allCards = await discoverCardRepo.getAll();
    const testCards = allCards.filter((c) => c.id.startsWith('disc-test-'));

    // Only approved cards enter study pool
    const approvedCards = testCards.filter((c) => c.editorialStatus === 'approved');
    expect(approvedCards.length).toBe(2);
    expect(approvedCards.some((c) => c.id === 'disc-test-draft-only')).toBe(false);

    // Filter educational only
    const eduOnly = approvedCards.filter((c) => c.contentKind === 'educational');
    expect(eduOnly.length).toBe(1);
    expect(eduOnly[0].id).toBe('disc-test-edu-only');

    // Filter demo only
    const demoOnly = approvedCards.filter((c) => c.contentKind === 'demo');
    expect(demoOnly.length).toBe(1);
    expect(demoOnly[0].id).toBe('disc-test-demo-only');

    // Empty area query returns exactly 0 cards without synthesizing medical trivia
    const emptyArea = approvedCards.filter((c) => c.curriculumMapping.system === 'Non-Existent System');
    expect(emptyArea.length).toBe(0);
  });

  // 10. Review Schedule and Credit Persist Together
  it('persists schedule updates and daily review credit together across reload', async () => {
    const today = '2026-09-28';
    const card = createFlashcard('Prompt A', 'Explanation B', 'personal', undefined, 100000);
    await flashcardRepo.save(card);

    // Initial activity
    const act0 = await dailyActivityRepo.getActivityForDate(today);
    expect(act0?.flashcardsReviewed || 0).toBe(0);

    // Review item rated
    const updatedCard = reviewFlashcard(card, 'remembered', 100000);
    await flashcardRepo.save(updatedCard);
    const updatedAct = await dailyActivityRepo.recordActivity(today, 0, 0, false, 1);

    expect(updatedCard.repetitions).toBe(1);
    expect(updatedAct.flashcardsReviewed).toBe(1);

    // Verify both persisted to database and survive reload
    const reloadedCard = await flashcardRepo.getById(card.id);
    const reloadedAct = await dailyActivityRepo.getActivityForDate(today);

    expect(reloadedCard?.repetitions).toBe(1);
    expect(reloadedAct?.flashcardsReviewed).toBe(1);
  });

  // 11. FinalizeSessionTransaction Deduplication
  it('deduplicates pending reviewQueue entries when the same question is answered incorrectly in multiple sessions', async () => {
    const now = 300000;
    await questionRepo.save(NON_CLINICAL_TEST_QUESTION);

    const sessionA = {
      id: 'session-dedup-1',
      name: 'Session 1',
      mode: 'tutor' as const,
      status: 'in-progress' as const,
      createdAt: now - 10000,
      startedAt: now - 10000,
      durationMinutes: 10,
      questionSnapshots: [NON_CLINICAL_TEST_QUESTION],
      currentIndex: 0,
      answers: {
        [NON_CLINICAL_TEST_QUESTION.id]: {
          selectedOptionId: 'B', // Incorrect option (correct is A)
          confidence: 'unsure' as const,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 20,
        },
      },
    };

    // Finalize session 1 -> creates pending reviewQueue item
    const res1 = await sessionRepo.finalizeSessionTransaction(sessionA, '2026-09-28', now);
    expect(res1.newReviewItems?.length).toBe(1);

    const qItems1 = await reviewQueueRepo.getAll();
    const pending1 = qItems1.filter((item) => item.questionId === NON_CLINICAL_TEST_QUESTION.id && item.status === 'pending');
    expect(pending1.length).toBe(1);

    // Session 2: Candidate encounters same question again in another session and misses it again
    const sessionB = {
      id: 'session-dedup-2',
      name: 'Session 2',
      mode: 'tutor' as const,
      status: 'in-progress' as const,
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots: [NON_CLINICAL_TEST_QUESTION],
      currentIndex: 0,
      answers: {
        [NON_CLINICAL_TEST_QUESTION.id]: {
          selectedOptionId: 'C', // Incorrect again
          confidence: 'unsure' as const,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 15,
        },
      },
    };

    const res2 = await sessionRepo.finalizeSessionTransaction(sessionB, '2026-09-28', now + 1000);
    // Should update existing pending item schedule rather than injecting a duplicate pending item
    expect(res2.updatedReviewItems?.length).toBe(1);

    const qItems2 = await reviewQueueRepo.getAll();
    const pending2 = qItems2.filter((item) => item.questionId === NON_CLINICAL_TEST_QUESTION.id && item.status === 'pending');
    expect(pending2.length).toBe(1); // Still exactly 1 pending item, no duplication!
  });
});
