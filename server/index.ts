/**
 * WardWit Tutor Local HTTP Server
 * Minimal, zero-dependency local Node service providing the tutor API boundary.
 * Strictly binds to 127.0.0.1 (local prototype).
 */

import http from 'node:http';
import { TutorService } from './tutorService.ts';
import { LocalCorpusRetriever } from './retrievalAdapter.ts';
import type { AskTytoRequest } from './types.ts';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '127.0.0.1'; // Prototype bound locally, never public 0.0.0.0

const retriever = new LocalCorpusRetriever();
const tutorService = new TutorService({ retriever });

const MAX_BODY_BYTES = 64 * 1024; // 64 KB abuse prevention

export function createTutorServer(service: TutorService = tutorService, corpusRetriever: LocalCorpusRetriever = retriever) {
  return http.createServer(async (req, res) => {
    // CORS headers for local Vite dev server
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    // Route: GET /api/tutor/status
    if (req.method === 'GET' && pathname === '/api/tutor/status') {
      const status = service.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
      return;
    }

    // Route: GET /api/tutor/source/:docId/:chunkId
    const sourceMatch = pathname.match(/^\/api\/tutor\/source\/([^/]+)\/([^/]+)$/);
    if (req.method === 'GET' && sourceMatch) {
      const docId = decodeURIComponent(sourceMatch[1]);
      const chunkId = decodeURIComponent(sourceMatch[2]);
      const doc = corpusRetriever.getDocument(docId);
      const chunk = corpusRetriever.getChunk(chunkId);

      if (!doc || !chunk) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Source record not found in approved corpus.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          docId: doc.id,
          chunkId: chunk.id,
          title: doc.title,
          edition: doc.edition,
          section: chunk.section,
          topic: chunk.topic,
          pdfPageIndex: chunk.pdfPageIndex,
          printedPageLabel: chunk.printedPageLabel || `PDF page ${chunk.pdfPageIndex}`,
          reviewStatus: chunk.reviewStatus,
          content: chunk.content,
        })
      );
      return;
    }

    // Route: POST /api/tutor/ask
    if (req.method === 'POST' && pathname === '/api/tutor/ask') {
      let body = '';
      let bytesRead = 0;

      req.on('data', (chunk) => {
        bytesRead += chunk.length;
        if (bytesRead > MAX_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload Too Large: Exceeded 64KB limit.' }));
          req.destroy();
          return;
        }
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as AskTytoRequest;
          const clientIp = req.socket.remoteAddress || '127.0.0.1';
          const response = await service.askTyto(parsed, clientIp);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err: any) {
          const statusCode = err.statusCode || 500;
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: err.message || 'Internal tutor server error',
              statusCode,
            })
          );
        }
      });
      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test' && import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const server = createTutorServer();
  server.listen(PORT, HOST, () => {
    console.log(`[WardWit] Local Tyto Tutor service running at http://${HOST}:${PORT}`);
    console.log(`[WardWit] Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'} | Corpus: ${process.env.ALLOWED_CORPUS_ID || 'wardwit-approved-core'}`);
  });
}
