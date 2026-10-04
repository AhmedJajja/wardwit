/**
 * Media and Diagram Security Sanitizer
 * 
 * Enforces strict security constraints on imported and authored educational media:
 * 1. Safe URLs only (https:, http:, safe data:image/ base64, or local /assets/ paths).
 * 2. Rejects executable arbitrary SVG/HTML (<script>, on* event handlers, javascript: URIs).
 * 3. Preserves structured provenance: source work, edition, printed page label,
 *    and electronic PDF page index (distinguished without guessing).
 * 4. Fallback explanation text support for accessibility and load failures.
 */

import type { EducationalMedia, MediaProvenance, QuestionImageMetadata, EditorialStatus } from './types';

const SAFE_URL_PATTERN = /^(https?:\/\/|\/|\.\/|assets\/|images\/|data:image\/(png|jpe?g|webp|svg\+xml);base64,)/i;

/**
 * Validates whether a media URL or data URI is safe for browser rendering.
 */
export function isSafeMediaUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  // Disallow javascript: or data:text/html or script tags
  if (/^javascript:/i.test(trimmed) || /data:text\//i.test(trimmed) || /<script/i.test(trimmed)) {
    return false;
  }
  return SAFE_URL_PATTERN.test(trimmed);
}

/**
 * Sanitizes SVG code to remove any executable scripts, foreignObjects, or event handlers.
 */
export function sanitizeSvgCode(rawSvg?: string | null): string | undefined {
  if (!rawSvg || typeof rawSvg !== 'string') return undefined;
  let clean = rawSvg.trim();
  if (!clean) return undefined;

  // Remove <script> elements and contents
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove <foreignObject> elements which can embed arbitrary HTML
  clean = clean.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  // Remove inline on* handlers (onload, onclick, onerror, etc.)
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*(['"]).*?\1/gi, '');
  clean = clean.replace(/\son[a-zA-Z]+\s*=\s*[^>\s]+/gi, '');
  // Remove javascript: URIs in href or xlink:href
  clean = clean.replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href=""');
  clean = clean.replace(/xlink:href\s*=\s*(['"])javascript:.*?\1/gi, 'xlink:href=""');

  return clean.length > 0 ? clean : undefined;
}

/**
 * Sanitizes plain string inputs, trimming and removing potential tag injections.
 */
export function sanitizePlainString(str?: unknown): string {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/<[^>]*>?/gm, '');
}

/**
 * Sanitizes media provenance metadata.
 * Explicitly distinguishes printed page labels from electronic PDF page indices.
 */
export function sanitizeProvenance(raw?: any): MediaProvenance | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const source = sanitizePlainString(raw.source);
  if (!source) return undefined;

  const edition = raw.edition ? sanitizePlainString(raw.edition) : undefined;
  const printedPage = raw.printedPage ? sanitizePlainString(raw.printedPage) : undefined;

  let pdfPageIndex: number | undefined;
  if (typeof raw.pdfPageIndex === 'number' && Number.isInteger(raw.pdfPageIndex) && raw.pdfPageIndex >= 0) {
    pdfPageIndex = raw.pdfPageIndex;
  }

  const licenseOrPermission = raw.licenseOrPermission
    ? sanitizePlainString(raw.licenseOrPermission)
    : raw.provenance
    ? sanitizePlainString(raw.provenance)
    : undefined;

  const validStatuses: EditorialStatus[] = ['draft', 'in_review', 'approved', 'archived'];
  const editorialStatus: EditorialStatus | undefined = validStatuses.includes(raw.editorialStatus)
    ? raw.editorialStatus
    : undefined;

  const reviewedBy = raw.reviewedBy ? sanitizePlainString(raw.reviewedBy) : null;

  return {
    source,
    edition,
    printedPage,
    pdfPageIndex,
    licenseOrPermission,
    editorialStatus,
    reviewedBy,
  };
}

/**
 * Sanitizes an educational diagram / media structure.
 * Returns undefined if neither safe URL nor safe SVG is provided or if alt text is blank.
 */
export function sanitizeEducationalMedia(raw?: any): EducationalMedia | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  let url: string | undefined;
  if (raw.url && typeof raw.url === 'string') {
    const candidate = raw.url.trim();
    if (isSafeMediaUrl(candidate)) {
      url = candidate;
    }
  }

  let svg: string | undefined;
  if (raw.svg && typeof raw.svg === 'string') {
    svg = sanitizeSvgCode(raw.svg);
  }

  // Must have at least a valid URL or SVG
  if (!url && !svg) return undefined;

  // Meaningful alt text (required for medical diagram accessibility)
  const alt = sanitizePlainString(raw.alt || raw.altText) || 'Clinical scenario diagram';
  const caption = raw.caption ? sanitizePlainString(raw.caption) : undefined;
  const fallbackExplanation = raw.fallbackExplanation
    ? sanitizePlainString(raw.fallbackExplanation)
    : undefined;

  const provenance = sanitizeProvenance(raw.provenance);

  return {
    id: raw.id ? sanitizePlainString(raw.id) : undefined,
    url,
    svg,
    alt,
    altText: alt,
    caption,
    fallbackExplanation,
    teachingPurpose: raw.teachingPurpose ? sanitizePlainString(raw.teachingPurpose) : undefined,
    provenance,
    reviewStatus: raw.reviewStatus,
  };
}

/**
 * Migrates legacy QuestionImageMetadata to EducationalMedia format as vignette media.
 * Ensures question-relevant images stay with the question vignette and do not get moved behind the answer.
 */
export function migrateLegacyImageMetadata(legacy?: QuestionImageMetadata | any | null): EducationalMedia | undefined {
  if (!legacy || typeof legacy !== 'object') return undefined;

  const url = isSafeMediaUrl(legacy.url) ? legacy.url!.trim() : undefined;
  const svg = sanitizeSvgCode(legacy.svg);
  if (!url && !svg) return undefined;

  const alt = sanitizePlainString(legacy.alt || legacy.altText) || 'Clinical scenario illustration';
  const caption = legacy.caption ? sanitizePlainString(legacy.caption) : undefined;
  const source = sanitizePlainString(legacy.source || legacy.provenance?.source || legacy.provenance || 'Clinical Teaching Archive');
  const printedPage = legacy.page || legacy.provenance?.printedPage ? sanitizePlainString(legacy.page || legacy.provenance?.printedPage) : undefined;

  return {
    id: legacy.id ? sanitizePlainString(legacy.id) : undefined,
    url,
    svg,
    alt,
    altText: alt,
    caption,
    provenance: {
      source,
      printedPage,
      licenseOrPermission: 'Preserved from legacy question metadata',
    },
  };
}
