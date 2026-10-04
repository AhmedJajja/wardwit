/**
 * Client API Service for interacting with the local WardWit Tutor backend.
 * Handles timeouts, rate limits, unconfigured states, and source chunk inspection.
 */

import type {
  AskTytoClientRequest,
  AskTytoResponse,
  TutorStatusResponse,
  SourceChunkDetail,
} from '../domain/tutorTypes.ts';

export class TutorApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/tutor') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetches backend configuration and corpus status
   */
  async getStatus(): Promise<TutorStatusResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return {
          configured: false,
          model: 'unknown',
          corpusId: 'unreachable',
          approvedDocumentsCount: 0,
          approvedChunksCount: 0,
          serviceStatus: 'error',
          message: `Backend returned HTTP ${res.status}`,
        };
      }
      return (await res.json()) as TutorStatusResponse;
    } catch {
      return {
        configured: false,
        model: 'gemini-2.5-flash',
        corpusId: 'wardwit-approved-core',
        approvedDocumentsCount: 0,
        approvedChunksCount: 0,
        serviceStatus: 'unconfigured',
        message: 'Tutor backend service is not currently running.',
      };
    }
  }

  /**
   * Submits an inquiry to Ask Tyto
   */
  async askTyto(payload: AskTytoClientRequest): Promise<AskTytoResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000); // 20s client safety timeout

    try {
      const res = await fetch(`${this.baseUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        const error = new Error(data.error || `HTTP ${res.status} error from tutor backend.`);
        (error as any).statusCode = res.status;
        throw error;
      }

      return data as AskTytoResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr: any = new Error('Tutor request timed out. Please try again.');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Fetches a verified source document excerpt
   */
  async getSourceChunk(docId: string, chunkId: string): Promise<SourceChunkDetail | null> {
    try {
      const res = await fetch(`${this.baseUrl}/source/${encodeURIComponent(docId)}/${encodeURIComponent(chunkId)}`);
      if (!res.ok) return null;
      return (await res.json()) as SourceChunkDetail;
    } catch {
      return null;
    }
  }
}

export const tutorClient = new TutorApiClient();
