# WardWit — Project Status & Architecture Report

## 1. Executive Summary & Verification State
- **Product Name**: WardWit (Replaceable internal code name)
- **Target Audience**: Pakistani MBBS students preparing for USMLE Step 1
- **Design Philosophy**: Medical campus meets playful field notebook (warm ivory palette, dark ink text, deep teal controls, coral/marigold/mint accents, rounded cards with offset shadows, custom SVG mascot "Clip")
- **Verification Status**:
  - **Unit & Logic Tests**: 11/11 Vitest tests passing (`npm run test`)
  - **TypeScript & Bundle Build**: Pass (`tsc -b && vite build`) with zero lint/type errors
  - **Browser E2E Verification**: Verified via browser subagent across desktop (1280x800) and mobile (390x844) viewports with video recordings and screenshots

---

## 2. Implemented Architecture & Route / View Structure

```
src/
├── config/
│   ├── brand.config.ts         // Centralized branding, copy, cultural quotes, theme tokens
│   └── demoQuestions.ts        // 12 nonclinical demonstration questions with rich rationales
├── domain/
│   ├── types.ts                // Strict TypeScript definitions (Question, Session, Attempt, Profile, Settings)
│   ├── scoring.ts              // Scoring engine, confidence matrix calculation, idempotent finalization
│   ├── eligibility.ts          // Question filtering (Unused, Incorrect, Flagged, Taxonomy) & count clamping
│   └── timer.ts                // Deadline-based countdown math (now vs expiresAt)
├── persistence/
│   ├── db.ts                   // IndexedDB database initialization & upgrade via 'idb'
│   ├── repositories.ts         // Storage repository interfaces (IQuestionRepo, ISessionRepo, etc.)
│   └── indexedDbRepo.ts        // Concrete IndexedDB repositories, backup export/import, data wipe
├── components/
│   ├── mascot/
│   │   └── ClipMascot.tsx      // Original SVG clipboard mascot with 4 poses (welcome, focus, celebration, encouragement)
│   ├── common/
│   │   ├── Navbar.tsx          // Brand header, screen navigation, active session resume pill, quiet mode toggle
│   │   └── DisclaimerBanner.tsx// Standardized nonclinical demo disclaimer
│   ├── onboarding/
│   │   └── OnboardingModal.tsx // MBBS stage, optional college, exam date, daily goal, study days
│   ├── dashboard/
│   │   └── DashboardView.tsx   // Greeting, mascot, daily progress ring, shortcuts, recent sessions audit trail
│   ├── session-create/
│   │   └── CreateSessionView.tsx// Live matching count, pool selection, taxonomy filters, mode configuration
│   ├── player/
│   │   └── QuestionPlayerView.tsx// Question palette, strike-through, flag, confidence rating, tutor/timed mechanics
│   ├── results/
│   │   └── ResultsView.tsx     // Score summary, pacing, confidence vs correctness matrix, review accordion, remediation
│   └── settings/
│       └── SettingsView.tsx    // Profile editing, quiet mode, theme switcher, JSON backup export/import, reset data
├── tests/
│   ├── eligibility.test.ts     // Filter tests, pool logic, honest count clamping without silent duplication
│   ├── scoring.test.ts         // Scoring answered vs unanswered questions, confidence breakdown
│   ├── submission.test.ts      // Submission idempotence, first-attempt tutor mode answer preservation
│   ├── timer.test.ts           // Deadline calculation, expiration detection, timer formatting
│   └── snapshots.test.ts       // Question-version snapshot isolation
├── App.tsx                     // Root application orchestrating IndexedDB state and screen navigation
├── index.css                   // Design system variables, offset shadows, typography, responsive rules
└── main.tsx                    // React 19 entry point
```

---

## 3. Storage Schema & Single-Device Persistence

WardWit uses client-side browser **IndexedDB** (`wardwit_local_db` v1) with zero external backend or cloud trackers.

### Object Stores:
1. `questions`: KeyPath `id`. Seeded with 12 nonclinical demonstration questions.
2. `sessions`: KeyPath `id`. Contains full `questionSnapshots` array capturing immutable copies of question versions at block creation time.
3. `profiles`: KeyPath `id` (`'default-profile'`). Stores name, MBBS year, optional college, target exam date, preferred days, and daily question goal.
4. `settings`: KeyPath `key` (`'app-settings'`). Stores `quietMode` boolean, `theme`, `fontSize`, and sound preferences.
5. `dailyActivity`: KeyPath `date` (`YYYY-MM-DD`). Tracks real daily questions answered, correct count, and blocks completed.

---

## 4. Content Honesty & Nonclinical Demo Boundaries
- **No Clinical Advice**: All 12 demonstration questions exercise reasoning, biostatistics logic (sensitivity/specificity cut-offs, intention-to-treat analysis, likelihood ratios), cognitive heuristics (anchoring bias), and software mechanics.
- **Taxonomy Labelling**: All taxonomy systems and disciplines are visibly tagged as `(Demo)` (e.g., `Demo - Biostatistics & Trial Design`).
- **No Fabricated Stats**: Dashboard stats and streaks reflect only real local activity.
- **Profile Note Disclaimer**: Medical college entry is strictly saved as a personal profile note, not a verified curriculum mapping or official affiliation.

---

## 5. Verified Working Capabilities
1. **Welcome & Onboarding**: Form collects student details, provides skip option, and saves to IndexedDB.
2. **Dashboard**: Live daily goal calculation from local activity, resume banner for unfinished sessions, targeted shortcuts (Unused, Incorrect, Flagged).
3. **Session Builder**: Real-time matching question calculation. Handles 0 matches honestly without silent duplication.
4. **Tutor Mode**:
   - Preserves first submitted answer in attempt record.
   - Reveals comprehensive explanation, option-by-option rationale, and high-yield takeaway.
5. **Timed Mode**:
   - Deadline-based countdown timer (`expiresAt = startedAt + durationMs`) unaffected by refresh or interval drift.
   - Discloses unanswered questions on submission.
   - Idempotent finalization prevents duplicate attempts.
6. **Results & Review**:
   - Scores answered and unanswered items (unanswered scored as 0).
   - Metacognitive Confidence vs Correctness matrix identifies blind spots vs lucky guesses.
   - One-click launch of targeted review sessions for incorrect or flagged items.
7. **Settings & Privacy**:
   - Quiet Mode suppresses playful mascot quips and celebration confetti.
   - JSON backup export and validated JSON backup import.
   - Two-step data erasure (`RESET` confirmation).
8. **Responsive UI**:
   - Tested on desktop and mobile (`390 x 844`). All touch targets meet accessibility standards (≥44px).

---

## 6. Known Limitations & Safe Foundations for Future Phases
- **Demonstration Scope**: The 12 questions are nonclinical demonstration items. A real clinical question bank can be safely imported via `IQuestionRepository.saveBatch()` or JSON backup import.
- **Single-Device Model**: Data is bound to the local browser IndexedDB. Future phases can implement a remote REST or GraphQL sync provider by swapping the repository interfaces (`IQuestionRepository`, `ISessionRepository`, `IProfileRepository`) without modifying UI components.
- **Client-Side Storage**: In-browser client state is not protected against local browser DevTools inspection (stated honestly in disclaimers).
