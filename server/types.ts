/**
 * Server Domain & Wire Types for WardWit "Ask Tyto" Tutor Integration
 * Strictly enforces canonical metadata, verified citations, and corpus governance.
 */

export type CorpusReviewStatus = 'approved' | 'in_review' | 'draft' | 'archived';

/**
 * Authorized document in the owner's approved study corpus.
 * Unreviewed or draft uploads must never enter learner-facing tutor retrieval.
 */
export interface AuthorizedCorpusDocument {
  id: string; // Canonical document ID e.g. "doc-biostat-core"
  corpusId: string; // Corpus identifier e.g. "wardwit-approved-core"
  title: string;
  edition: string;
  version: string;
  authorOrPublisher: string;
  reviewStatus: CorpusReviewStatus;
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
}

/**
 * Stored at page/section granularity suitable for verifiable citations.
 */
export interface CorpusPageChunk {
  id: string; // e.g. "doc-biostat:chunk-p14"
  docId: string; // Canonical document ID
  corpusId: string; // Corpus namespace
  section: string;
  topic: string;
  pdfPageIndex: number; // Electronic PDF page index (1-indexed)
  printedPageLabel?: string; // Verified printed page label e.g. "p. 42" (distinct from PDF page)
  reviewStatus: CorpusReviewStatus;
  content: string; // Source text excerpt
  keywords: string[];
}

/**
 * Server-verified citation bound to an authorized source record.
 * Never allows client or model to invent an arbitrary locator.
 */
export interface CitationRecord {
  citationId: string;
  docId: string;
  chunkId: string;
  title: string;
  edition: string;
  section: string;
  pdfPageIndex: number;
  printedPageLabel: string; // Exact printed label "p. 42", or "PDF page N", or "Page unavailable"
  reviewStatus: CorpusReviewStatus;
  excerpt: string;
  verified: boolean;
  viewPath?: string;
}

export type AskTytoQuickAction = 'explain_simply' | 'why_wrong' | 'explain_diagram' | 'general';

/**
 * Question context passed into Tyto from the active question attempt.
 */
export interface AskTytoQuestionContext {
  questionId: string;
  questionVersion: number;
  topic: string;
  system?: string;
  discipline?: string;
  learningObjective?: string;
  vignette: string;
  selectedOptionId: string | null;
  selectedOptionText?: string;
  correctOptionId: string;
  correctOptionText?: string;
  isCorrect: boolean;
  hasDiagram: boolean;
  diagramAltText?: string;
  diagramTeachingPurpose?: string;
}

export interface AskTytoRequest {
  context: AskTytoQuestionContext;
  quickAction?: AskTytoQuickAction;
  userQuery?: string;
  corpusId?: string; // If omitted, defaults to server's allowed corpus
}

export interface AskTytoResponse {
  answer: string;
  citations: CitationRecord[];
  insufficientSources: boolean;
  conflictDetected: boolean;
  conflictDetails?: string;
  disclaimer: string;
  model: string;
  latencyMs: number;
  timestamp: number;
}

export interface TutorStatusResponse {
  configured: boolean;
  model: string;
  corpusId: string;
  approvedDocumentsCount: number;
  approvedChunksCount: number;
  serviceStatus: 'ready' | 'unconfigured' | 'error';
  message?: string;
}
