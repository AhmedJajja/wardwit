import React, { useState } from 'react';
import type { EducationalMedia, SessionMode } from '../../domain/types';
import { ZoomIn, X, AlertCircle, BookOpen, CheckCircle2 } from 'lucide-react';

interface EducationalDiagramProps {
  media?: EducationalMedia;
  mode: 'vignette' | 'explanation';
  isRevealed?: boolean;
  sessionMode?: SessionMode;
  isSessionCompleted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EducationalDiagram: React.FC<EducationalDiagramProps> = ({
  media,
  mode,
  isRevealed = true,
  sessionMode = 'tutor',
  isSessionCompleted = false,
  className = '',
  style = {},
}) => {
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  if (!media) return null;

  // Gating Enforcement:
  // In timed mode during block: explanation diagrams remain strictly unavailable until block completion.
  if (mode === 'explanation') {
    if (sessionMode === 'timed' && !isSessionCompleted) {
      return (
        <div
          className={`card-notebook ${className}`}
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            ...style,
          }}
          aria-label="Withheld explanation diagram"
        >
          <BookOpen size={16} />
          <span>Educational diagram will become available after block completion.</span>
        </div>
      );
    }

    // In tutor mode or cards before submission/reveal
    if (!isRevealed) {
      return (
        <div
          className={`card-notebook ${className}`}
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            ...style,
          }}
          aria-label="Withheld explanation diagram"
        >
          <BookOpen size={16} />
          <span>Educational diagram reveals with answer rationale.</span>
        </div>
      );
    }
  }

  const { url, svg, alt, caption, fallbackExplanation, provenance } = media;

  return (
    <div
      className={`educational-diagram-container ${className}`}
      style={{
        margin: '14px 0',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid rgba(15, 118, 110, 0.16)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--card-shadow)',
        ...style,
      }}
    >
      {/* Diagram Viewer Area */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          minHeight: '140px',
        }}
      >
        {loadError ? (
          /* Accessible Fallback when image fails to load */
          <div
            style={{
              padding: '16px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 'var(--radius-sm)',
              color: '#991B1B',
              fontSize: '0.88rem',
              lineHeight: 1.5,
              width: '100%',
            }}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '6px' }}>
              <AlertCircle size={16} />
              <span>Diagram Rendering Unavailable</span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-ink)' }}>
              <strong>Educational Description: </strong>
              {fallbackExplanation || alt || 'Clinical diagram description.'}
            </p>
          </div>
        ) : svg ? (
          <div
            style={{ width: '100%', maxHeight: '420px', overflow: 'hidden' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : url ? (
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img
              src={url}
              alt={alt}
              onError={() => setLoadError(true)}
              style={{
                maxWidth: '100%',
                maxHeight: '360px',
                objectFit: 'contain',
                borderRadius: 'var(--radius-sm)',
                display: 'block',
                cursor: 'zoom-in',
              }}
              onClick={() => setIsZoomed(true)}
            />
            <button
              type="button"
              onClick={() => setIsZoomed(true)}
              className="btn btn-sm btn-secondary"
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                minHeight: '28px',
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
              }}
              aria-label="Zoom diagram"
            >
              <ZoomIn size={13} />
              <span>Zoom</span>
            </button>
          </div>
        ) : (
          <div style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {fallbackExplanation || alt}
          </div>
        )}
      </div>

      {/* Caption & Metadata Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(15, 118, 110, 0.1)' }}>
        {caption && (
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-ink)', marginBottom: '6px' }}>
            {caption}
          </div>
        )}

        {/* Provenance and Citation details */}
        {provenance && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--primary-teal)' }}>
              Source: {provenance.source} {provenance.edition ? `(${provenance.edition})` : ''}
            </span>

            {/* Distinguish printed book pages from electronic PDF indices without guessing */}
            {provenance.printedPage && (
              <span className="badge badge-teal" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                Printed: {provenance.printedPage}
              </span>
            )}
            {provenance.pdfPageIndex !== undefined && (
              <span className="badge badge-mint" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                PDF Index: {provenance.pdfPageIndex}
              </span>
            )}

            {provenance.editorialStatus && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: provenance.editorialStatus === 'approved' ? 'var(--mint)' : 'var(--gold-dark)',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={12} />
                <span>{provenance.editorialStatus === 'approved' ? 'Reviewed' : provenance.editorialStatus}</span>
              </span>
            )}

            {provenance.licenseOrPermission && (
              <span style={{ fontStyle: 'italic' }}>
                • {provenance.licenseOrPermission}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Zoom / Lightbox Modal for small and desktop screens */}
      {isZoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded diagram view"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsZoomed(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              overflow: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-ink)' }}>
                {caption || alt}
              </div>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="btn btn-secondary btn-sm"
                style={{ minHeight: '32px', padding: '4px 10px' }}
                aria-label="Close zoom"
              >
                <X size={16} />
                <span>Close</span>
              </button>
            </div>

            {url && (
              <img
                src={url}
                alt={alt}
                style={{
                  maxWidth: '100%',
                  maxHeight: '76vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)',
                  display: 'block',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
