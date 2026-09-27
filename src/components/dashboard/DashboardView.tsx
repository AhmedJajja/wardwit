import React from 'react';
import { ClipMascot } from '../mascot/ClipMascot';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { BRAND } from '../../config/brand.config';
import { ALL_MILESTONES } from '../../domain/achievements';
import type { UserProfile, StudySession, UserSettings, DailyActivityRecord } from '../../domain/types';
import {
  Play,
  RotateCcw,
  Flag,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  Target,
  FileQuestion,
  Zap,
  Layers,
  Award,
  FileText,
} from 'lucide-react';

interface DashboardViewProps {
  profile: UserProfile;
  settings: UserSettings;
  activeSession: StudySession | null;
  recentSessions: StudySession[];
  todayActivity: DailyActivityRecord | null;
  dueReviewsCount: number;
  dueFlashcardsCount: number;
  availableUnusedCount: number;
  isPlannedStudyDay: boolean;
  earnedAchievements: Record<string, number>;
  totalApprovedQuestionsCount: number;
  onStartNewSession: (pool?: 'all' | 'unused' | 'incorrect' | 'flagged') => void;
  onStartQuickSprint: () => void;
  onStartDueReviewsSession: () => void;
  onOpenFlashcards: () => void;
  onOpenErrorNotebook: () => void;
  onResumeSession: (sessionId: string) => void;
  onViewResults: (sessionId: string) => void;
  onOpenSettings: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  settings,
  activeSession,
  recentSessions,
  todayActivity,
  dueReviewsCount,
  dueFlashcardsCount,
  availableUnusedCount,
  isPlannedStudyDay,
  earnedAchievements,
  totalApprovedQuestionsCount,
  onStartNewSession,
  onStartQuickSprint,
  onStartDueReviewsSession,
  onOpenFlashcards,
  onOpenErrorNotebook,
  onResumeSession,
  onViewResults,
  onOpenSettings,
}) => {
  const answeredToday = todayActivity?.questionsAnswered || 0;
  const goal = profile.dailyQuestionGoal || 10;
  const progressPercent = Math.min(100, Math.round((answeredToday / goal) * 100));

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile.displayName || 'Doctor';

  // Mascot speech selection
  const welcomeQuotes = BRAND.humorQuotes.welcome;
  const quote = welcomeQuotes[Math.floor(Math.random() * welcomeQuotes.length)];

  const canLaunchSprint = totalApprovedQuestionsCount >= 5;

  return (
    <div className="container" style={{ paddingBottom: '48px', paddingTop: '20px' }}>
      {/* Nonclinical Demo Content Banner */}
      <DisclaimerBanner className="mb-4" />

      {/* Hero Welcome Card */}
      <div
        className="card-notebook"
        style={{
          marginTop: '16px',
          padding: '24px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-alt) 100%)',
        }}
      >
        <div style={{ flex: '1 1 340px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-teal">{profile.mbbsYear}</span>
            {profile.college && (
              <span className="badge badge-mint" title="Personal profile note only">
                {profile.college}
              </span>
            )}
            <span
              className={`badge ${isPlannedStudyDay ? 'badge-mint' : 'badge-demo'}`}
              title={isPlannedStudyDay ? 'Scheduled study day' : 'Scheduled rest day — optional practice without guilt'}
            >
              {isPlannedStudyDay ? 'Study Day' : 'Rest Day (Optional Practice)'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.9rem', marginBottom: '8px', color: 'var(--text-ink)' }}>
            {timeGreeting}, {name}!
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', maxWidth: '520px', lineHeight: 1.5 }}>
            {profile.targetExamDate ? (
              <span>Target Step 1 Date: <strong>{profile.targetExamDate}</strong>. </span>
            ) : null}
            Your field notebook is ready. Work through daily goals, due reviews, and active recall flashcards.
          </p>

          {/* Primary Quick Start CTAs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '20px' }}>
            <button
              onClick={() => onStartNewSession('all')}
              className="btn btn-primary btn-lg"
              id="dashboard-start-study-btn"
            >
              <Play size={18} fill="currentColor" />
              <span>Start Studying</span>
            </button>

            {canLaunchSprint && (
              <button
                onClick={onStartQuickSprint}
                className="btn btn-secondary btn-lg"
                title="Launch a fast 5-question high-yield practice set"
                id="dashboard-quick-sprint-btn"
              >
                <Zap size={18} style={{ color: 'var(--marigold)' }} />
                <span>Quick 5-Q Sprint</span>
              </button>
            )}

            {activeSession && (
              <button
                onClick={() => onResumeSession(activeSession.id)}
                className="btn btn-accent-coral btn-lg"
                id="dashboard-resume-btn"
              >
                <Clock size={18} />
                <span>Resume Active Block</span>
              </button>
            )}
          </div>
        </div>

        {/* Mascot Greeting */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <ClipMascot
            pose="welcome"
            size={135}
            speechBubble={quote}
            quietMode={settings.quietMode}
          />
        </div>
      </div>

      {/* Active Session Alert Banner (if exists) */}
      {activeSession && (
        <div
          className="card-notebook"
          style={{
            marginTop: '20px',
            padding: '16px 20px',
            backgroundColor: 'var(--coral-light)',
            borderColor: 'var(--coral)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} style={{ color: 'var(--coral)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-ink)' }}>
                Unfinished Session: {activeSession.name}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Mode: <strong>{activeSession.mode.toUpperCase()}</strong> • {activeSession.questionSnapshots.length} questions •{' '}
                {activeSession.mode === 'timed' && activeSession.expiresAt ? (
                  <span>Deadline active</span>
                ) : (
                  <span>Tutor Mode</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => onResumeSession(activeSession.id)}
            className="btn btn-accent-coral btn-sm"
          >
            <span>Resume Now</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Grid: Daily Study Plan, Practice Shortcuts & Review Queue */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginTop: '24px',
        }}
      >
        {/* Daily Goal & Plan Card */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-teal" style={{ marginBottom: '4px' }}>Daily Study Plan</span>
              <h2 style={{ fontSize: '1.25rem' }}>Question Progress</h2>
            </div>
            <Target size={24} style={{ color: 'var(--primary-teal)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '12px 0' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--primary-teal)' }}>
              {answeredToday}
            </span>
            <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              / {goal} questions
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '14px',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: '999px',
              border: '2px solid var(--border-ink)',
              overflow: 'hidden',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: progressPercent >= 100 ? 'var(--mint)' : 'var(--primary-teal)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              {progressPercent >= 100
                ? 'Daily goal reached! Shaabash!'
                : `${Math.max(0, goal - answeredToday)} remaining today`}
            </span>
            <span style={{ fontWeight: 700 }}>{progressPercent}%</span>
          </div>

          {/* Transparent Bank Capacity Diagnostic */}
          {goal > totalApprovedQuestionsCount && (
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--coral)', backgroundColor: 'var(--coral-light)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
              Note: Current goal ({goal} Qs) exceeds total approved questions in bank ({totalApprovedQuestionsCount} Qs).
            </div>
          )}

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--bg-surface-alt)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              {isPlannedStudyDay ? 'Scheduled study day' : 'Rest day: no penalty for skipping'}
            </span>
            <button
              onClick={onOpenSettings}
              className="btn btn-sm btn-outline"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              Adjust Goal
            </button>
          </div>
        </div>

        {/* Due Reviews & Flashcards Hub */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-mint" style={{ marginBottom: '4px' }}>Spaced Repetition</span>
              <h2 style={{ fontSize: '1.25rem' }}>Due Recall Queues</h2>
            </div>
            <RotateCcw size={22} style={{ color: 'var(--mint)' }} />
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Spaced intervals for missed questions and flashcards due today:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={onStartDueReviewsSession}
              disabled={dueReviewsCount === 0}
              className="btn btn-secondary card-notebook-interactive"
              style={{
                justifyContent: 'space-between',
                padding: '10px 14px',
                opacity: dueReviewsCount === 0 ? 0.6 : 1,
              }}
              id="dashboard-due-reviews-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RotateCcw size={18} style={{ color: 'var(--coral)' }} />
                <span style={{ fontWeight: 600 }}>Due Question Reviews</span>
              </div>
              <span className="badge badge-coral">{dueReviewsCount} Due</span>
            </button>

            <button
              onClick={onOpenFlashcards}
              className="btn btn-secondary card-notebook-interactive"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              id="dashboard-due-flashcards-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={18} style={{ color: 'var(--primary-teal)' }} />
                <span style={{ fontWeight: 600 }}>Due Flashcards</span>
              </div>
              <span className="badge badge-teal">{dueFlashcardsCount} Due</span>
            </button>

            <button
              onClick={onOpenErrorNotebook}
              className="btn btn-secondary card-notebook-interactive"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              id="dashboard-open-error-notebook-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} style={{ color: 'var(--marigold)' }} />
                <span style={{ fontWeight: 600 }}>Error Notebook Journal</span>
              </div>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Practice Pool Shortcuts */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-coral" style={{ marginBottom: '4px' }}>Targeted Sets</span>
              <h2 style={{ fontSize: '1.25rem' }}>Question Pools</h2>
            </div>
            <Sparkles size={24} style={{ color: 'var(--coral)' }} />
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Filter questions by status without repetition:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => onStartNewSession('unused')}
              className="btn btn-secondary card-notebook-interactive"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              id="shortcut-unused-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileQuestion size={18} style={{ color: 'var(--primary-teal)' }} />
                <span style={{ fontWeight: 600 }}>Unused Questions</span>
              </div>
              <span className="badge badge-teal">{availableUnusedCount} left</span>
            </button>

            <button
              onClick={() => onStartNewSession('incorrect')}
              className="btn btn-secondary card-notebook-interactive"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              id="shortcut-incorrect-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RotateCcw size={18} style={{ color: 'var(--coral)' }} />
                <span style={{ fontWeight: 600 }}>Review Incorrects</span>
              </div>
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => onStartNewSession('flagged')}
              className="btn btn-secondary card-notebook-interactive"
              style={{ justifyContent: 'space-between', padding: '10px 14px' }}
              id="shortcut-flagged-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Flag size={18} style={{ color: 'var(--marigold)' }} />
                <span style={{ fontWeight: 600 }}>Flagged Questions</span>
              </div>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Verified Milestone Achievements Drawer */}
      <div className="card-notebook" style={{ marginTop: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={20} style={{ color: 'var(--marigold)' }} />
              <h2 style={{ fontSize: '1.25rem' }}>Milestone Badges</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Earned strictly through verified study activity; no inflated streak counts.
            </div>
          </div>
          <span className="badge badge-demo">
            {Object.keys(earnedAchievements).length} of {ALL_MILESTONES.length} Unlocked
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {ALL_MILESTONES.map((m) => {
            const isEarned = Boolean(earnedAchievements[m.id]);
            return (
              <div
                key={m.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: isEarned ? '2px solid var(--mint)' : '1.5px dashed var(--border-ink)',
                  backgroundColor: isEarned ? 'var(--mint-light)' : 'var(--bg-canvas)',
                  opacity: isEarned ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.1rem' }}>
                    {m.id === 'first-block' ? '📘' : m.id === 'chai-marathon' ? '☕' : m.id === 'error-detective' ? '🔍' : m.id === 'spaced-scholar' ? '🔄' : '⭐'}
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-ink)' }}>{m.title}</strong>
                  {isEarned && <span className="badge badge-mint" style={{ fontSize: '0.68rem', padding: '2px 4px' }}>Earned</span>}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                  {m.description}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '4px' }}>
                  Criteria: {m.criteriaRule}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Sessions Audit Trail */}
      <div className="card-notebook" style={{ marginTop: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span className="badge badge-mint" style={{ marginBottom: '4px' }}>Audit Trail</span>
            <h2 style={{ fontSize: '1.35rem' }}>Recent Study Sessions</h2>
          </div>
          <button
            onClick={() => onStartNewSession('all')}
            className="btn btn-secondary btn-sm"
          >
            <span>Custom Session</span>
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              border: '2px dashed var(--border-ink)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <ClipMascot
                pose="encouragement"
                size={85}
                speechBubble={settings.quietMode ? undefined : 'No sessions recorded yet. Ready to start block 1?'}
                quietMode={settings.quietMode}
              />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>No Sessions Recorded Yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 16px' }}>
              Your completed blocks, scores, and confidence analyses will appear here. No fabricated stats or fake user history.
            </p>
            <button
              onClick={() => onStartNewSession('all')}
              className="btn btn-primary"
            >
              <Play size={16} fill="currentColor" />
              <span>Launch Your First Session</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentSessions.slice(0, 5).map((s) => {
              const dateStr = new Date(s.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const isCompleted = s.status === 'completed';

              return (
                <div
                  key={s.id}
                  className="card-notebook card-notebook-interactive"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        backgroundColor: isCompleted ? 'var(--mint-light)' : 'var(--marigold-light)',
                        border: '2px solid var(--border-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: isCompleted ? 'var(--mint)' : 'var(--marigold)',
                      }}
                    >
                      {isCompleted ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-ink)' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '10px' }}>
                        <span>{dateStr}</span>
                        <span>•</span>
                        <span>{s.questionSnapshots.length} Questions</span>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{s.mode} Mode</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isCompleted && s.score && (
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 800,
                            fontSize: '1.25rem',
                            color: s.score.percentage >= 70 ? 'var(--mint)' : s.score.percentage >= 50 ? 'var(--marigold)' : 'var(--coral)',
                          }}
                        >
                          {s.score.percentage}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                          {s.score.correctCount}/{s.score.totalQuestions} Correct
                        </div>
                      </div>
                    )}

                    {isCompleted ? (
                      <button
                        onClick={() => onViewResults(s.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        <span>View Results</span>
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onResumeSession(s.id)}
                        className="btn btn-accent-coral btn-sm"
                      >
                        <span>Resume</span>
                        <Play size={14} fill="currentColor" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
