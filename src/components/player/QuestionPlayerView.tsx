import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { getRemainingSeconds, isTimerExpired, formatRemainingTime } from '../../domain/timer';
import type { StudySession, ConfidenceLevel, UserSettings } from '../../domain/types';
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Check,
  Strikethrough,
  Save,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface QuestionPlayerViewProps {
  session: StudySession;
  settings: UserSettings;
  onSaveSession: (updated: StudySession) => Promise<void>;
  onFinishSession: (session: StudySession) => void;
  onExitToDashboard: () => void;
}

export const QuestionPlayerView: React.FC<QuestionPlayerViewProps> = ({
  session: initialSession,
  settings: _settings,
  onSaveSession,
  onFinishSession,
  onExitToDashboard,
}) => {
  const [session, setSession] = useState<StudySession>(initialSession);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [remainingSecs, setRemainingSecs] = useState<number>(() => {
    if (session.mode === 'timed' && session.expiresAt) {
      return getRemainingSeconds(session.expiresAt);
    }
    return 0;
  });

  const currentIndex = session.currentIndex;
  const currentQuestion = session.questionSnapshots[currentIndex];
  const currentAnswer = session.answers[currentQuestion?.id] || {
    selectedOptionId: null,
    isFlagged: false,
    eliminatedOptionIds: [],
    timeSpentSeconds: 0,
  };

  // Tutor mode submission status for this question
  const isQuestionSubmitted = Boolean(
    session.mode === 'tutor' && currentAnswer.submittedAt
  );

  // Question timer tracker
  const questionStartTimeRef = useRef<number>(Date.now());

  // Autosave helper with debounce/immediate trigger
  const persistSession = useCallback(
    async (updated: StudySession) => {
      setSaveStatus('saving');
      try {
        await onSaveSession(updated);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save session:', err);
        setSaveStatus('error');
      }
    },
    [onSaveSession]
  );

  // Timed mode interval countdown based on deadline
  useEffect(() => {
    if (session.mode !== 'timed' || !session.expiresAt || session.status === 'completed') {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const secs = getRemainingSeconds(session.expiresAt!, now);
      setRemainingSecs(secs);

      if (isTimerExpired(session.expiresAt!, now)) {
        clearInterval(interval);
        // Time expired! Auto-finalize session
        onFinishSession(session);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, onFinishSession]);

  // Record time spent on current question when leaving it
  const updateTimeSpent = useCallback(() => {
    const elapsedSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    questionStartTimeRef.current = Date.now();

    if (!currentQuestion) return session;

    const existingAns = session.answers[currentQuestion.id] || {
      selectedOptionId: null,
      isFlagged: false,
      eliminatedOptionIds: [],
      timeSpentSeconds: 0,
    };

    const updatedSession: StudySession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: {
          ...existingAns,
          timeSpentSeconds: existingAns.timeSpentSeconds + elapsedSeconds,
        },
      },
    };
    return updatedSession;
  }, [session, currentQuestion]);

  // Navigate to question index
  const goToQuestion = (index: number) => {
    if (index < 0 || index >= session.questionSnapshots.length) return;
    const withTime = updateTimeSpent();
    const updated: StudySession = {
      ...withTime,
      currentIndex: index,
    };
    setSession(updated);
    persistSession(updated);
  };

  // Option selection
  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) return;
    // In tutor mode, if already submitted, do not change selected option
    if (session.mode === 'tutor' && isQuestionSubmitted) return;

    const existing = session.answers[currentQuestion.id] || {
      selectedOptionId: null,
      isFlagged: false,
      eliminatedOptionIds: [],
      timeSpentSeconds: 0,
    };

    const updated: StudySession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: {
          ...existing,
          selectedOptionId: optionId,
        },
      },
    };
    setSession(updated);
    persistSession(updated);
  };

  // Flag toggle
  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const existing = session.answers[currentQuestion.id] || {
      selectedOptionId: null,
      isFlagged: false,
      eliminatedOptionIds: [],
      timeSpentSeconds: 0,
    };

    const updated: StudySession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: {
          ...existing,
          isFlagged: !existing.isFlagged,
        },
      },
    };
    setSession(updated);
    persistSession(updated);
  };

  // Strike-through / eliminate option
  const handleToggleEliminate = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentQuestion) return;
    if (session.mode === 'tutor' && isQuestionSubmitted) return;

    const existing = session.answers[currentQuestion.id] || {
      selectedOptionId: null,
      isFlagged: false,
      eliminatedOptionIds: [],
      timeSpentSeconds: 0,
    };

    const eliminated = existing.eliminatedOptionIds || [];
    const isEliminated = eliminated.includes(optionId);
    const newEliminated = isEliminated
      ? eliminated.filter((id) => id !== optionId)
      : [...eliminated, optionId];

    const updated: StudySession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: {
          ...existing,
          eliminatedOptionIds: newEliminated,
          // If we eliminate the currently selected option, deselect it
          selectedOptionId:
            !isEliminated && existing.selectedOptionId === optionId
              ? null
              : existing.selectedOptionId,
        },
      },
    };
    setSession(updated);
    persistSession(updated);
  };

  // Confidence rating
  const handleSetConfidence = (level: ConfidenceLevel) => {
    if (!currentQuestion) return;
    const existing = session.answers[currentQuestion.id] || {
      selectedOptionId: null,
      isFlagged: false,
      eliminatedOptionIds: [],
      timeSpentSeconds: 0,
    };

    const updated: StudySession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: {
          ...existing,
          confidence: existing.confidence === level ? undefined : level,
        },
      },
    };
    setSession(updated);
    persistSession(updated);
  };

  // Tutor mode: Submit Answer
  const handleSubmitTutorAnswer = () => {
    if (!currentQuestion || !currentAnswer.selectedOptionId) return;

    const existing = session.answers[currentQuestion.id];
    const updated: StudySession = {
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: {
          ...existing,
          firstSubmittedOptionId: existing.firstSubmittedOptionId || existing.selectedOptionId,
          submittedAt: Date.now(),
        },
      },
    };
    setSession(updated);
    persistSession(updated);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key.toUpperCase();

      // Flag toggle (F)
      if (key === 'F') {
        e.preventDefault();
        handleToggleFlag();
        return;
      }

      // Next / Previous (N / P or Arrow keys)
      if (key === 'N' || e.key === 'ArrowRight') {
        if (currentIndex < session.questionSnapshots.length - 1) {
          e.preventDefault();
          goToQuestion(currentIndex + 1);
        }
        return;
      }
      if (key === 'P' || e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
          e.preventDefault();
          goToQuestion(currentIndex - 1);
        }
        return;
      }

      // Option selection by key (1-5 or A-E)
      const options = currentQuestion?.options || [];
      let optionIndex = -1;
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        optionIndex = parseInt(e.key, 10) - 1;
      } else if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        optionIndex = key.charCodeAt(0) - 65;
      }

      if (optionIndex >= 0 && optionIndex < options.length) {
        e.preventDefault();
        handleSelectOption(options[optionIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, session, currentQuestion, handleToggleFlag, handleSelectOption]);

  // Compute answered and unanswered counts
  const totalQuestions = session.questionSnapshots.length;
  const answeredCount = session.questionSnapshots.filter(
    (q) => session.answers[q.id]?.selectedOptionId
  ).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '16px' }}>
      {/* Top Header: Session Info, Timer, Autosave Status, and Action Controls */}
      <div
        className="card-notebook"
        style={{
          padding: '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              updateTimeSpent();
              onExitToDashboard();
            }}
            className="btn btn-secondary btn-sm"
            title="Return to dashboard (Session is automatically saved)"
            id="player-exit-btn"
          >
            <LogOut size={14} />
            <span>Dashboard</span>
          </button>

          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{session.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Mode: <strong style={{ textTransform: 'capitalize' }}>{session.mode}</strong>
              {session.mode === 'timed' && ' • Deadline active'}
            </div>
          </div>
        </div>

        {/* Center: Timer Display for Timed Mode */}
        {session.mode === 'timed' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: remainingSecs < 120 ? 'var(--coral-light)' : 'var(--bg-canvas)',
              color: remainingSecs < 120 ? 'var(--coral)' : 'var(--text-ink)',
              border: '2px solid var(--border-ink)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 800,
              fontSize: '1.15rem',
              fontFamily: 'monospace',
            }}
            title="Deadline-based countdown. Leaving this screen does not pause the countdown."
            id="timed-block-clock"
          >
            <Clock size={18} />
            <span>{formatRemainingTime(remainingSecs)}</span>
          </div>
        )}

        {/* Right: Autosave Status & End Block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.75rem',
              color: saveStatus === 'error' ? 'var(--coral)' : 'var(--text-muted)',
            }}
          >
            <Save size={13} />
            <span>
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'error'
                ? 'Save error!'
                : 'Saved locally'}
            </span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="btn btn-primary btn-sm"
            id="player-finish-block-btn"
          >
            <Send size={14} />
            <span>Submit Block</span>
          </button>
        </div>
      </div>

      {/* Nonclinical Demo Content Banner */}
      <DisclaimerBanner className="mb-3" />

      {/* Question Palette / Navigator */}
      <div
        className="card-notebook"
        style={{
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          backgroundColor: 'var(--bg-surface)',
        }}
        aria-label="Question Navigation Palette"
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Questions:
        </span>
        {session.questionSnapshots.map((q, idx) => {
          const ans = session.answers[q.id];
          const isSelected = idx === currentIndex;
          const isAnswered = Boolean(ans?.selectedOptionId);
          const isFlagged = Boolean(ans?.isFlagged);

          let bg = 'var(--bg-canvas)';
          let fg = 'var(--text-ink)';
          if (isSelected) {
            bg = 'var(--primary-teal)';
            fg = '#FFFFFF';
          } else if (isAnswered) {
            bg = 'var(--mint-light)';
            fg = 'var(--primary-teal)';
          }

          return (
            <button
              key={q.id}
              onClick={() => goToQuestion(idx)}
              className="btn btn-sm"
              style={{
                width: '36px',
                height: '36px',
                minHeight: '36px',
                padding: 0,
                backgroundColor: bg,
                color: fg,
                position: 'relative',
                fontWeight: 700,
                borderWidth: isSelected ? '2.5px' : '1.5px',
                borderColor: isSelected ? 'var(--border-ink)' : 'var(--border-ink)',
                flexShrink: 0,
              }}
              title={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unanswered)'}${isFlagged ? ' (Flagged)' : ''}`}
              id={`nav-q-${idx + 1}`}
            >
              <span>{idx + 1}</span>
              {isFlagged && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'var(--coral)',
                    borderRadius: '50%',
                    border: '1.5px solid var(--border-ink)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Exam View: Calm, focused field notebook card */}
      {currentQuestion && (
        <div
          className="card-notebook"
          style={{
            padding: '28px',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {/* Question Header: Taxonomy, Question Number, Flag & Confidence */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              borderBottom: '1px solid var(--bg-surface-alt)',
              paddingBottom: '14px',
              marginBottom: '20px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-demo">Demo Categorisation</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-teal)' }}>
                  {currentQuestion.system}
                </span>
                <span>•</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {currentQuestion.discipline}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                Item ID: <code>{currentQuestion.id}</code> (v{currentQuestion.version}) • Author Difficulty: {currentQuestion.authorDifficulty || 'Standard'} (Author-assigned, not measured)
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Flag Toggle Button */}
              <button
                onClick={handleToggleFlag}
                className={`btn btn-sm ${currentAnswer.isFlagged ? 'btn-accent-coral' : 'btn-secondary'}`}
                title="Flag question for review (Keyboard shortcut: F)"
                id="player-flag-btn"
              >
                <Flag size={14} fill={currentAnswer.isFlagged ? 'currentColor' : 'none'} />
                <span>{currentAnswer.isFlagged ? 'Flagged' : 'Flag (F)'}</span>
              </button>
            </div>
          </div>

          {/* Vignette / Prompt */}
          <div
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'var(--text-ink)',
              whiteSpace: 'pre-line',
              marginBottom: '28px',
            }}
          >
            {currentQuestion.vignette}
          </div>

          {/* Answer Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {currentQuestion.options.map((option) => {
              const isSelected = currentAnswer.selectedOptionId === option.id;
              const isEliminated = (currentAnswer.eliminatedOptionIds || []).includes(option.id);
              const isCorrect = currentQuestion.correctOptionId === option.id;

              // Tutor feedback revealed styling
              let optionBorder = '2px solid var(--border-ink)';
              let optionBg = 'var(--bg-canvas)';
              let badgeColor = 'var(--bg-surface)';

              if (session.mode === 'tutor' && isQuestionSubmitted) {
                if (isCorrect) {
                  optionBorder = '2.5px solid var(--mint)';
                  optionBg = 'var(--mint-light)';
                } else if (isSelected && !isCorrect) {
                  optionBorder = '2.5px solid var(--coral)';
                  optionBg = 'var(--coral-light)';
                }
              } else if (isSelected) {
                optionBorder = '2.5px solid var(--primary-teal)';
                optionBg = 'var(--primary-teal-subtle)';
                badgeColor = 'var(--primary-teal)';
              }

              return (
                <div
                  key={option.id}
                  onClick={() => !isEliminated && handleSelectOption(option.id)}
                  className={`card-notebook ${!isEliminated ? 'card-notebook-interactive' : ''}`}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: isQuestionSubmitted && session.mode === 'tutor' ? 'default' : 'pointer',
                    border: optionBorder,
                    backgroundColor: optionBg,
                    opacity: isEliminated ? 0.45 : 1,
                    textDecoration: isEliminated ? 'line-through' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  id={`option-${option.id}`}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectOption(option.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    {/* Letter Badge */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: '2px solid var(--border-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        backgroundColor: isSelected && (!isQuestionSubmitted || session.mode !== 'tutor') ? 'var(--primary-teal)' : badgeColor,
                        color: isSelected && (!isQuestionSubmitted || session.mode !== 'tutor') ? '#FFFFFF' : 'var(--text-ink)',
                        flexShrink: 0,
                      }}
                    >
                      {option.id}
                    </div>

                    <div style={{ fontSize: '0.98rem', fontWeight: 500, color: 'var(--text-ink)' }}>
                      {option.text}
                    </div>
                  </div>

                  {/* Right side controls: Feedback indicator & Eliminate button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {session.mode === 'tutor' && isQuestionSubmitted && (
                      <div>
                        {isCorrect ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--mint)', fontWeight: 700, fontSize: '0.85rem' }}>
                            <CheckCircle size={18} />
                            <span>Correct</span>
                          </div>
                        ) : isSelected ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--coral)', fontWeight: 700, fontSize: '0.85rem' }}>
                            <XCircle size={18} />
                            <span>Your Choice</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {(!isQuestionSubmitted || session.mode !== 'tutor') && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleEliminate(option.id, e)}
                        className="btn btn-sm btn-outline"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.72rem',
                          minHeight: '28px',
                        }}
                        title="Cross out or restore this option"
                        id={`eliminate-${option.id}`}
                      >
                        <Strikethrough size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tutor Mode Submit Action & Confidence Selector */}
          {session.mode === 'tutor' && !isQuestionSubmitted && (
            <div
              style={{
                borderTop: '2px solid var(--bg-surface-alt)',
                paddingTop: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              {/* Confidence Rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Confidence:
                </span>
                {(['confident', 'unsure', 'guessed'] as ConfidenceLevel[]).map((lvl) => {
                  const isSelected = currentAnswer.confidence === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleSetConfidence(lvl)}
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>

              {/* Submit Answer */}
              <button
                type="button"
                onClick={handleSubmitTutorAnswer}
                disabled={!currentAnswer.selectedOptionId}
                className="btn btn-primary"
                id="tutor-submit-answer-btn"
                style={{
                  opacity: !currentAnswer.selectedOptionId ? 0.5 : 1,
                  cursor: !currentAnswer.selectedOptionId ? 'not-allowed' : 'pointer',
                }}
              >
                <Eye size={16} />
                <span>Submit & View Explanation</span>
              </button>
            </div>
          )}

          {/* Tutor Mode Revealed Explanation */}
          {session.mode === 'tutor' && isQuestionSubmitted && (
            <div
              className="card-notebook"
              style={{
                marginTop: '24px',
                padding: '24px',
                backgroundColor: 'var(--bg-canvas)',
                border: '2px solid var(--border-ink)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span className="badge badge-teal">Educational Rationale</span>
                <h3 style={{ fontSize: '1.2rem' }}>Comprehensive Explanation</h3>
              </div>

              <p style={{ fontSize: '0.98rem', lineHeight: 1.6, marginBottom: '18px' }}>
                {currentQuestion.explanation}
              </p>

              {/* High Yield Key Takeaway */}
              <div
                style={{
                  backgroundColor: 'var(--mint-light)',
                  border: '2px solid var(--mint)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-teal)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} />
                  <span>Key High-Yield Takeaway</span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-ink)' }}>
                  {currentQuestion.keyTakeaway}
                </div>
              </div>

              {/* Option Breakdown */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>
                Option-by-Option Breakdown:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Option {opt.id}: </strong>
                    <span>{currentQuestion.optionExplanations[opt.id] || 'Option analysis.'}</span>
                  </div>
                ))}
              </div>

              {/* References */}
              {currentQuestion.references && currentQuestion.references.length > 0 && (
                <div style={{ marginTop: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <strong>Educational References: </strong>
                  {currentQuestion.references.join('; ')}
                </div>
              )}
            </div>
          )}

          {/* Bottom Navigator Bar: Prev, Question Counter, Next */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '32px',
              paddingTop: '18px',
              borderTop: '2px solid var(--bg-surface-alt)',
            }}
          >
            <button
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="btn btn-secondary"
              id="player-prev-btn"
              style={{ opacity: currentIndex === 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={16} />
              <span>Previous (P)</span>
            </button>

            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              Question {currentIndex + 1} of {totalQuestions}
            </span>

            <button
              onClick={() => {
                if (currentIndex < totalQuestions - 1) {
                  goToQuestion(currentIndex + 1);
                } else {
                  setShowSubmitModal(true);
                }
              }}
              className="btn btn-primary"
              id="player-next-btn"
            >
              <span>{currentIndex === totalQuestions - 1 ? 'Review & Submit' : 'Next (N)'}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(21, 26, 30, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="card-notebook"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={24} style={{ color: 'var(--coral)' }} />
              <h3 id="submit-modal-title" style={{ fontSize: '1.3rem' }}>Submit Practice Block?</h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '16px' }}>
              Are you ready to finalize this session?
            </p>

            <div
              style={{
                backgroundColor: unansweredCount > 0 ? 'var(--coral-light)' : 'var(--mint-light)',
                border: `1.5px solid ${unansweredCount > 0 ? 'var(--coral)' : 'var(--mint)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                fontSize: '0.9rem',
              }}
            >
              <div>Answered: <strong>{answeredCount}</strong></div>
              <div>
                Unanswered:{' '}
                <strong style={{ color: unansweredCount > 0 ? 'var(--coral)' : 'inherit' }}>
                  {unansweredCount}
                </strong>
                {unansweredCount > 0 && ' (Will be scored as unanswered)'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="btn btn-secondary"
                id="submit-modal-cancel-btn"
              >
                Keep Practising
              </button>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  const withTime = updateTimeSpent();
                  onFinishSession(withTime);
                }}
                className="btn btn-primary"
                id="submit-modal-confirm-btn"
              >
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
