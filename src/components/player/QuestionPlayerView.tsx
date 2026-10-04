import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { TytoMascot } from '../mascot/TytoMascot';
import { EducationalDiagram } from '../common/EducationalDiagram';
import { AskTytoSection } from './AskTytoSection';
import { getRemainingSeconds, isTimerExpired, formatRemainingTime } from '../../domain/timer';
import type {
  StudySession,
  ConfidenceLevel,
  UserSettings,
  ReportIssueType,
  ErrorCause,
  Question,
  QuestionUserAnswer,
  SaveToReviewResult,
} from '../../domain/types';
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
  FlagTriangleLeft,
  FileText,
  Edit3,
  Bookmark,
  CheckCheck,
} from 'lucide-react';

interface QuestionPlayerViewProps {
  session: StudySession;
  settings: UserSettings;
  onSaveSession: (updated: StudySession) => Promise<void>;
  onFinishSession: (session: StudySession) => Promise<void> | void;
  onExitToDashboard: () => void;
  onReportQuestion?: (report: {
    questionId: string;
    questionVersion: number;
    issueType: ReportIssueType;
    comment: string;
  }) => Promise<void>;
  onAddToErrorNotebook?: (
    question: Question,
    selectedOptionId: string | null,
    cause: ErrorCause,
    notes: string,
    takeaway: string
  ) => Promise<void>;
  onSaveQuestionToReview?: (
    question: Question,
    answer?: QuestionUserAnswer
  ) => Promise<SaveToReviewResult>;
  onRecordTutorAnswer?: (questionId: string) => Promise<void>;
}

export const QuestionPlayerView: React.FC<QuestionPlayerViewProps> = ({
  session: initialSession,
  settings: _settings,
  onSaveSession,
  onFinishSession,
  onExitToDashboard,
  onReportQuestion,
  onAddToErrorNotebook,
  onSaveQuestionToReview,
  onRecordTutorAnswer,
}) => {
  const [session, setSession] = useState<StudySession>(initialSession);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [finishError, setFinishError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportIssueType, setReportIssueType] = useState<ReportIssueType>('possible_error');
  const [reportComment, setReportComment] = useState<string>('');
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [showScratchpad, setShowScratchpad] = useState<boolean>(false);

  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const [errorCause, setErrorCause] = useState<ErrorCause>('knowledge_gap');
  const [errorNotes, setErrorNotes] = useState<string>('');
  const [errorTakeaway, setErrorTakeaway] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
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
  const isSubmittingRef = useRef<boolean>(false);

  // Safe idempotent finalize trigger with awaitable completion and failure lock release
  const triggerFinish = useCallback(
    async (targetSession: StudySession) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setFinishError(null);
      try {
        await onFinishSession(targetSession);
      } catch (err: any) {
        console.error('Failed to complete session:', err);
        setFinishError(err?.message || 'Storage error: Unable to complete and persist session.');
        isSubmittingRef.current = false; // Reset submission lock so retry works
      }
    },
    [onFinishSession]
  );

  const [saveToReviewNotice, setSaveToReviewNotice] = useState<{
    status: 'saved' | 'already_saved' | 'error';
    message: string;
  } | null>(null);

  const handleSaveToReview = async () => {
    if (!currentQuestion || !onSaveQuestionToReview) return;
    setSaveToReviewNotice(null);
    try {
      const res = await onSaveQuestionToReview(currentQuestion, currentAnswer);
      setSaveToReviewNotice(res);
      setTimeout(() => setSaveToReviewNotice(null), 4000);
    } catch (err: any) {
      setSaveToReviewNotice({
        status: 'error',
        message: err.message || 'Failed to save question to Review.',
      });
    }
  };

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

  // Timed mode interval countdown based on deadline + inactive tab expiration
  useEffect(() => {
    if (session.mode !== 'timed' || !session.expiresAt || session.status === 'completed') {
      return;
    }

    const checkAndHandleExpiration = () => {
      if (isSubmittingRef.current) return;
      const now = Date.now();
      const secs = getRemainingSeconds(session.expiresAt!, now);
      setRemainingSecs(secs);

      if (isTimerExpired(session.expiresAt!, now)) {
        const withTime = updateTimeSpent();
        triggerFinish(withTime);
      }
    };

    // Immediate check on mount or dependency update
    checkAndHandleExpiration();

    // Check immediately when browser tab regains visibility (inactive tab expiration)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndHandleExpiration();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(checkAndHandleExpiration, 1000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session.mode, session.expiresAt, session.status, updateTimeSpent, triggerFinish]);

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
  const handleToggleEliminate = useCallback((optionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
  }, [currentQuestion, isQuestionSubmitted, session, persistSession]);

  // Update scratchpad notes
  const handleUpdateScratchpad = (note: string) => {
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
          scratchpadNote: note,
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
  const handleSubmitTutorAnswer = async () => {
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
    await persistSession(updated);
    if (onRecordTutorAnswer) {
      await onRecordTutorAnswer(currentQuestion.id);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();

      // Scratchpad toggle (Alt+S) operates globally
      if (e.altKey && (key === 'S' || e.code === 'KeyS')) {
        e.preventDefault();
        setShowScratchpad((prev) => !prev);
        return;
      }

      // Do not trigger single-key hotkeys if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

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

      const options = currentQuestion?.options || [];

      // Strikethrough / eliminate option by Alt+1-5 or Alt+A-E
      if (e.altKey) {
        let elimIndex = -1;
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
          elimIndex = parseInt(e.key, 10) - 1;
        } else if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
          elimIndex = key.charCodeAt(0) - 65;
        }

        if (elimIndex >= 0 && elimIndex < options.length) {
          e.preventDefault();
          handleToggleEliminate(options[elimIndex].id);
          return;
        }
      }

      // Option selection by key (1-5 or A-E) without Alt
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        let optionIndex = -1;
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
          optionIndex = parseInt(e.key, 10) - 1;
        } else if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
          optionIndex = key.charCodeAt(0) - 65;
        }

        if (optionIndex >= 0 && optionIndex < options.length) {
          e.preventDefault();
          handleSelectOption(options[optionIndex].id);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, session, currentQuestion, handleToggleFlag, handleSelectOption, handleToggleEliminate]);

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

      {/* Finish Error Retry Banner */}
      {finishError && (
        <div
          role="alert"
          id="finish-error-banner"
          style={{
            backgroundColor: 'var(--coral-light)',
            border: '2px solid var(--coral)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--coral)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--coral)' }}>Submission Failed:</strong> {finishError}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Your responses and timer are preserved. You can safely retry finalizing this block.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => {
                const withTime = updateTimeSpent();
                triggerFinish(withTime);
              }}
              className="btn btn-primary btn-sm"
              id="finish-retry-btn"
            >
              Retry Finish
            </button>
            <button
              onClick={() => setFinishError(null)}
              className="btn btn-secondary btn-sm"
              id="finish-dismiss-btn"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      {/* Failure alerts with retry buttons */}
      {finishError && (
        <div
          role="alert"
          className="card-notebook"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #f87171',
            color: '#991b1b',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>Finalize Notice: {finishError}</span>
          </div>
          <button
            onClick={() => {
              const withTime = updateTimeSpent();
              triggerFinish(withTime);
            }}
            className="btn btn-sm btn-primary"
            id="retry-finish-session-btn"
          >
            Retry Finalize
          </button>
        </div>
      )}

      {saveStatus === 'error' && (
        <div
          role="alert"
          className="card-notebook"
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #f59e0b',
            color: '#92400e',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span>Autosave Notice: Failed to persist recent changes to local storage.</span>
          <button
            onClick={() => persistSession(session)}
            className="btn btn-sm btn-secondary"
            id="retry-autosave-btn"
          >
            Retry Save
          </button>
        </div>
      )}

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

              {/* Scratchpad Toggle Button */}
              <button
                type="button"
                onClick={() => setShowScratchpad((prev) => !prev)}
                className={`btn btn-sm ${showScratchpad ? 'btn-primary' : 'btn-secondary'}`}
                title="Toggle in-exam scratchpad for calculations and notes (Shortcut: Alt+S)"
                id="player-scratchpad-btn"
              >
                <Edit3 size={14} />
                <span>{showScratchpad ? 'Hide Scratchpad' : 'Scratchpad (Alt+S)'}</span>
              </button>

              {/* Report Issue Button */}
              <button
                type="button"
                onClick={() => {
                  setReportNotice(null);
                  setReportComment('');
                  setShowReportModal(true);
                }}
                className="btn btn-sm btn-secondary"
                title="Report issue with this question"
                id="player-report-btn"
              >
                <FlagTriangleLeft size={14} />
                <span>Report</span>
              </button>
            </div>
          </div>

          {/* In-Exam Scratchpad Drawer */}
          {showScratchpad && (
            <div
              className="card-notebook"
              style={{
                marginBottom: '20px',
                padding: '14px 18px',
                backgroundColor: 'var(--bg-canvas)',
                border: '2px dashed var(--primary-teal)',
                borderRadius: 'var(--radius-md)',
              }}
              id="player-scratchpad-drawer"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: 'var(--primary-teal)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-ink)' }}>
                    In-Exam Scratchpad (Question {currentIndex + 1})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-saved • Alt+S to toggle</span>
                  {currentAnswer.scratchpadNote && (
                    <button
                      type="button"
                      onClick={() => handleUpdateScratchpad('')}
                      className="btn btn-sm btn-outline"
                      style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={currentAnswer.scratchpadNote || ''}
                onChange={(e) => handleUpdateScratchpad(e.target.value)}
                placeholder="Draft calculations, 2x2 epidemiology tables, differential notes..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border-ink)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-ink)',
                  fontFamily: 'monospace, var(--font-body)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
                id="player-scratchpad-input"
              />
            </div>
          )}

          {/* Vignette / Prompt */}
          <div
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'var(--text-ink)',
              whiteSpace: 'pre-line',
              marginBottom: '20px',
            }}
          >
            {currentQuestion.vignette}
          </div>

          {/* Question Vignette Media (Preserved before and during solving) */}
          {(currentQuestion.questionMedia || currentQuestion.imageMetadata) && (
            <EducationalDiagram
              media={
                currentQuestion.questionMedia || {
                  url: currentQuestion.imageMetadata?.url,
                  alt: currentQuestion.imageMetadata?.alt || 'Clinical scenario diagram',
                  caption: currentQuestion.imageMetadata?.caption,
                  provenance: currentQuestion.imageMetadata?.provenance
                    ? { source: currentQuestion.imageMetadata.provenance }
                    : undefined,
                }
              }
              mode="vignette"
              sessionMode={session.mode}
            />
          )}

          {/* Answer Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {currentQuestion.options.map((option) => {
              const isSelected = currentAnswer.selectedOptionId === option.id;
              const isEliminated = (currentAnswer.eliminatedOptionIds || []).includes(option.id);
              const isCorrect = currentQuestion.correctOptionId === option.id;

              // Tutor feedback revealed styling
              let optionBorder = '1.5px solid var(--border-subtle)';
              let optionBg = 'var(--bg-surface)';
              let badgeBg = 'var(--bg-canvas)';
              let badgeColor = 'var(--text-ink)';

              if (session.mode === 'tutor' && isQuestionSubmitted) {
                if (isCorrect) {
                  optionBorder = '2px solid var(--mint)';
                  optionBg = 'var(--mint-light)';
                  badgeBg = 'var(--mint)';
                  badgeColor = '#FFFFFF';
                } else if (isSelected && !isCorrect) {
                  optionBorder = '2px solid var(--coral)';
                  optionBg = 'var(--coral-light)';
                  badgeBg = 'var(--coral)';
                  badgeColor = '#FFFFFF';
                }
              } else if (isSelected) {
                optionBorder = '2px solid var(--primary-teal)';
                optionBg = 'var(--primary-teal-subtle)';
                badgeBg = 'var(--primary-teal)';
                badgeColor = '#FFFFFF';
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
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isEliminated) {
                        handleSelectOption(option.id);
                      }
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    {/* Letter Badge */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1.5px solid rgba(15, 118, 110, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        backgroundColor: badgeBg,
                        color: badgeColor,
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
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid rgba(15, 118, 110, 0.18)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <TytoMascot
                  state={currentAnswer.selectedOptionId === currentQuestion.correctOptionId ? 'celebrating' : 'encouraging'}
                  size="sm"
                  quietMode={_settings?.quietMode}
                />
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`badge ${currentAnswer.selectedOptionId === currentQuestion.correctOptionId ? 'badge-teal' : 'badge-gold'}`}>
                      {currentAnswer.selectedOptionId === currentQuestion.correctOptionId ? 'Correct Selection' : 'Review Point'}
                    </span>
                    <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-ink)' }}>
                      {currentAnswer.selectedOptionId === currentQuestion.correctOptionId ? 'Spot-on clinical deduction!' : 'Key learning opportunity'}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                    {currentAnswer.selectedOptionId === currentQuestion.correctOptionId
                      ? 'Solid foundation. Review the full rationale below to solidify the concept.'
                      : 'Step 1 tests this exact differentiator. Check the option breakdown below.'}
                  </p>
                </div>
              </div>

              <p style={{ fontSize: '0.98rem', lineHeight: 1.6, marginBottom: '18px', color: 'var(--text-ink)' }}>
                {currentQuestion.explanation}
              </p>

              {/* High Yield Key Takeaway */}
              <div
                style={{
                  backgroundColor: 'var(--teal-50)',
                  border: '1px solid rgba(15, 118, 110, 0.25)',
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
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-ink)' }}>
                Option-by-Option Breakdown:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-canvas)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(15, 118, 110, 0.12)',
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

              {/* Authored Explanation Diagram (Available only after submission in tutor mode) */}
              {currentQuestion.explanationMedia && (
                <div style={{ marginTop: '16px' }}>
                  <EducationalDiagram
                    media={currentQuestion.explanationMedia}
                    mode="explanation"
                    isRevealed={isQuestionSubmitted}
                    sessionMode={session.mode}
                    isSessionCompleted={session.status === 'completed'}
                  />
                </div>
              )}

              {/* Ask Tyto AI Study Companion (Embedded inside post-answer explanation) */}
              <AskTytoSection
                question={currentQuestion}
                userAnswer={currentAnswer}
                isTimedSessionActive={false}
              />

              {/* Actions: Save to Review & Log into Error Notebook */}
              <div
                style={{
                  marginTop: '18px',
                  paddingTop: '14px',
                  borderTop: '1px solid rgba(15, 118, 110, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  {saveToReviewNotice && (
                    <span
                      className={`badge ${
                        saveToReviewNotice.status === 'saved'
                          ? 'badge-teal'
                          : saveToReviewNotice.status === 'already_saved'
                          ? 'badge-gold'
                          : 'badge-coral'
                      }`}
                      style={{ fontSize: '0.8rem' }}
                    >
                      {saveToReviewNotice.status === 'saved' ? <CheckCheck size={13} /> : null}
                      <span>{saveToReviewNotice.message}</span>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {onSaveQuestionToReview && (
                    <button
                      type="button"
                      onClick={handleSaveToReview}
                      className="btn btn-secondary btn-sm"
                      id="player-save-to-review-btn"
                      title="Save this question concept to your Review deck"
                    >
                      <Bookmark size={14} />
                      <span>Save to Review</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setErrorNotice(null);
                      setErrorTakeaway(currentQuestion.keyTakeaway || '');
                      setErrorNotes(
                        `Question: ${currentQuestion.topic}\nChosen option: ${
                          currentAnswer.selectedOptionId || 'None'
                        } (Correct: ${currentQuestion.correctOptionId})`
                      );
                      setShowErrorModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    id="player-log-error-btn"
                  >
                    <FileText size={14} />
                    <span>Log in Error Notebook</span>
                  </button>
                </div>
              </div>
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
              maxHeight: '90vh',
              overflowY: 'auto',
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
                  triggerFinish(withTime);
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
      {/* Report Question Modal */}
      {showReportModal && currentQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
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
              maxWidth: '500px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <FlagTriangleLeft size={22} style={{ color: 'var(--coral)' }} />
              <h3 id="report-modal-title" style={{ fontSize: '1.25rem' }}>
                Report Question <code>{currentQuestion.id}</code> (v{currentQuestion.version})
              </h3>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-canvas)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-ink)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '16px',
              }}
            >
              <strong>Local Notice:</strong> Reports are saved locally to your browser's Content Workspace inbox. They are not sent to an external medical team.
            </div>

            {reportNotice ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={32} style={{ color: 'var(--mint)', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{reportNotice}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  You can inspect this item in the Content Workspace inbox.
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '16px' }}
                >
                  Return to Question
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (onReportQuestion) {
                    await onReportQuestion({
                      questionId: currentQuestion.id,
                      questionVersion: currentQuestion.version,
                      issueType: reportIssueType,
                      comment: reportComment.trim(),
                    });
                  }
                  setReportNotice('Report saved to local review inbox.');
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Type of Issue
                  </label>
                  <select
                    value={reportIssueType}
                    onChange={(e) => setReportIssueType(e.target.value as ReportIssueType)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    <option value="possible_error">Possible error in medical reasoning or answer key</option>
                    <option value="ambiguous_wording">Ambiguous or confusing vignette wording</option>
                    <option value="missing_broken_media">Missing or broken diagram / image</option>
                    <option value="outdated_content">Outdated trial information or classification</option>
                    <option value="typo">Typo or formatting irregularity</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Additional Comment (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    placeholder="Describe what looks incorrect..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-accent-coral"
                  >
                    Save Report Locally
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Error Notebook Log Modal */}
      {showErrorModal && currentQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="error-modal-title"
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
              maxWidth: '520px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <FileText size={22} style={{ color: 'var(--coral)' }} />
              <h3 id="error-modal-title" style={{ fontSize: '1.25rem' }}>
                Log into Error Notebook
              </h3>
            </div>

            {errorNotice ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={32} style={{ color: 'var(--mint)', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{errorNotice}</div>
                <button
                  type="button"
                  onClick={() => setShowErrorModal(false)}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '16px' }}
                >
                  Back to Question
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (onAddToErrorNotebook) {
                    await onAddToErrorNotebook(
                      currentQuestion,
                      currentAnswer.selectedOptionId,
                      errorCause,
                      errorNotes.trim(),
                      errorTakeaway.trim()
                    );
                  }
                  setErrorNotice('Logged to your Error Notebook.');
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Self-Identified Cause of Error
                  </label>
                  <select
                    value={errorCause}
                    onChange={(e) => setErrorCause(e.target.value as ErrorCause)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    <option value="knowledge_gap">Knowledge Gap (didn't know fact or formula)</option>
                    <option value="reasoning_mistake">Reasoning Mistake (fell for clinical distractor)</option>
                    <option value="misread_question">Misread Question (missed a crucial negative or clue)</option>
                    <option value="time_pressure">Time Pressure (rushed calculation)</option>
                    <option value="other">Other / Slip</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Personal Takeaway
                  </label>
                  <textarea
                    rows={2}
                    value={errorTakeaway}
                    onChange={(e) => setErrorTakeaway(e.target.value)}
                    placeholder="Short principle to remember..."
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Reflection Notes
                  </label>
                  <textarea
                    rows={3}
                    value={errorNotes}
                    onChange={(e) => setErrorNotes(e.target.value)}
                    placeholder="Why did option X look tempting?"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowErrorModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Save Entry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
