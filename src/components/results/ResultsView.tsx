import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ClipMascot } from '../mascot/ClipMascot';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { BRAND } from '../../config/brand.config';
import type { StudySession, UserSettings } from '../../domain/types';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RotateCcw,
  Flag,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface ResultsViewProps {
  session: StudySession;
  settings: UserSettings;
  onStartReviewSession: (questionIds: string[]) => void;
  onReturnToDashboard: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  session,
  settings,
  onStartReviewSession,
  onReturnToDashboard,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'flagged'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const score = session.score || {
    totalQuestions: session.questionSnapshots.length,
    correctCount: 0,
    incorrectCount: 0,
    unansweredCount: 0,
    percentage: 0,
    totalTimeSeconds: 0,
    confidenceBreakdown: {
      confident: { total: 0, correct: 0 },
      unsure: { total: 0, correct: 0 },
      guessed: { total: 0, correct: 0 },
      unrated: { total: 0, correct: 0 },
    },
  };

  const isCelebration = score.percentage >= 70;

  // Trigger celebration confetti if high score and quiet mode is disabled
  useEffect(() => {
    if (isCelebration && !settings.quietMode) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#145355', '#E06A55', '#F4A259', '#48A9A6'],
      });
    }
  }, [isCelebration, settings.quietMode]);

  // Mascot quote selection
  const mascotPose = isCelebration ? 'celebration' : 'encouragement';
  const quotesPool = isCelebration ? BRAND.humorQuotes.celebration : BRAND.humorQuotes.encouragement;
  const quote = quotesPool[Math.floor(Math.random() * quotesPool.length)];

  // Filtered review questions
  const filteredQuestions = session.questionSnapshots.filter((q) => {
    const ans = session.answers[q.id];
    const chosen = ans?.firstSubmittedOptionId ?? ans?.selectedOptionId;
    const isCorrect = chosen === q.correctOptionId;

    if (filterMode === 'incorrect') {
      return !isCorrect;
    }
    if (filterMode === 'flagged') {
      return Boolean(ans?.isFlagged);
    }
    return true;
  });

  // Collect IDs of incorrect / flagged questions for launching review session
  const incorrectIds = session.questionSnapshots
    .filter((q) => {
      const ans = session.answers[q.id];
      const chosen = ans?.firstSubmittedOptionId ?? ans?.selectedOptionId;
      return chosen !== q.correctOptionId;
    })
    .map((q) => q.id);

  const flaggedIds = session.questionSnapshots
    .filter((q) => session.answers[q.id]?.isFlagged)
    .map((q) => q.id);

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Top Banner with Mascot */}
      <div
        className="card-notebook"
        style={{
          marginTop: '16px',
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          background: isCelebration
            ? 'linear-gradient(135deg, var(--bg-surface) 0%, var(--mint-light) 100%)'
            : 'linear-gradient(135deg, var(--bg-surface) 0%, var(--marigold-light) 100%)',
        }}
      >
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-teal">Completed Practice Block</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {session.mode.toUpperCase()} MODE
            </span>
          </div>

          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>
            Block Performance Summary
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Session finalized on {new Date(session.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
            Results are permanently saved to your browser audit log.
          </p>
        </div>

        <ClipMascot
          pose={mascotPose}
          size={120}
          speechBubble={quote}
          quietMode={settings.quietMode}
        />
      </div>

      {/* Primary Score Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginTop: '20px',
        }}
      >
        {/* Score % */}
        <div className="card-notebook" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Overall Score
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2.8rem',
              fontWeight: 800,
              color: isCelebration ? 'var(--mint)' : score.percentage >= 50 ? 'var(--marigold)' : 'var(--coral)',
              margin: '4px 0',
            }}
          >
            {score.percentage}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {score.correctCount} of {score.totalQuestions} items correct
          </div>
        </div>

        {/* Correct */}
        <div className="card-notebook" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--mint)', marginBottom: '4px' }}>
            <CheckCircle2 size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Correct</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-ink)' }}>
            {score.correctCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {score.totalQuestions > 0 ? Math.round((score.correctCount / score.totalQuestions) * 100) : 0}% of block
          </div>
        </div>

        {/* Incorrect */}
        <div className="card-notebook" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--coral)', marginBottom: '4px' }}>
            <XCircle size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Incorrect</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-ink)' }}>
            {score.incorrectCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>High-yield review targets</div>
        </div>

        {/* Unanswered */}
        <div className="card-notebook" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-light)', marginBottom: '4px' }}>
            <HelpCircle size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Unanswered</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-ink)' }}>
            {score.unansweredCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Scored as 0 points</div>
        </div>

        {/* Elapsed Time */}
        <div className="card-notebook" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--primary-teal)', marginBottom: '4px' }}>
            <Clock size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Pace / Time</span>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: 'var(--text-ink)', marginTop: '4px' }}>
            {Math.floor(score.totalTimeSeconds / 60)}m {score.totalTimeSeconds % 60}s
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            ~{score.totalQuestions > 0 ? Math.round(score.totalTimeSeconds / score.totalQuestions) : 0}s per question
          </div>
        </div>
      </div>

      {/* Metacognitive Confidence Matrix */}
      <div className="card-notebook" style={{ marginTop: '24px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Sparkles size={20} style={{ color: 'var(--primary-teal)' }} />
          <h2 style={{ fontSize: '1.2rem' }}>Confidence vs Correctness Matrix</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Analyze self-calibration: identifies dangerous blind spots (confident but wrong) and lucky guesses (unsure but correct).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Confident */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-ink)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px', color: 'var(--primary-teal)' }}>
              Rated: Confident
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              {score.confidenceBreakdown.confident.correct} / {score.confidenceBreakdown.confident.total} Correct
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {score.confidenceBreakdown.confident.total - score.confidenceBreakdown.confident.correct > 0 ? (
                <span style={{ color: 'var(--coral)', fontWeight: 600 }}>
                  ⚠️ {score.confidenceBreakdown.confident.total - score.confidenceBreakdown.confident.correct} blind spot(s) to review!
                </span>
              ) : (
                'Strong conceptual alignment'
              )}
            </div>
          </div>

          {/* Unsure */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-ink)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px', color: 'var(--marigold)' }}>
              Rated: Unsure
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              {score.confidenceBreakdown.unsure.correct} / {score.confidenceBreakdown.unsure.total} Correct
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Concepts requiring reinforcement
            </div>
          </div>

          {/* Guessed */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-ink)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px', color: 'var(--coral)' }}>
              Rated: Guessed
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              {score.confidenceBreakdown.guessed.correct} / {score.confidenceBreakdown.guessed.total} Correct
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {score.confidenceBreakdown.guessed.correct > 0 && 'Includes lucky guesses; study rationales.'}
            </div>
          </div>
        </div>
      </div>

      {/* Review Actions Banner */}
      <div
        className="card-notebook"
        style={{
          marginTop: '24px',
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-surface-alt)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RotateCcw size={20} style={{ color: 'var(--primary-teal)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>Targeted Remediation</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Launch a targeted review block with questions from this session
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {incorrectIds.length > 0 && (
            <button
              onClick={() => onStartReviewSession(incorrectIds)}
              className="btn btn-accent-coral btn-sm"
              id="results-review-incorrects-btn"
            >
              <RotateCcw size={14} />
              <span>Review {incorrectIds.length} Incorrects</span>
            </button>
          )}

          {flaggedIds.length > 0 && (
            <button
              onClick={() => onStartReviewSession(flaggedIds)}
              className="btn btn-secondary btn-sm"
              id="results-review-flagged-btn"
            >
              <Flag size={14} />
              <span>Review {flaggedIds.length} Flagged</span>
            </button>
          )}

          <button
            onClick={onReturnToDashboard}
            className="btn btn-primary btn-sm"
            id="results-dashboard-btn"
          >
            <span>Back to Dashboard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Question-by-Question Review List */}
      <div className="card-notebook" style={{ marginTop: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <span className="badge badge-mint" style={{ marginBottom: '4px' }}>Item Breakdown</span>
            <h2 style={{ fontSize: '1.35rem' }}>Question-by-Question Review</h2>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setFilterMode('all')}
              className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All ({session.questionSnapshots.length})
            </button>
            <button
              onClick={() => setFilterMode('incorrect')}
              className={`btn btn-sm ${filterMode === 'incorrect' ? 'btn-accent-coral' : 'btn-secondary'}`}
            >
              Incorrect ({incorrectIds.length})
            </button>
            <button
              onClick={() => setFilterMode('flagged')}
              className={`btn btn-sm ${filterMode === 'flagged' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Flagged ({flaggedIds.length})
            </button>
          </div>
        </div>

        {/* Questions Accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredQuestions.map((q, idx) => {
            const ans = session.answers[q.id];
            const chosen = ans?.firstSubmittedOptionId ?? ans?.selectedOptionId;
            const isCorrect = chosen === q.correctOptionId;
            const isExpanded = expandedQuestionId === q.id;

            return (
              <div
                key={q.id}
                className="card-notebook"
                style={{
                  border: `2px solid ${isCorrect ? 'var(--border-ink)' : 'var(--coral)'}`,
                  backgroundColor: 'var(--bg-surface)',
                  overflow: 'hidden',
                }}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: isCorrect ? 'var(--bg-surface)' : 'var(--coral-light)',
                    gap: '12px',
                  }}
                  id={`review-question-${q.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--border-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        backgroundColor: isCorrect ? 'var(--mint-light)' : '#FFFFFF',
                        color: isCorrect ? 'var(--mint)' : 'var(--coral)',
                      }}
                    >
                      {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        Item #{idx + 1}: {q.topic}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {q.system} • {q.discipline}
                        {ans?.confidence && ` • Rated: ${ans.confidence}`}
                        {ans?.isFlagged && ' • 🚩 Flagged'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ fontSize: '0.85rem', textAlign: 'right' }}>
                      <div>Your Choice: <strong>{chosen || 'None'}</strong></div>
                      <div>Correct: <strong>{q.correctOptionId}</strong></div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--border-ink)', backgroundColor: 'var(--bg-canvas)' }}>
                    <div style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '16px', whiteSpace: 'pre-line' }}>
                      {q.vignette}
                    </div>

                    {/* Options list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {q.options.map((opt) => {
                        const optIsCorrect = opt.id === q.correctOptionId;
                        const optIsChosen = opt.id === chosen;

                        return (
                          <div
                            key={opt.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 'var(--radius-sm)',
                              border: optIsCorrect
                                ? '2px solid var(--mint)'
                                : optIsChosen
                                ? '2px solid var(--coral)'
                                : '1px solid var(--border-ink)',
                              backgroundColor: optIsCorrect
                                ? 'var(--mint-light)'
                                : optIsChosen
                                ? 'var(--coral-light)'
                                : 'var(--bg-surface)',
                              fontSize: '0.88rem',
                            }}
                          >
                            <strong>Option {opt.id}: </strong>
                            <span>{opt.text}</span>
                            {optIsCorrect && <span style={{ color: 'var(--mint)', fontWeight: 700, marginLeft: '8px' }}>✓ Correct Key</span>}
                            {optIsChosen && !optIsCorrect && <span style={{ color: 'var(--coral)', fontWeight: 700, marginLeft: '8px' }}>✗ Your Choice</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* High Yield Takeaway */}
                    <div
                      style={{
                        backgroundColor: 'var(--mint-light)',
                        border: '2px solid var(--mint)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        marginBottom: '14px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <strong style={{ color: 'var(--primary-teal)', display: 'block', marginBottom: '4px' }}>
                        Key High-Yield Takeaway:
                      </strong>
                      <span>{q.keyTakeaway}</span>
                    </div>

                    {/* Full Explanation */}
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-ink)', lineHeight: 1.5 }}>
                      <strong>Full Explanation: </strong>
                      {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
