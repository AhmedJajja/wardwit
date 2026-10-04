# WardWit — Backend Handoff & Cloud Production Roadmap

## 1. Overview & Current Local Scope

WardWit is currently implemented as an **offline-first single-device web application** built with React 19, TypeScript, and Vite, utilizing IndexedDB for client-side persistence. 

### Current Local Architecture:
- **Client Storage**: All question items, sessions, profiles, error notebook reflections, flashcards, reports, and activity statistics reside in the local browser IndexedDB (`wardwit_local_db`).
- **No Remote Network Calls**: No patient data or student activity is transmitted outside the browser.
- **Content Workspace**: Functions as a browser-local content sandbox for editing and validating questions, not as a secured administrative portal.
- **Reporting System**: In-exam issue reports are stored locally in the browser's reports inbox for inspection rather than being delivered to an external ticketing system.

This document outlines the concrete technical architecture and work required to transition WardWit from a local offline field notebook into a secure, multi-tenant, cloud-synchronized production system.

---

## 2. Authentication & Real User Accounts

### 2.1 Identity Provider & Credential Handling
- **Authentication Strategy**:
  - Implement industry-standard authentication (e.g., OpenID Connect / OAuth 2.0 with PKCE or signed HTTP-only secure cookie session management).
  - Support passwordless magic links or email/password with Argon2id / bcrypt password hashing.
  - Optional OAuth integration with Google / Apple for Pakistani medical students who frequently study across Android/iOS mobile devices and desktop browsers.
- **Session Management**:
  - Store session tokens in `HttpOnly`, `Secure`, `SameSite=Lax` cookies to prevent XSS-based token theft.
  - Implement short-lived access tokens (15–30 minutes) and rotating refresh tokens stored in a secure Redis / database store with family-invalidation on reuse detection.
  - Support user-facing session revocation ("Log out of all devices").

### 2.2 Account Security Boundaries
- **Email Verification**: Required upon registration before cloud backups or study progress sync can be activated.
- **Rate Limiting**: IP-based and user-based throttling on login, password reset, and registration endpoints (e.g. 5 failed attempts per 15 minutes with exponential backoff).
- **Multi-Factor Authentication (MFA)**: Optional TOTP-based 2FA for editor and admin accounts.

---

## 3. Authorisation & Role-Based Access Control (RBAC)

The current local workspace treats anyone opening the browser as the owner. In production, strict server-enforced roles must be established:

| Role | Permissions & Scope |
|---|---|
| **Student (Default)** | Read approved educational content; create personal study sessions; record attempts, error notebook entries, and flashcards; submit question issue reports; download personal data backups. Strictly restricted to own user data. |
| **Medical Content Author** | Draft new clinical vignettes, options, and explanations; submit questions for review; view authoring dashboard. Cannot publish or self-approve. |
| **Editorial Reviewer** | Review submitted drafts; verify textbook citations, image provenance, and learning objectives; approve or request revisions; resolve question issue reports. |
| **System Administrator** | Manage user accounts, role assignments, system configurations, and automated database backups. No access to private student notebook entries. |

### Concrete Backend Authorisation Checks:
- **Row-Level Security (RLS)**: Enforce PostgreSQL RLS or middleware authorization queries ensuring that students can only read and mutate records where `user_id = current_user_id()`.
- **Question Publication Gate**: API routes accepting question status changes to `approved` must verify the caller has `Editorial Reviewer` or `Admin` roles.

---

## 4. Shared Content & Centralized Question Bank

### 4.1 Canonical Question Repository
- **Database Schema**:
  - `questions`: `id` (UUID), `vignette`, `system`, `discipline`, `topic`, `concept_id`, `learning_objectives`, `status` (`draft` | `in_review` | `approved` | `archived`), `version` (integer), `created_at`, `updated_at`.
  - `question_options`: `id` (UUID), `question_id`, `option_id` (e.g. 'A', 'B'), `text`, `is_correct`, `rationale`.
  - `question_citations`: `id`, `question_id`, `textbook_title`, `edition`, `pages`.
  - `question_reviews`: `id`, `question_id`, `reviewer_id`, `reviewed_at`, `action` (`approved`, `rejected`, `changes_requested`), `notes`.
- **Media Asset Storage**:
  - Diagrams, histological slides, and ECG strips must be stored in secure, private Object Storage (e.g., S3/GCS-compatible bucket) served through a Content Delivery Network (CDN).
  - Enforce virus scanning and MIME validation on uploaded assets.
  - Image URLs must be verified against safe origins and never allow raw user HTML injection.

### 4.2 Versioning & Historical Immutability
- When an approved question is edited or updated, its `version` counter increments, or a new immutable snapshot is generated.
- Historical student exam sessions must always reference the exact question snapshot they answered, ensuring that future edits to a question vignette or explanation never alter past session scores or review logs.

---

## 5. Cross-Device Synchronization & Conflict Resolution

### 5.1 Sync Engine Design
- **Offline-First Resilience**: Students in areas with fluctuating internet connections (common across hospital rotations and campus Wi-Fi) must be able to complete sessions offline and sync seamlessly when connectivity resumes.
- **Delta-Based Synchronization**:
  - The client maintains a local `outbox_mutations` queue in IndexedDB.
  - When online, the client pushes batches of mutations: `attempts_created`, `flashcards_reviewed`, `notebook_entries_saved`.
  - The server applies mutations in an atomic transaction and returns a server timestamp `synced_at` and any remote delta updates.
- **Conflict Resolution Strategy**:
  - **Sessions & Attempts**: Append-only. Attempt records are immutable and keyed by `attempt_id` (UUID). No conflicts possible.
  - **Error Notebook Notes**: Last-write-wins based on UTC timestamp `updated_at`, with server preserving a revision history if concurrent edits occur.
  - **Flashcard SRS Intervals**: Merge algorithm selecting the highest `reviewCount` and latest `dueDate` to avoid regressing study progress.

---

## 6. Centralized Issue Reporting Pipeline

### 6.1 Report Lifecycle
In production, the in-exam "Report Issue" button will dispatch reports to a central editorial pipeline:
1. **Student Ingestion**: Report created with `question_id`, `version`, `issue_type` (typo, medical error, broken image), and candidate notes.
2. **Triaging Queue**: Appears in the Editorial Reviewer dashboard.
3. **Investigation & Action**: Reviewer inspects the report against standard reference texts.
4. **Resolution**: If valid, question is updated to a new version and the report is resolved. If invalid, resolution notes explain why the medical vignette was correct as written.
5. **Candidate Feedback (Optional)**: Candidate receives a notification in their dashboard: *"Your feedback on question #WW-BIO-001 was reviewed and resolved by the medical editorial board."*

---

## 7. Cloud Backups, Disaster Recovery, and Data Portability

### 7.1 Automated Cloud Backups
- **Continuous Backups**: WAL-based point-in-time recovery (PITR) for PostgreSQL with 30-day retention.
- **Daily Cold Snapshots**: Encrypted database dumps stored in multi-region cold storage.
- **Disaster Recovery SLA Target**: RPO (Recovery Point Objective) < 15 minutes; RTO (Recovery Time Objective) < 2 hours.

### 7.2 Student Data Export & GDPR/Privacy Compliance
- **Complete Takeout**: Students retain ownership of their study data. An API endpoint `GET /api/v1/user/export` provides a downloadable encrypted ZIP containing their complete study history, error notebook, flashcards, and attempt logs in standard JSON format.
- **Right to Erasure**: Hard-delete endpoint `DELETE /api/v1/user/account` purging personal identity and error notes while anonymizing historical question answer accuracy statistics to prevent skewing collective item discrimination metrics.

---

## 8. Production Deployment & Operational Architecture

```
                  [ Internet Users / MBBS Students ]
                                  │
                                  ▼
               [ Cloud CDN / DDoS Shield / SSL Termination ]
                                  │
           ┌──────────────────────┴──────────────────────┐
           ▼                                             ▼
  [ Static Web Assets ]                        [ API Gateway / Load Balancer ]
  (Compiled Vite React Bundle)                           │
                                                         ▼
                                               [ Backend API Cluster ]
                                               (Node.js / Go / Python)
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        ▼                                ▼                                ▼
               [ PostgreSQL Cluster ]             [ Redis Cache ]               [ Object Storage ]
             (User Data, RBAC, Sessions,          (Sessions, SRS queues,        (Medical diagrams,
              Question Bank, Versioning)          Rate limiting, Mutexes)        histology slides)
```

### 8.1 Infrastructure Components
1. **Frontend Hosting**: Modern CDN edge hosting (e.g. Cloudflare Pages, AWS CloudFront, or GCP Cloud Storage + Cloud CDN) with custom domain, TLS 1.3, and HTTP/3 support.
2. **API Backend**: Stateless containerized microservices or monolith (e.g. Fastify / Express TypeScript or Go) running in a managed container cluster (e.g. Kubernetes, AWS ECS, or GCP Cloud Run).
3. **Database**: Managed PostgreSQL with connection pooling (e.g. PgBouncer).
4. **Cache & Queue**: Redis for session caching, rate limiting, and background task queues (e.g. daily review queue pre-computations).
5. **Observability**: Centralized structured logging, error tracking (e.g. Sentry), and APM metrics (Prometheus/Grafana) to monitor latency and API error rates without logging candidate PII.

---

## 9. Transition Checklist: Local Review to Production Launch

- [ ] **Step 1**: Formalize JSON schema for production Question Bank export/import.
- [ ] **Step 2**: Provision staging backend API with authentication, RBAC, and PostgreSQL database.
- [ ] **Step 3**: Implement client-side API sync service to replace direct IndexedDB mutations with sync outbox pattern.
- [ ] **Step 4**: Migrate local Content Workspace into an authenticated, role-gated Editorial Web Portal.
- [ ] **Step 5**: Conduct third-party medical content review on all question items before promoting from `draft` to `approved`.
- [ ] **Step 6**: Run load tests on session submission and sync endpoints.
- [ ] **Step 7**: Conduct external application security penetration test and privacy compliance audit.
- [ ] **Step 8**: Production DNS configuration, SSL provisioning, and monitoring alerts activation.

---

## 10. Tyto AI Tutor Integration & Gemini API Architecture

### 10.1 Verified SDK, API Assumptions, and Official Documentation
WardWit uses the modern, official unified Google Gen AI SDK (`@google/genai` v2.24.0) rather than deprecated legacy packages (`@google/generative-ai`).

| Component | Assumption & Configuration | Official Documentation URL |
|---|---|---|
| **Official SDK** | `@google/genai` (v2.24.0 installed) | [Google Gen AI SDK GitHub](https://github.com/googleapis/js-genai) • [SDK Reference](https://googleapis.github.io/js-genai/) |
| **API Method** | `ai.models.generateContent` with `systemInstruction` and `abortSignal` | [Gemini API generateContent](https://ai.google.dev/api/generate-content) |
| **Model Selection** | Server-configurable via `process.env.GEMINI_MODEL`, defaulting to `gemini-2.5-flash` | [Gemini Models Reference](https://ai.google.dev/gemini-api/docs/models/gemini) |
| **Grounding & File Search** | Managed RAG via `tools: [{ fileSearch: { fileSearchStoreNames: [...] } }]` | [Gemini File Search Guide](https://ai.google.dev/gemini-api/docs/file-search) |

### 10.2 Server-Side Architecture & Minimal Local Prototype
The tutor integration is designed with a minimal server boundary (`server/` directory) and an offline-resilient client adapter:
- **Local Service**: Zero-dependency Node.js HTTP server (`server/index.ts`) bound strictly to `127.0.0.1:3001` (preventing accidental public exposure).
- **Vite Proxy Boundary**: Dev proxy forwards `/api` to `http://127.0.0.1:3001` in `vite.config.ts`.
- **Endpoints**:
  - `GET /api/tutor/status`: Health check, model configuration, and approved corpus statistics.
  - `POST /api/tutor/ask`: Question-contextualized tutor inquiry with grounding and citation binding.
  - `GET /api/tutor/source/:docId/:chunkId`: Direct retrieval of canonical source chunk text and verified metadata.
- **Graceful Client Degradation**: When the server is unconfigured (no `GEMINI_API_KEY`) or offline, the client displays a clear educational notice. Authored question explanations, official option rationale, diagrams, and high-yield takeaways remain 100% operational.

### 10.3 Study Corpus Governance & Granularity
To mitigate AI hallucinations and protect copyright:
- **Corpus Ingestion Standard**: Documents are registered with canonical ID, title, edition, version, author/publisher, and explicit `reviewStatus` (`'approved' | 'draft' | 'in_review' | 'archived'`).
- **Chunk Granularity**: Source passages are stored at page/section granularity with `pdfPageIndex` (electronic page) and verified `printedPageLabel` (e.g. `"p. 42"`).
- **Strict Boundary**: Unreviewed uploads (`reviewStatus !== 'approved'`) and unauthorized corpus IDs are strictly excluded from retrieval.
- **Page Locator Discipline**: Provider page indices do not establish a printed book page. Missing printed page labels are formatted strictly as `"PDF page N"`; unpaginated documents as `"Page unavailable"`. The model is never permitted or prompted to invent arbitrary source locators.

### 10.4 Grounding, Insufficiency, and Prompt Injection Defense
- **Retrieval Engine & Query Relevance Guard**: Server queries approved chunks based on question topic, learning objective, and user query. If the student asks an off-topic query or zero approved passages match, the server returns an honest insufficiency response (`insufficientSources: true`, `citations: []`), refusing to guess or pass irrelevant passages that tempt model hallucination.
- **Model Insufficiency Detection**: If the model output explicitly indicates that provided reference passages lack sufficient evidence, the server automatically sets `insufficientSources: true`.
- **Honest Disclaimers**: System prompts and response disclaimers explicitly mandate that generated outputs are educational study aids and that learners must never assume zero hallucinations.
- **Conflict Handling**: Passages presenting divergent medical stances are detected; the response surfaces both viewpoints and cites both sources (`conflictDetected: true`).
- **Prompt Injection Defense**: Reference passages are treated strictly as passive untrusted reference data. System instructions explicitly forbid following commands, system overrides, or jailbreaks embedded in source texts.
- **Citation Binding**: Citations returned to the client are strictly bound to server-verified canonical documents (`docId`, `edition`, `section`, `printedPageLabel`, `viewPath`).

### 10.5 Security, Cost, and Operational Protections
- **Secret Isolation**: `GEMINI_API_KEY` is loaded exclusively in the server environment. It is never prefixed with `VITE_`, never stored in browser storage, and never accessible in client bundles. Automated tests scan client bundles to enforce this constraint.
- **Abuse Prevention**:
  - Sliding-window rate limiter: max 15 requests per 60 seconds per client IP (returns HTTP 429).
  - Timeout protection: 15-second AbortController on all generation requests (returns HTTP 504).
  - Payload limit: 64KB maximum body size guardrail (returns HTTP 413).
- **Sanitized Logging**: Server logs redact API keys and never log full copyrighted book excerpts.

### 10.6 Learner Experience & Timed Block Rule
- **Post-Answer Placement**: "Ask Tyto" is embedded strictly inside the revealed post-answer explanation card in tutor mode and inside the expanded item review in results. It is NOT a top-level navigation tab.
- **Active Timed Block Suppression**: During active timed test blocks, tutor access is strictly disabled until the block is submitted and finalized, preserving testing fidelity.
- **Contextual Chips**: "Explain simply" is always offered; "Why is my Option X wrong?" is only offered when the learner chose an incorrect distractor; "Explain the diagram" is only offered when diagram media exists.
- **Collapsible Sources**: Responses display short explanations first, with an expandable "Verified Source Details" drawer allowing students to view exact quoted passages.
- **No Automatic Promotion**: Generated tutor responses never automatically become approved question bank items, Discover cards, or diagrams.

### 10.7 Remaining Production Requirements Before Public Deployment
1. **Official Clinical Corpus Licensing**: Ingest authorized medical reference works (e.g. Robbins, First Aid, Costanzo) under valid institutional licenses.
2. **Clinical Verification Benchmark**: Run a human-reviewed clinical evaluation benchmark set to audit tutor responses for clinical accuracy.
3. **Production Authentication & Quota Management**: Replace local IP rate-limiting with authenticated user quotas and tiering behind an API gateway.
4. **Current Status**: Marked as **Unverified for Live Clinical Use** (no live credentials or clinical corpus configured; validated locally with non-clinical test fixtures).

