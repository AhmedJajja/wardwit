/**
 * Client Domain Types for "Ask Tyto" AI Tutor Integration
 */

export type AskTytoQuickAction = 'explain_simply' | 'why_wrong' | 'explain_diagram' | 'general';

export interface CitationRecord {
  citationId: string;
  docId: string;
  chunkId: string;
  title: string;
  edition: string;
  section: string;
  pdfPageIndex: number;
  printedPageLabel: string;
  reviewStatus: 'approved' | 'in_review' | 'draft' | 'archived';
  excerpt: string;
  verified: boolean;
  viewPath?: string;
}

export interface AskTytoClientContext {
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

export interface AskTytoClientRequest {
  context: AskTytoClientContext;
  quickAction?: AskTytoQuickAction;
  userQuery?: string;
  corpusId?: string;
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

export interface SourceChunkDetail {
  docId: string;
  chunkId: string;
  title: string;
  edition: string;
  section: string;
  topic: string;
  pdfPageIndex: number;
  printedPageLabel: string;
  reviewStatus: string;
  content: string;
}
