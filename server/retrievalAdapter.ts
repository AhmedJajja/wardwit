/**
 * Server Retrieval Adapter for WardWit
 * Provides strict, deterministic retrieval over authorized corpus documents.
 * 
 * Invariants:
 * - Only documents and chunks with reviewStatus === 'approved' are accessible.
 * - Enforces allowed corpus boundary (rejects unauthorized corpus IDs).
 * - Maps provider page indices to canonical metadata: "p. 42" or "PDF page N".
 * - Never asks or allows the model to invent a source locator.
 */

import type {
  AuthorizedCorpusDocument,
  CorpusPageChunk,
  CitationRecord,
} from './types.ts';
import {
  DEFAULT_ALLOWED_CORPUS_ID,
  FIXTURE_AUTHORIZED_DOCUMENTS,
  FIXTURE_CORPUS_CHUNKS,
} from './testCorpus.ts';

export interface IRetrievalAdapter {
  retrieve(query: string, corpusId?: string, maxResults?: number): Promise<CorpusPageChunk[]>;
  getDocument(docId: string, corpusId?: string): AuthorizedCorpusDocument | undefined;
  getChunk(chunkId: string, corpusId?: string): CorpusPageChunk | undefined;
  getAllApprovedDocuments(corpusId?: string): AuthorizedCorpusDocument[];
  getAllApprovedChunks(corpusId?: string): CorpusPageChunk[];
}

export class LocalCorpusRetriever implements IRetrievalAdapter {
  private documents: Map<string, AuthorizedCorpusDocument> = new Map();
  private chunks: Map<string, CorpusPageChunk> = new Map();
  private allowedCorpusId: string;

  constructor(
    docs: AuthorizedCorpusDocument[] = FIXTURE_AUTHORIZED_DOCUMENTS,
    chunks: CorpusPageChunk[] = FIXTURE_CORPUS_CHUNKS,
    allowedCorpusId: string = process.env.ALLOWED_CORPUS_ID || DEFAULT_ALLOWED_CORPUS_ID
  ) {
    this.allowedCorpusId = allowedCorpusId;

    // Index approved documents only
    for (const doc of docs) {
      if (doc.reviewStatus === 'approved' && doc.corpusId === this.allowedCorpusId) {
        this.documents.set(doc.id, doc);
      }
    }

    // Index approved chunks whose parent document is approved
    for (const chunk of chunks) {
      if (
        chunk.reviewStatus === 'approved' &&
        chunk.corpusId === this.allowedCorpusId &&
        this.documents.has(chunk.docId)
      ) {
        this.chunks.set(chunk.id, chunk);
      }
    }
  }

  public getAllApprovedDocuments(corpusId?: string): AuthorizedCorpusDocument[] {
    const targetCorpus = corpusId || this.allowedCorpusId;
    if (targetCorpus !== this.allowedCorpusId) return [];
    return Array.from(this.documents.values());
  }

  public getAllApprovedChunks(corpusId?: string): CorpusPageChunk[] {
    const targetCorpus = corpusId || this.allowedCorpusId;
    if (targetCorpus !== this.allowedCorpusId) return [];
    return Array.from(this.chunks.values());
  }

  public getDocument(docId: string, corpusId?: string): AuthorizedCorpusDocument | undefined {
    const targetCorpus = corpusId || this.allowedCorpusId;
    if (targetCorpus !== this.allowedCorpusId) return undefined;
    return this.documents.get(docId);
  }

  public getChunk(chunkId: string, corpusId?: string): CorpusPageChunk | undefined {
    const targetCorpus = corpusId || this.allowedCorpusId;
    if (targetCorpus !== this.allowedCorpusId) return undefined;
    return this.chunks.get(chunkId);
  }

  /**
   * Deterministic BM25 / token-weighted retrieval across approved chunks.
   * Unsupported queries with zero relevant match return an empty array,
   * prompting an honest insufficiency answer.
   */
  public async retrieve(
    query: string,
    corpusId?: string,
    maxResults: number = 3
  ): Promise<CorpusPageChunk[]> {
    const targetCorpus = corpusId || this.allowedCorpusId;
    if (targetCorpus !== this.allowedCorpusId) {
      // Reject unauthorized corpus query
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored: { chunk: CorpusPageChunk; score: number }[] = [];

    for (const chunk of this.chunks.values()) {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();
      const topicLower = chunk.topic.toLowerCase();
      const sectionLower = chunk.section.toLowerCase();

      // Check keyword hits
      for (const kw of chunk.keywords) {
        const kwLower = kw.toLowerCase();
        if (query.toLowerCase().includes(kwLower)) {
          score += 6.0;
        }
      }

      // Check token frequency in topic & section
      for (const token of queryTokens) {
        if (topicLower.includes(token)) score += 4.0;
        if (sectionLower.includes(token)) score += 2.0;
        if (contentLower.includes(token)) score += 1.0;
      }

      // Minimum relevance threshold
      if (score >= 2.0) {
        scored.push({ chunk, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map((s) => s.chunk);
  }

  public tokenize(text: string): string[] {
    return tokenizeText(text);
  }
}

export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Binds a chunk to a fully verified CitationRecord.
 * Maps provider/electronic page index to canonical metadata:
 * - Uses verified printed page label if available e.g. "p. 12"
 * - If absent, formats strictly as "PDF page N"
 * - Never invents locators
 */
export function bindCitation(
  chunk: CorpusPageChunk,
  doc: AuthorizedCorpusDocument,
  citationIndex: number
): CitationRecord {
  let printedPageLabel: string;
  if (chunk.printedPageLabel && chunk.printedPageLabel.trim().length > 0) {
    printedPageLabel = chunk.printedPageLabel.trim();
  } else if (chunk.pdfPageIndex != null && chunk.pdfPageIndex > 0) {
    printedPageLabel = `PDF page ${chunk.pdfPageIndex}`;
  } else {
    printedPageLabel = 'Page unavailable';
  }

  return {
    citationId: `cit-${citationIndex + 1}`,
    docId: doc.id,
    chunkId: chunk.id,
    title: doc.title,
    edition: doc.edition,
    section: chunk.section,
    pdfPageIndex: chunk.pdfPageIndex,
    printedPageLabel,
    reviewStatus: chunk.reviewStatus,
    excerpt: chunk.content,
    verified: true,
    viewPath: `/api/tutor/source/${encodeURIComponent(doc.id)}/${encodeURIComponent(chunk.id)}`,
  };
}

/**
 * Checks for documented conflicts among retrieved chunks.
 * E.g., multiple passages on the same topic presenting divergent models.
 */
export function detectConflicts(chunks: CorpusPageChunk[]): {
  hasConflict: boolean;
  conflictDetails?: string;
} {
  const topics = new Map<string, CorpusPageChunk[]>();
  for (const c of chunks) {
    const list = topics.get(c.topic) || [];
    list.push(c);
    topics.set(c.topic, list);
  }

  for (const [topic, topicChunks] of topics.entries()) {
    if (topicChunks.length >= 2) {
      // Check if any chunk indicates divergence or alternative assay paradox
      const hasContradiction = topicChunks.some(
        (c) =>
          c.content.toLowerCase().includes('paradox') ||
          c.content.toLowerCase().includes('divergent') ||
          c.content.toLowerCase().includes('violat')
      );
      if (hasContradiction) {
        return {
          hasConflict: true,
          conflictDetails: `Documented clinical divergence detected on topic "${topic}". Passages from ${topicChunks
            .map((c) => c.section)
            .join(' and ')} represent divergent screening assumptions.`,
        };
      }
    }
  }

  return { hasConflict: false };
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'what', 'which', 'explain',
  'why', 'how', 'does', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
  'not', 'but', 'out', 'all', 'any', 'can', 'her', 'his', 'him', 'they',
]);
