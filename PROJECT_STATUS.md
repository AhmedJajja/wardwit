# WardWit — Project Status & Architecture Report

## 1. Executive Summary & Verification State
- **Product Name**: WardWit (Replaceable internal code name)
- **Target Audience**: Pakistani MBBS students preparing for USMLE Step 1
- **Design Philosophy**: Medical campus meets playful field notebook (warm ivory palette, dark ink text, deep teal controls, coral/marigold/mint accents, rounded cards with offset shadows, custom SVG mascot "Clip")
- **Phase 2 Status**: **Complete & Verified**
  - **Unit & Logic Tests**: 24/24 Vitest tests passing across 9 test suites (`npm run test`)
  - **TypeScript & Bundle Build**: Pass (`tsc -b && vite build`) with 0 errors
  - **Browser E2E Verification**: Verified via autonomous browser subagent sessions verifying interactive workflows:
    - Study Plan & 5-Question Sprint creation
    - In-exam Question Reporting with honest local-only notices
    - Answer submission & Error Notebook reflection logging
    - Error Notebook inspection, filtering, and 1-click Flashcard conversion
    - Flashcard flip review and spaced repetition rating
    - Honest Analytics with first-attempt vs repeat-attempt accuracy and practice signal rules
    - Local Content Workspace question editor, dry-run validation preview, and local report review inbox

---

## 2. Phase 2 Features Implemented

### 1. Daily Study Plan
- **Goal Configuration**: Uses student's chosen daily question goal and preferred study days from onboarding or settings.
- **Unfinished Session Resume**: High-priority resume pill in navbar and dashboard whenever an unfinalized session exists.
- **Capacity Diagnostics**: When the available question bank has fewer unused questions than the daily goal, an honest diagnostic banner explains the content constraint without inventing fake questions or assigning duplicates within a session.
- **Rest Days**: Shows encouragement and rest message when today is an unscheduled study day, with zero punitive streak drops or reprimands.
- **5-Question Sprint**: One-click quick session generator when at least 5 eligible questions exist.

### 2. Spaced Review Queue
- **Configurable Ladder**: Simple 4-stage interval review system:
  - Stage 1: +1 day
  - Stage 2: +3 days
  - Stage 3: +7 days
  - Stage 4: +14 days
- **Queue Ingestion**: Missed questions and guessed/uncertain answers automatically enter the review queue.
- **Concept Matching**: Tracks `conceptId`. When an approved alternate question testing the same concept is present in the bank, it is preferred for review. If none exists, the system explicitly indicates that the original question is being repeated.
- **No Hallucinated Content**: Strict prohibition against automatic generation of unreviewed medical questions.

### 3. Error Notebook
- **Student-Selected Mistake Causes**:
  - `knowledge_gap`: Didn't know fact or formula
  - `reasoning_mistake`: Fell for clinical distractor
  - `misread_question`: Missed a crucial negative or clue
  - `time_pressure`: Rushed calculation or skimmed vignette
  - `other`: Slip / lapse
- **Student Agency**: Causes are selected by the candidate, never automatically diagnosed by software.
- **Personal Takeaway & Notes**: Stores personalized learning points.
- **Interactive Tools**: Full-text search, filter by cause or topic, edit notes, jump to review original question version, and 1-click "Turn into Flashcard" generator.

### 4. Spaced Flashcards
- **Card Creator & Library**: Create personal flashcards from scratch or directly from Error Notebook entries.
- **Flip Card Review**: Intuitive front/back card flip interface.
- **Rating Ladder**:
  - *Again*: Reset interval (< 1 day)
  - *Difficult*: Advance conservatively (1 day)
  - *Remembered*: Advance interval (3 days initial, multiplied by 2x subsequently)
- **Honest Distinction**: Personal student cards are cleanly segregated from future editorially approved deck cards.

### 5. Honest Progress Reporting (No Fake Percentiles)
- **Metrics Tracked**:
  - Total questions attempted
  - Unique questions attempted
  - First-attempt accuracy with explicit denominator (e.g. `10 / 12 (83%)`)
  - Repeat-attempt accuracy tracked separately
  - Weekly study volume histogram
  - Topic-by-topic breakdown with actual attempt counts
- **Documented Practice Signals**:
  - `Insufficient Data`: Fewer than 3 attempts in topic
  - `Needs More Practice`: Accuracy < 60% with ≥ 3 attempts
  - `On Track`: Accuracy ≥ 60% with ≥ 3 attempts
- **Strict Honesty Guardrails**: Zero predicted USMLE 3-digit scores, zero pass probability claims, and zero national percentiles. All labels are documented as practice signals, not exam-readiness predictions.

### 6. Enjoyable & Meaningful Progress
- **Milestone Achievements**:
  - `first_step`: Complete first study block
  - `consistency_3`: Study on 3 distinct calendar days
  - `review_champion`: Complete 5 spaced reviews
  - `notebook_scholar`: Log 3 error notebook takeaways
  - `flashcard_novice`: Review 5 flashcards
  - `century_club`: Complete 100 question attempts
- **Milestone Integrity**: Badges are awarded strictly based on verified activity records. No rewards for rapid guessing or streak manipulation.
- **Quiet Mode**: Suppresses mascot quips, audio chimes, and confetti for students preferring a distraction-free clinical environment.

### 7. Local Content Workspace
- **Browser-Only Scope Notice**: Explicitly labelled as:
  > *"Local content workspace — browser-only; not a secured multi-user admin system."*
- **Question Lifecycle**: `draft` → `in_review` → `approved` → `archived`.
- **Metadata Fields**: Reference textbooks, editions/page numbers, image provenance, reviewer name/role, and review date.
- **Strict Approval Validation**: Questions cannot be marked `approved` without learning objectives, non-empty vignette, at least two options, valid correct option ID, explanation, and reviewer sign-off.
- **Dry-Run Import Preview**: Parses uploaded or sample JSON, detects duplicate IDs in file and existing bank, displays row-by-row validation status, and shows proposed inserts vs updates before committing.
- **Atomic Import**: Imports succeed in a single batch only if valid; invalid files are rejected with detailed diagnostics to prevent silent bank corruption.
- **Study Bank Isolation**: Only `approved` educational questions and explicit demo questions are eligible for study sessions. `draft` and `archived` questions never leak into sessions.
- **Untrusted Input Sanitization**: Text and HTML inputs are scrubbed of `<script>`, event handlers, and `javascript:` URLs.

### 8. Question Reporting System
- **Issue Types**:
  - Possible error in medical reasoning or answer key
  - Ambiguous or confusing vignette wording
  - Missing or broken diagram / image
  - Outdated content
  - Typo or formatting irregularity
- **Honest Local Scope**: Explicitly informs the candidate:
  > *"Reports are saved locally to your browser's Content Workspace inbox. They are not sent to an external medical team."*
- **Local Review Inbox**: Workspace tab displaying unresolved reports, question ID, version, timestamp, and resolve actions.

---

## 3. Directory & Module Architecture

```
src/
├── config/
│   ├── brand.config.ts         // Branding tokens, cultural Pakistani MBBS quips, theme colors
│   └── demoQuestions.ts        // 12 demonstration questions with conceptIds and editorial approval
├── domain/
│   ├── types.ts                // Extended domain types (SpacedReview, Flashcard, ErrorNotebook, Report, Achievement)
│   ├── scoring.ts              // Scoring engine, confidence matrix calculation, idempotent finalization
│   ├── eligibility.ts          // Question filtering (Unused, Incorrect, Flagged, Taxonomy) & count clamping
│   ├── timer.ts                // Deadline-based countdown math (now vs expiresAt)
│   ├── spacedReview.ts         // 4-stage interval ladder and concept resolution logic
│   ├── flashcardReview.ts      // Flashcard SRS scheduling and due filter
│   ├── analytics.ts            // First-attempt vs repeat accuracy, topic signals, weekly volume
│   ├── achievements.ts         // Milestone evaluation engine based strictly on verified records
│   └── studyPlan.ts            // Daily study plan generator with capacity diagnostics
├── persistence/
│   ├── db.ts                   // IndexedDB database (v2) with all 10 object stores
│   ├── repositories.ts         // Repository interfaces (IReviewQueue, IErrorNotebook, IFlashcard, etc.)
│   └── indexedDbRepo.ts        // Concrete IndexedDB implementation, dry-run parser, atomic importer, backup
├── components/
│   ├── mascot/
│   │   └── ClipMascot.tsx      // Original SVG clipboard mascot (welcome, focus, celebration, encouragement)
│   ├── common/
│   │   ├── Navbar.tsx          // Brand header, navigation buttons, due badges, quiet mode toggle
│   │   └── DisclaimerBanner.tsx// Standardized nonclinical demo disclaimer
│   ├── onboarding/
│   │   └── OnboardingModal.tsx // MBBS stage, optional college, exam date, daily goal, study days
│   ├── dashboard/
│   │   └── DashboardView.tsx   // Daily Study Plan, capacity notice, 5-Q sprint, due hub, milestones
│   ├── session-create/
│   │   └── CreateSessionView.tsx// Live matching count, pool selection, taxonomy filters, mode configuration
│   ├── player/
│   │   └── QuestionPlayerView.tsx// Question palette, flag, confidence rating, report modal, error log modal
│   ├── results/
│   │   └── ResultsView.tsx     // Score summary, pacing, confidence matrix, error logging, remediation
│   ├── error-notebook/
│   │   └── ErrorNotebookView.tsx// Mistake log, cause badges, search/filter, 1-click flashcard modal
│   ├── flashcards/
│   │   └── FlashcardsView.tsx  // Flip card review, SRS ratings, card library, manual card creator
│   ├── analytics/
│   │   └── AnalyticsView.tsx   // Honest metrics, first vs repeat accuracy table, topic signals
│   ├── workspace/
│   │   └── ContentWorkspaceView.tsx// Question editor, dry-run modal, reports inbox, sample export/import
│   └── settings/
│       └── SettingsView.tsx    // Profile, study days, daily goal, quiet mode, backup export/import, data reset
├── tests/
│   ├── eligibility.test.ts     // Pool logic, count clamping without silent duplication
│   ├── scoring.test.ts         // Scoring answered vs unanswered questions, confidence breakdown
│   ├── submission.test.ts      // Submission idempotence, tutor mode answer preservation
│   ├── timer.test.ts           // Deadline calculation, expiration detection
│   ├── snapshots.test.ts       // Question-version snapshot isolation
│   ├── spacedReview.test.ts    // Spaced review interval ladder and concept resolution
│   ├── flashcards.test.ts      // Flashcard intervals, ratings, due calculations
│   ├── analytics.test.ts       // First vs repeat accuracy, topic signals rules
│   └── contentImport.test.ts   // Dry-run parsing, validation rules, atomic import
├── App.tsx                     // Root application orchestrating stores and screen routing
├── index.css                   // Design system variables, offset shadows, typography, responsive rules
└── main.tsx                    // React 19 entry point
```

---

## 4. IndexedDB Storage Schema (v2)

| Object Store | KeyPath | Indices / Purpose |
|---|---|---|
| `questions` | `id` | `by-system`, `by-discipline`, `by-content-kind`. Local question bank items. |
| `sessions` | `id` | `by-status`, `by-created-at`. Immutable question snapshots and attempt logs. |
| `profiles` | `id` | `'default-profile'`. MBBS year, college, exam date, daily goal, study days. |
| `settings` | `key` | `'app-settings'`. Quiet mode, theme, font size, sound toggles. |
| `dailyActivity` | `date` | `YYYY-MM-DD`. Daily question count, correct count, blocks finished. |
| `reviewQueue` | `id` | `by-due-date`, `by-stage`. Spaced review items scheduled at 1d, 3d, 7d, 14d. |
| `errorNotebook`| `id` | `by-question-id`, `by-cause`. Mistake log with student-selected causes. |
| `flashcards` | `id` | `by-due-date`, `by-kind`. Personal and future deck flashcards with SRS intervals. |
| `questionReports` | `id` | `by-question-id`, `by-status`. Locally stored issue flags and editor resolutions. |
| `achievements` | `id` | `by-earned-at`. Milestone badges earned strictly through verified activity. |

---

## 5. Verified Test Suite Summary

Vitest run output:
```
✓ src/tests/flashcards.test.ts (3 tests)
✓ src/tests/eligibility.test.ts (3 tests)
✓ src/tests/submission.test.ts (2 tests)
✓ src/tests/scoring.test.ts (2 tests)
✓ src/tests/spacedReview.test.ts (5 tests)
✓ src/tests/timer.test.ts (3 tests)
✓ src/tests/snapshots.test.ts (1 test)
✓ src/tests/analytics.test.ts (2 tests)
✓ src/tests/contentImport.test.ts (3 tests)

Test Files  9 passed (9)
     Tests  24 passed (24)
  Duration  <500ms
```

---

## 6. Known Boundaries & Nonclinical Declarations
1. **Demo Content**: All 12 seed questions are biostatistics and cognitive heuristics items explicitly identified as nonclinical demonstrations.
2. **Local-Only Operation**: WardWit operates 100% in the user's browser via IndexedDB. Question reports and editor approvals are stored locally and are not transmitted to external servers.
3. **No Automated Medical Authoring**: The application does not use AI or unreviewed automated generation to write medical questions.
4. **Honest Metrics**: No pseudo-predictive USMLE 3-digit score models or national percentiles are simulated. Practice signals (`Insufficient Data`, `Needs More Practice`, `On Track`) follow explicit mathematical rules documented on screen.
