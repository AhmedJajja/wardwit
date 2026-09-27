import React from 'react';
import { ClipMascot } from '../mascot/ClipMascot';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { BRAND } from '../../config/brand.config';
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
} from 'lucide-react';

interface DashboardViewProps {
  profile: UserProfile;
  settings: UserSettings;
  activeSession: StudySession | null;
  recentSessions: StudySession[];
  todayActivity: DailyActivityRecord | null;
  onStartNewSession: (pool?: 'all' | 'unused' | 'incorrect' | 'flagged') => void;
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
  onStartNewSession,
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
          </div>

          <h1 style={{ fontSize: '1.9rem', marginBottom: '8px', color: 'var(--text-ink)' }}>
            {timeGreeting}, {name}!
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.98rem', maxWidth: '520px', lineHeight: 1.5 }}>
            {profile.targetExamDate ? (
              <span>Target Step 1 Date: <strong>{profile.targetExamDate}</strong>. </span>
            ) : null}
            Your field notebook is ready. Work through high-yield biostatistics logic, data interpretation, and practice questions.
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

      {/* Grid: Daily Progress & Study Shortcuts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginTop: '24px',
        }}
      >
        {/* Real Local Daily Goal Progress */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-teal" style={{ marginBottom: '4px' }}>Today's Local Progress</span>
              <h2 style={{ fontSize: '1.25rem' }}>Daily Question Goal</h2>
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
                : `${goal - answeredToday} remaining today`}
            </span>
            <span style={{ fontWeight: 700 }}>{progressPercent}%</span>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--bg-surface-alt)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Computed purely from local IndexedDB activity
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

        {/* Practice Shortcuts */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-coral" style={{ marginBottom: '4px' }}>Targeted Sets</span>
              <h2 style={{ fontSize: '1.25rem' }}>Focused Shortcuts</h2>
            </div>
            <Sparkles size={24} style={{ color: 'var(--coral)' }} />
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Jump directly into a curated practice block based on question history:
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
              <ChevronRight size={16} />
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

      {/* Recent Sessions List */}
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
          /* Honest Empty State */
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
