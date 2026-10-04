import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Send,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { TytoMascot } from '../mascot/TytoMascot';
import { tutorClient } from '../../services/tutorClient';
import type {
  AskTytoClientRequest,
  AskTytoResponse,
  CitationRecord,
  TutorStatusResponse,
} from '../../domain/tutorTypes';
import type { Question, QuestionUserAnswer } from '../../domain/types';

interface AskTytoSectionProps {
  question: Question;
  userAnswer?: QuestionUserAnswer;
  isTimedSessionActive?: boolean;
}

export const AskTytoSection: React.FC<AskTytoSectionProps> = ({
  question,
  userAnswer,
  isTimedSessionActive = false,
}) => {
  const [tutorStatus, setTutorStatus] = useState<TutorStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskTytoResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'rate_limit' | 'timeout' | 'unconfigured' | 'general' | null>(null);

  const [showSources, setShowSources] = useState(false);
  const [activeExcerpt, setActiveExcerpt] = useState<CitationRecord | null>(null);

  const selectedOptId = userAnswer?.firstSubmittedOptionId ?? userAnswer?.selectedOptionId ?? null;
  const isCorrect = selectedOptId === question.correctOptionId;
  const hasDiagram = Boolean(question.explanationMedia || question.questionMedia || question.imageMetadata);

  // Check backend status on mount
  useEffect(() => {
    if (isTimedSessionActive) return;
    let mounted = true;
    tutorClient
      .getStatus()
      .then((status) => {
        if (mounted) {
          setTutorStatus(status);
          setLoadingStatus(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setTutorStatus({
            configured: false,
            model: 'gemini-2.5-flash',
            corpusId: 'wardwit-approved-core',
            approvedDocumentsCount: 0,
            approvedChunksCount: 0,
            serviceStatus: 'unconfigured',
          });
          setLoadingStatus(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isTimedSessionActive]);

  // If in an active timed session (before block completion), tutor is strictly disabled
  if (isTimedSessionActive) {
    return null;
  }

  const handleAsk = async (quickAction?: 'explain_simply' | 'why_wrong' | 'explain_diagram', customText?: string) => {
    const query = customText ?? userQuery;
    setIsLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    const selectedOptionObj = question.options.find((o) => o.id === selectedOptId);
    const correctOptionObj = question.options.find((o) => o.id === question.correctOptionId);

    const payload: AskTytoClientRequest = {
      context: {
        questionId: question.id,
        questionVersion: question.version,
        topic: question.topic,
        system: question.system,
        discipline: question.discipline,
        learningObjective: question.learningObjective,
        vignette: question.vignette,
        selectedOptionId: selectedOptId,
        selectedOptionText: selectedOptionObj?.text,
        correctOptionId: question.correctOptionId,
        correctOptionText: correctOptionObj?.text,
        isCorrect,
        hasDiagram,
        diagramAltText: question.explanationMedia?.altText || question.questionMedia?.altText,
        diagramTeachingPurpose: question.explanationMedia?.teachingPurpose,
      },
      quickAction: quickAction || 'general',
      userQuery: query.trim() || undefined,
    };

    try {
      const res = await tutorClient.askTyto(payload);
      setResponse(res);
      if (quickAction) {
        setUserQuery('');
      }
    } catch (err: any) {
      const status = err.statusCode;
      if (status === 429) {
        setErrorType('rate_limit');
        setErrorMessage('Rate limit reached: Please wait a moment before sending another inquiry to Tyto.');
      } else if (status === 504) {
        setErrorType('timeout');
        setErrorMessage('Request timed out after 15 seconds. The tutor service is experiencing high load.');
      } else if (err.message && err.message.includes('API key')) {
        setErrorType('unconfigured');
        setErrorMessage(
          'Tyto AI Tutor backend requires a configured GEMINI_API_KEY in the server environment (.env).'
        );
      } else {
        setErrorType('general');
        setErrorMessage(err.message || 'Unable to connect to tutor backend.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="card-notebook"
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: 'var(--bg-surface)',
        border: '2px solid rgba(15, 118, 110, 0.28)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-shadow)',
      }}
      id={`ask-tyto-section-${question.id}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TytoMascot
            state={isLoading ? 'thinking' : 'encouraging'}
            size="sm"
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-ink)' }}>
                Ask Tyto (AI Study Companion)
              </h3>
              <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
                <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                Corpus Grounded
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              Grounded strictly in the approved study library. Never replaces clinical judgment.
            </p>
          </div>
        </div>

        {/* Backend Status Indicator */}
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          {loadingStatus ? (
            <span>Connecting...</span>
          ) : tutorStatus?.configured ? (
            <span style={{ color: 'var(--primary-teal)', fontWeight: 600 }}>
              ● Model: {tutorStatus.model}
            </span>
          ) : (
            <span style={{ color: 'var(--marigold-dark)', fontWeight: 600 }}>
              ○ Server API Key Unconfigured
            </span>
          )}
        </div>
      </div>

      {/* Quick Action Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => handleAsk('explain_simply')}
          disabled={isLoading}
          className="btn btn-secondary btn-sm"
          id="tyto-quick-explain-simply"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <Sparkles size={14} style={{ color: 'var(--primary-teal)' }} />
          <span>Explain simply</span>
        </button>

        {/* 'Why is my answer wrong?' is only supported for incorrect selections */}
        {!isCorrect && selectedOptId && (
          <button
            type="button"
            onClick={() => handleAsk('why_wrong')}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            id="tyto-quick-why-wrong"
            style={{ fontSize: '0.8rem', padding: '6px 12px', borderColor: 'var(--coral)' }}
          >
            <HelpCircle size={14} style={{ color: 'var(--coral)' }} />
            <span>Why is my Option {selectedOptId} wrong?</span>
          </button>
        )}

        {/* 'Explain the diagram' is only supported if question contains diagram media */}
        {hasDiagram && (
          <button
            type="button"
            onClick={() => handleAsk('explain_diagram')}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            id="tyto-quick-explain-diagram"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <Layers size={14} style={{ color: 'var(--primary-teal)' }} />
            <span>Explain the diagram</span>
          </button>
        )}
      </div>

      {/* Custom Query Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (userQuery.trim()) {
            handleAsk(undefined, userQuery);
          }
        }}
        style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
      >
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Ask Tyto a specific question on this topic..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(15, 118, 110, 0.25)',
            fontSize: '0.88rem',
            backgroundColor: 'var(--bg-canvas)',
            color: 'var(--text-ink)',
          }}
          id="tyto-query-input"
        />
        <button
          type="submit"
          disabled={isLoading || !userQuery.trim()}
          className="btn btn-primary btn-sm"
          id="tyto-submit-query-btn"
          style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isLoading ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
          <span>Ask</span>
        </button>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            padding: '18px',
            backgroundColor: 'var(--teal-50)',
            border: '1px solid rgba(15, 118, 110, 0.18)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <Sparkles size={16} style={{ color: 'var(--primary-teal)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-teal)' }}>
              Tyto is searching verified study sources...
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Matching question context against approved canon records.
          </p>
        </div>
      )}

      {/* Error & Unconfigured States */}
      {errorMessage && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: errorType === 'rate_limit' || errorType === 'timeout' ? 'var(--marigold-light)' : 'var(--coral-light)',
            border: `1px solid ${errorType === 'rate_limit' || errorType === 'timeout' ? 'var(--marigold-dark)' : 'var(--coral)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
          id="tyto-error-notice"
        >
          <AlertCircle
            size={18}
            style={{
              color: errorType === 'rate_limit' || errorType === 'timeout' ? 'var(--marigold-dark)' : 'var(--coral)',
              flexShrink: 0,
              marginTop: '2px',
            }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-ink)', marginBottom: '2px' }}>
              {errorType === 'rate_limit'
                ? 'Rate Limit Exceeded'
                : errorType === 'timeout'
                ? 'Request Timeout'
                : errorType === 'unconfigured'
                ? 'Backend Setup Required'
                : 'Tutor Service Notice'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-ink)', lineHeight: 1.4 }}>
              {errorMessage}
            </div>
            {errorType === 'unconfigured' && (
              <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Configure <code>GEMINI_API_KEY</code> in <code>.env</code> and restart the local server via <code>npm run tutor:server</code>.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Successful Response View */}
      {response && (
        <div
          style={{
            padding: '18px',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid rgba(15, 118, 110, 0.2)',
            borderRadius: 'var(--radius-md)',
          }}
          id="tyto-response-card"
        >
          {/* Conflicting Passages Callout */}
          {response.conflictDetected && (
            <div
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                backgroundColor: 'var(--marigold-light)',
                border: '1px solid var(--marigold-dark)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
              id="tyto-conflict-warning"
            >
              <AlertTriangle size={16} style={{ color: 'var(--marigold-dark)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.84rem', color: 'var(--text-ink)' }}>Documented Source Conflict</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-ink)', margin: 0 }}>
                  {response.conflictDetails || 'Different authorized works in the corpus present divergent findings for this topic. Both perspectives are cited below.'}
                </p>
              </div>
            </div>
          )}

          {/* Insufficient Sources Notice */}
          {response.insufficientSources && (
            <div
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                backgroundColor: 'var(--teal-50)',
                border: '1px solid var(--primary-teal)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
              id="tyto-insufficient-notice"
            >
              <BookOpen size={16} style={{ color: 'var(--primary-teal)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.84rem', color: 'var(--primary-teal)' }}>Insufficient Authorized Sources</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-ink)', margin: 0 }}>
                  Tyto is constrained to authorized study sources and does not provide ungrounded answers when verified sources are absent. AI explanations are study aids and must be cross-checked against primary references.
                </p>
              </div>
            </div>
          )}

          {/* Short Explanation First */}
          <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-ink)', marginBottom: '14px', whiteSpace: 'pre-line' }}>
            {response.answer}
          </div>

          {/* Verified Citations Accordion */}
          {response.citations.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(15, 118, 110, 0.15)', paddingTop: '12px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '6px 0',
                  cursor: 'pointer',
                  color: 'var(--primary-teal)',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                }}
                id="tyto-toggle-citations-btn"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} />
                  <span>Verified Source References ({response.citations.length})</span>
                </div>
                {showSources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showSources && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {response.citations.map((cit) => (
                    <div
                      key={cit.citationId}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid rgba(15, 118, 110, 0.15)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                      }}
                      id={`tyto-citation-${cit.citationId}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <strong style={{ color: 'var(--text-ink)', display: 'block' }}>
                            {cit.title} ({cit.edition})
                          </strong>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {cit.section} • <strong>{cit.printedPageLabel}</strong>
                            {cit.pdfPageIndex > 0 && ` (PDF p. ${cit.pdfPageIndex})`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveExcerpt(cit)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '4px 8px', flexShrink: 0 }}
                          id={`tyto-view-excerpt-${cit.citationId}`}
                        >
                          View Excerpt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Model & Disclaimer Footer */}
          <div
            style={{
              marginTop: '14px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(15, 118, 110, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>{response.disclaimer}</span>
            <span>
              Model: {response.model} • {response.latencyMs}ms
            </span>
          </div>
        </div>
      )}

      {/* Modal: Source Excerpt Viewer */}
      {activeExcerpt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setActiveExcerpt(null)}
          id="tyto-source-excerpt-modal"
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              boxShadow: 'var(--card-shadow)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--primary-teal)' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-ink)' }}>
                  Verified Canon Source Excerpt
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveExcerpt(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              <div><strong>Document:</strong> {activeExcerpt.title}</div>
              <div><strong>Edition:</strong> {activeExcerpt.edition}</div>
              <div><strong>Section:</strong> {activeExcerpt.section}</div>
              <div><strong>Page Reference:</strong> {activeExcerpt.printedPageLabel} (PDF Page {activeExcerpt.pdfPageIndex})</div>
              <div><strong>Status:</strong> Approved Canonical Document</div>
            </div>

            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(15, 118, 110, 0.2)',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: 'var(--text-ink)',
                fontStyle: 'italic',
              }}
            >
              "{activeExcerpt.excerpt}"
            </div>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setActiveExcerpt(null)}
                className="btn btn-primary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
