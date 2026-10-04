# WardWit — Project Status & Architecture Report

## 1. Executive Summary & Verification State
- **Product Name**: WardWit (Replaceable internal code name)
- **Target Audience**: Pakistani MBBS students preparing for USMLE Step 1
- **Design Philosophy**: Medical campus meets playful field notebook (warm ivory palette, dark ink text, deep teal controls, coral/marigold/mint accents, rounded cards with offset shadows, custom SVG mascot "Clip")
- **Audit & Verification Phase**: **Complete, Repaired & Verified**
  - **Unit & Logic Tests**: 42/42 Vitest tests passing across 13 test suites (`npm run test`)
  - **TypeScript & Production Build**: Pass (`tsc -b && vite build`) with 0 errors
  - **Browser E2E Multi-Viewport Verification**: Verified via autonomous browser subagent sessions across 360px (mobile), 768px (tablet), and 1440px/1920px (desktop) viewports:
    - First launch onboarding validation & study days enforcement
    - Direct URL hash routing (`#/dashboard`, `#/create-session`, `#/player`, `#/results?sessionId=...`, `#/error-notebook`, `#/flashcards`, `#/analytics`, `#/workspace`, `#/settings`)
    - Browser back and forward button history navigation
    - Content bank source filtering (educational vs demo vs all approved)
    - Accessible option selection via keyboard (Space, Enter) and screen-reader `role="radio"`
    - Inactive tab timer deadline persistence via `visibilitychange`
    - Idempotent session finalization preventing duplicate review queue items and inflated daily counts
    - Error notebook logging, full-text search, and 1-click flashcard conversion
    - Flashcard flip review and SRS interval calculations
    - Content workspace draft creation, editing, deletion, dry-run JSON preview, and reports review inbox
    - Settings updates, study-day validation, JSON export/import backup, and data wipe
    - Results route refresh and unknown ID recovery path
    - Failure retry banner and input retention on storage failure

---

## 2. Defects Identified and Fixed During Audit

| Defect # | Category | Component | Root Cause & Resolution |
|---|---|---|---|
| **DEF-01** | Routing / Navigation | `src/App.tsx` | **Direct URL & Browser Back/Forward Broken**: Navigation was purely internal React state. Direct links or refreshing reset the view to dashboard. **Fixed**: Implemented URL hash routing with `window.location.hash`, `hashchange` listener, and bidirectional sync supporting all 9 major app screens. |
| **DEF-02** | Data Integrity | `src/App.tsx` | **Session Submission Idempotence**: Rapid double-clicking or re-finalizing an already completed session could re-increment daily questions and inject duplicate items into the review queue. **Fixed**: Added strict guard in `handleFinishSession` checking `existingSession.status === 'completed' && existingSession.score` to return immediately. |
| **DEF-03** | Error Handling | `src/App.tsx` | **Silent Storage Failures**: Unhandled IndexedDB exceptions were silently swallowed without user feedback. **Fixed**: Wrapped all IndexedDB persistence mutations in structured try/catch blocks with a visible, dismissible `storageError` banner in the UI. |
| **DEF-04** | Pacing / Timing | `src/components/player/QuestionPlayerView.tsx` | **Background Tab Timer Throttling**: Browser background tab throttling could delay timed session expiration when the tab was inactive. **Fixed**: Implemented document `visibilitychange` listener and initial mount timestamp calculation against `expiresAt`, immediately finalizing expired sessions when the candidate returns. Added `isSubmittingRef` race-condition guard. |
| **DEF-05** | Accessibility | `src/components/player/QuestionPlayerView.tsx` | **Option Radio Roles & Keyboard Support**: Option cards used `role="checkbox"` and only listened for `Enter` key. **Fixed**: Updated semantic role to `role="radio"` with `aria-checked`, added Spacebar (`' '`) and `Enter` key handling, and prevented eliminated options from being selected via keyboard. |
| **DEF-06** | Responsive Layout | `src/components/player/QuestionPlayerView.tsx` | **Mobile Modal Overflow**: Submission confirmation, question reporting, and error logging dialogs lacked vertical scroll constraints on small screens (<400px). **Fixed**: Added `maxHeight: '90vh'` and `overflowY: 'auto'` with responsive padding. |
| **DEF-07** | Content Isolation | `src/domain/eligibility.ts`, `src/components/session-create/CreateSessionView.tsx` | **Demo vs Educational Cross-Contamination**: Question filtering lacked an explicit filter for content kind, allowing demo items and educational questions to mix unintentionally. **Fixed**: Added `contentKind?: 'all' \| 'educational' \| 'demo'` to `SessionFilterCriteria`, enforced in `filterQuestionsForSession`, added UI bank source selector cards, and added test coverage. |
| **DEF-08** | Security | `src/components/player/QuestionPlayerView.tsx` | **Unvalidated Media Rendering**: Vignette diagrams could theoretically render unsafe image schemes. **Fixed**: Added URL scheme validation checking for `https://`, `http://`, or `data:image/` before rendering `<img>` elements. |
| **DEF-09** | Validation | `src/components/onboarding/OnboardingModal.tsx`, `src/components/settings/SettingsView.tsx` | **Zero Study Days Bug**: Users could deselect all 7 study days, causing the daily study planner to permanently report rest days and break pacing. **Fixed**: Added validation enforcing at least 1 selected study day with visible inline error messaging in both onboarding and settings views. |
| **DEF-10** | Content Workspace | `src/components/workspace/ContentWorkspaceView.tsx` | **Missing Draft Deletion & Dry-Run Type Mismatch**: Content authors could not delete unwanted drafts, and dry-run import called `dryRunImportQuestions` with an object array instead of a JSON string. **Fixed**: Added `onDeleteQuestion` with confirmation dialog and restored the `Archive` button. Updated dry-run import invocation to stringify payload and handle structured `{ success, summary }` response. |
| **DEF-11** | Truthfulness | `src/components/analytics/AnalyticsView.tsx` | **Overstated "Mastery" Phrasing**: Mascot dialogue claimed "repeats show review mastery". **Fixed**: Replaced with honest statement: "repeat attempts measure spaced review retention". |
| **DEF-12** | Question Player | `src/components/player/QuestionPlayerView.tsx` | **Unimplemented Scratchpad & Strikethrough Shortcuts**: Previous reports claimed a Scratchpad drawer and `Alt+S` / `Alt+1-5` shortcuts existed when they were only partially or not implemented. **Fixed**: Built a dedicated in-exam Scratchpad drawer in `QuestionPlayerView.tsx` with auto-save to `session.answers[q.id].scratchpadNote`, `Alt+S` toggle button and shortcut, and `Alt+1`..`Alt+5` / `Alt+A`..`Alt+E` keyboard strikethrough elimination. |
| **DEF-13** | Flashcards | `src/components/flashcards/FlashcardsView.tsx` | **Missing Two-Way / Reverse Flashcards & Kind Filters**: Prompt 2 required support for reversing Q/A and filtering by personal notes vs approved cards. **Fixed**: Added a "Prompt: Back Side" toggle in Review mode, "Swap Front ⇄ Back" and two-way card creation in the Create Modal, card-level "Swap" button in Library, and `kindFilter` pills (`All`, `Personal`, `Approved Demo`). |
| **DEF-14** | Onboarding | `src/App.tsx` | **Onboarding Skip Not Persisted**: Clicking "Skip for Now" did not persist `onboardingCompleted: true` to IndexedDB, causing the onboarding modal to reappear on every page refresh. **Fixed**: Updated `handleSkipOnboarding` to save `onboardingCompleted: true`. |
| **DEF-15** | Error Notebook | `src/App.tsx` | **Error Notebook Jump to Question Failed for Non-Master Bank Items**: Clicking "Launch Review Session" on an error entry searched `allQuestions` for `editorialStatus === 'approved'`, failing if the question was archived or updated to v2. **Fixed**: Updated `App.tsx` with `handleStartReviewFromSnapshot(entry.questionSnapshot)` to directly launch review of the exact question version. |
| **DEF-16** | Content Validation | `src/persistence/indexedDbRepo.ts` | **Educational Question Reviewer Validation**: `validateQuestionForApproval` lacked validation for a named reviewer before approving educational questions. **Fixed**: Added check ensuring `q.contentKind === 'educational'` requires `q.reviewer?.name`. |
| **DEF-17** | Spaced Review & Scheduling | `src/domain/spacedReview.ts`, `src/domain/types.ts` | **Due-Review Mapping & Interval Advancement**: Completing a due-review session did not advance/reset original items in the review queue, and lacked explicit mappings between presented questions (including alternate concept questions) and originating items. **Fixed**: Added `ReviewQuestionMapping` with `originatingItemIds`, `originalQuestionIds`, and `wasAlternate`. In `finalizeSessionTransaction`, mapped original items are updated in-place via `recordReviewAttempt` exactly once without creating duplicate pending items. Guessed/unsure attempts remain in practice at 1d stage without graduating. Multi-item resolutions are grouped deterministically. Content kinds (demo vs educational) are strictly isolated. Unresolvable items are captured without false completion credit. |
| **DEF-18** | Persistence / Integrity | `src/persistence/indexedDbRepo.ts`, `src/App.tsx` | **Authoritative Atomic Session Finalization**: Session completion, activity credit, and review queue updates were separate non-atomic calls prone to race conditions, double-submission, and late autosave overwrites. **Fixed**: Created `sessionRepo.finalizeSessionTransaction` running inside a single IndexedDB `readwrite` transaction over `['sessions', 'dailyActivity', 'reviewQueue']`. Reads persisted session inside transaction with idempotency guard. Prevents late autosaves from reopening or modifying completed sessions. |
| **DEF-19** | Routing / Navigation | `src/App.tsx` | **Hash Routing & Results Persistence on Reload**: Results routes lacked stable identifiers; refreshing the results screen or navigating directly caused blank screens or lost state. **Fixed**: Implemented `#/results?sessionId=...` routing with `parseHashRoute()`, supported at initial load and `hashchange`. Sessions are loaded directly from storage. Unknown or deleted IDs render a helpful "Session Results Not Found" return path with a button back to dashboard. |
| **DEF-20** | Backup & Recovery | `src/persistence/indexedDbRepo.ts` | **Backup Export Truncation & Atomic Restore**: Backup export truncated activity records to the most recent 90 days (`getRecentActivity(90)`), and restore operations lacked atomic all-or-nothing rollback and pre-validation. Question imports lacked resilience against null inputs, duplicate IDs, or invalid option arrays. **Fixed**: Replaced export with `dailyActivityRepo.getAll()`, exporting all records. Added deep structural pre-validation to `importLocalBackup()` and executed restore in a single transaction across all 10 stores. Hardened `dryRunImportQuestions` to reject null JSON, null records, duplicate IDs, and invalid option arrays with readable errors while preserving `imageMetadata`. |
| **DEF-21** | Mutation Contracts | `src/components/player/QuestionPlayerView.tsx`, `src/components/flashcards/FlashcardsView.tsx`, `src/App.tsx` | **Mutation Contracts & Retry Resilience**: Storage errors during session finalization or card saving were swallowed or lacked retry mechanisms, leading to lost input and disabled submission locks. **Fixed**: Session completion and card saves return awaitable promises that reject with typed errors on failure. Input fields (front, back, topic) and session answers/timers are retained upon failure. Added visible inline retry banners in both the question player and flashcard creator with automatic submission lock release. |

---

## 3. Directory & Module Architecture

```
src/
├── config/
│   ├── brand.config.ts         // Branding tokens, cultural Pakistani MBBS quips, theme colors
│   └── demoQuestions.ts        // 12 demonstration questions with conceptIds and editorial approval
├── domain/
│   ├── types.ts                // Extended domain types (SessionFilterCriteria, SpacedReview, Flashcard, etc.)
│   ├── scoring.ts              // Scoring engine, confidence matrix calculation, idempotent finalization
│   ├── eligibility.ts          // Question filtering (Content Kind, Pool, Taxonomy) & count clamping
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
│   │   └── CreateSessionView.tsx// Live matching count, content bank source selector, taxonomy filters
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
│   ├── eligibility.test.ts     // Pool logic, count clamping, content kind isolation, draft exclusion
│   ├── scoring.test.ts         // Scoring answered vs unanswered questions, confidence breakdown
│   ├── submission.test.ts      // Submission idempotence, tutor mode answer preservation
│   ├── timer.test.ts           // Deadline calculation, expiration detection
│   ├── snapshots.test.ts       // Question-version snapshot isolation
│   ├── spacedReview.test.ts    // Spaced review interval ladder and concept resolution
│   ├── flashcards.test.ts      // Flashcard intervals, ratings, due calculations
│   ├── analytics.test.ts       // First vs repeat accuracy, topic signals rules
│   └── contentImport.test.ts   // Dry-run parsing, validation rules, atomic import
├── App.tsx                     // Root application orchestrating stores, URL hash routing, error banner
├── index.css                   // Design system variables, offset shadows, typography, responsive rules
└── main.tsx                    // React 19 entry point
```

---

## 4. IndexedDB Storage Schema (v3 — Database: `wardwit_local_db`)

| Object Store | KeyPath | Indices / Purpose |
|---|---|---|
| `questions` | `id` | `by-system`, `by-discipline`, `by-content-kind`. Local question bank items with versioning, `questionMedia` (vignette), and `explanationMedia`. |
| `sessions` | `id` | `by-status`, `by-created-at`. Immutable question snapshots and attempt logs. |
| `profiles` | `id` | `'default-profile'`. MBBS year, college, exam date, daily goal, study days. |
| `settings` | `key` | `'app-settings'`. Quiet mode, theme, font size, sound toggles. |
| `dailyActivity` | `date` | `YYYY-MM-DD`. Daily question count, correct count, blocks finished. |
| `reviewQueue` | `id` | `by-due-date`, `by-stage`. Spaced review items scheduled at 1d, 3d, 7d, 14d. |
| `errorNotebook`| `id` | `by-question-id`, `by-cause`. Mistake log with student-selected causes. |
| `flashcards` | `id` | `by-due-date`, `by-kind`. Personal, question-derived, and discover-derived cards with SRS intervals. |
| `discoverCards` | `id` | `by-editorial-status`, `by-content-kind`, `by-topic`. Short syllabus-linked concept cards with curiosity prompts, why it matters, citations, and optional diagrams. |
| `questionReports` | `id` | `by-question-id`, `by-status`. Locally stored issue flags and editor resolutions. |
| `achievements` | `id` | `by-earned-at`. Milestone badges earned strictly through verified activity. |

---

## 5. Verified Test Suite Summary

Command: `npm run test -- --run`
```
 ✓ src/tests/flashcards.test.ts (3 tests)
 ✓ src/tests/timer.test.ts (3 tests)
 ✓ src/tests/snapshots.test.ts (1 test)
 ✓ src/tests/scoring.test.ts (2 tests)
 ✓ src/tests/submission.test.ts (2 tests)
 ✓ src/tests/spacedReview.test.ts (5 tests)
 ✓ src/tests/eligibility.test.ts (5 tests)
 ✓ src/tests/analytics.test.ts (2 tests)
 ✓ src/tests/contentImport.test.ts (3 tests)
 ✓ src/tests/mutationContracts.test.ts (3 tests)
 ✓ src/tests/authoritativeFinalization.test.ts (3 tests)
 ✓ src/tests/dueReviewIntegration.test.ts (6 tests)
 ✓ src/tests/learningContent.test.ts (13 tests)
 ✓ src/tests/dailyHabit.test.ts (14 tests)
 ✓ src/tests/backupRestoreAndImport.test.ts (4 tests)
 ✓ src/tests/tutorIntegration.test.ts (22 tests)

 Test Files  16 passed (16)
      Tests  91 passed (91)
   Duration  2.01s
```

TypeScript, Lint & Build Verification:
- `npm run lint`: `oxlint` passed with 0 errors across 66 files.
- `npm run build`: `tsc -b && vite build` built production bundle in 0.49s with 0 errors.
```

---

## 6. Tyto AI Tutor & Gemini Integration (Phase Status)

### Architecture & Grounding Boundary:
1. **Server Service**: Zero-dependency local Node service (`server/index.ts`, `server/tutorService.ts`, `server/retrievalAdapter.ts`) listening on `127.0.0.1:3001`.
2. **SDK Assumptions**: `@google/genai` (v2.24.0 installed) utilizing `GoogleGenAI` and `ai.models.generateContent` with `systemInstruction` and `abortSignal`.
3. **Model Selection**: Server-configurable via `GEMINI_MODEL`, defaulting to verified `gemini-2.5-flash`.
4. **Post-Answer Placement**: "Ask Tyto" is embedded strictly inside the post-submission explanation card in tutor mode and the expanded question review in results. It is **never** a primary navigation tab.
5. **Timed Block Suppression**: During active timed test blocks, tutor access is strictly suppressed to preserve examination and feedback rules.
6. **Grounding & Canon Governance**: Strictly queries authorized corpus documents (`reviewStatus === 'approved'`); unreviewed drafts and unauthorized corpus IDs are rejected.
7. **Honest Insufficiency & Conflict Handling**: Questions unsupported by retrieved passages return an honest insufficiency answer (`insufficientSources: true`, `citations: []`). Conflicting passages on the same topic surface divergent viewpoints (`conflictDetected: true`).
8. **Prompt Injection Defense**: Reference passages are treated as passive, untrusted reference text. System instructions explicitly forbid executing overrides or jailbreaks embedded in source texts.
9. **Citation Verification**: Every citation is verified against real canonical document records (`title`, `edition`, `section`, `printedPageLabel`, `viewPath`). Missing printed labels map to `"PDF page N"`.
10. **Security & Cost Protection**: `GEMINI_API_KEY` exists exclusively in server `.env` (never `VITE_` prefixed, never in client storage). Requests are protected by a sliding-window rate limiter (15 req/min), 15s timeout, 64KB body guardrail, and sanitized logging.

---

## 7. Visual & Responsive Audit Results

Audit performed across mobile, tablet, and desktop viewports using automated browser subagent verification:

| Viewport | Screen / Workflow | Verification Result |
|---|---|---|
| **360px (Mobile)** | Dashboard & Navigation | Nav items wrap cleanly; Daily Study Plan card stacks vertically; mascot displays at top; quick action buttons remain easily tappable (>44px touch targets). |
| **360px (Mobile)** | Session Builder | Content Bank Source selector cards stack; question count slider and subject pills are readable and touch-friendly. |
| **360px (Mobile)** | Error Notebook | Filter chips wrap; search bar is full-width; mistake cause badges fit without text truncation. |
| **768px (Tablet)** | Question Player & Explanation | Vignette typography is prominent; answer option cards use `role="radio"`; explanation shows clear green/red option breakdowns; Pearls section renders with high contrast; Ask Tyto section renders cleanly inside post-answer card. |
| **768px (Tablet)** | Session Results | Score banner, pacing statistics, and confidence matrix scale cleanly into responsive columns; remediation actions are accessible. |
| **1440px / 1920px (Desktop)** | Content Workspace | Draft question list, active bank table, dry-run modal, and reports review inbox utilize full desktop width; disclaimer banner is prominent. |
| **1440px / 1920px (Desktop)** | Settings & Privacy | Student profile, study days selector with validation error banner, quiet mode toggle, and JSON backup tools render without layout shifts. |
| **All Viewports** | Hash Navigation | Direct hash URLs (`#/analytics`, `#/flashcards`, etc.) load properly; browser back and forward buttons navigate history without full reloads. |

---

## 8. Known Boundaries & Truthfulness Declarations

1. **Demonstration Content**: All 12 seed questions are biostatistics and cognitive heuristics items explicitly identified as nonclinical demonstrations. Real USMLE Step 1 medical questions and verified institutional mappings will be supplied later by certified medical educators.
2. **Single-Device Offline Operation**: WardWit operates 100% in the user's browser via IndexedDB. Question reports and editor approvals are stored locally and are not transmitted to external servers. Cross-device synchronization requires manual JSON backup download/import.
3. **Local Workspace Boundary**: The Content Workspace is a browser-local content sandbox, not a secured administrator portal.
4. **Authored Curriculum & Scored Practice Integrity**: The application does not use AI or unreviewed automated generation to write medical questions, nor does it predict 3-digit USMLE scores, pass probabilities, or national percentiles. Practice signals (`Insufficient Data`, `Needs More Practice`, `On Track`) follow explicit mathematical rules documented on screen.
5. **Quiet Mode**: Suppresses mascot quips, celebrations, and confetti for candidates who prefer a distraction-free, strictly clinical focus.
6. **Conservative Daily Habit & Streak Migration**: Historical aggregate activity records lacking verified `qualifyingItemIds` are preserved for statistical trends (sessions completed, total questions answered), but are not used to fabricate retroactive streak qualifications under the 5-distinct-action rule. Only records with explicit distinct item logging establish verified streaks. All future streaks derive from epoch timestamps in Asia/Karachi.
7. **AI Tutor Medical Disclaimer & Unverified Status**: Live integration and medical accuracy are marked as **Unverified for Live Clinical Use** (no live credentials or clinical corpus configured; validated with non-clinical test fixtures). AI tutor explanations are study aids, not clinical decision-making tools. Generated tutor replies never automatically become approved question bank items, Discover cards, or diagrams.
8. **Never Claim Zero Hallucinations**: Generated explanations are educational aids constrained to authorized reference material and must never be considered clinically verified answers based on a prompt alone. Disclaimers and system prompts explicitly mandate that learners cross-check explanations against canonical references and never assume zero hallucinations.

