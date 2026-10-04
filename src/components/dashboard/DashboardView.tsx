import React, { useMemo } from 'react';
import { TytoMascot } from '../mascot/TytoMascot';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { BRAND } from '../../config/brand.config';
import type { UserProfile, StudySession, UserSettings, DailyActivityRecord } from '../../domain/types';
import type { StreakState } from '../../domain/dailyHabit';
import { DailyHabitWidget } from './DailyHabitWidget';
import {
  Play,
  RotateCcw,
  ChevronRight,
  Target,
  Zap,
  Layers,
  FileText,
  Clock,
  Sparkles,
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
  streakState?: StreakState;
  justQualified?: boolean;
  onClearJustQualified?: () => void;
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
  todayActivity: _todayActivity,
  dueReviewsCount,
  dueFlashcardsCount,
  isPlannedStudyDay,
  streakState,
  justQualified,
  onClearJustQualified,
  onStartQuickSprint,
  onStartDueReviewsSession,
  onOpenFlashcards,
  onOpenErrorNotebook,
  onResumeSession,
  onViewResults,
}) => {
  // Dynamic greeting based on time of day
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const doctorName = profile.displayName ? `Dr. ${profile.displayName}` : 'Doctor';

  // Select microcopy once on mount rather than randomly on every render
  const welcomeQuote = useMemo(() => {
    const quotes = BRAND.humorQuotes.welcome;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, []);

  // Filter completed sessions for recent list
  const completedRecent = useMemo(() => {
    return recentSessions
      .filter((s) => s.status === 'completed' && s.score)
      .slice(0, 3);
  }, [recentSessions]);

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      {/* Nonclinical Demo Content Banner */}
      <DisclaimerBanner className="mb-4" />

      {/* 1. TODAY HERO & GREETING */}
      <section
        className="card-notebook today-hero-card"
        style={{
          padding: '28px 32px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          background: 'linear-gradient(145deg, #FFFFFF 0%, #F0FDFA 100%)',
          border: '1px solid rgba(15, 118, 110, 0.15)',
        }}
        aria-label="Daily Greeting"
      >
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-teal">{profile.mbbsYear}</span>
            {profile.college && (
              <span className="badge badge-mint" title="Personal profile note">
                {profile.college}
              </span>
            )}
            <span
              className={`badge ${isPlannedStudyDay ? 'badge-teal' : 'badge-gold'}`}
              title={isPlannedStudyDay ? 'Scheduled study day' : 'Scheduled rest day — optional practice'}
            >
              {isPlannedStudyDay ? 'Study Day' : 'Rest Day (Optional)'}
            </span>

            {/* Streak slot: shown when real verified streak data exists */}
            {streakState && streakState.currentStreak > 0 && (
              <span className="badge badge-gold" id="today-streak-badge">
                <Sparkles size={12} />
                <span>{streakState.currentStreak} Day Streak</span>
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '2.1rem', marginBottom: '8px', color: 'var(--text-ink)', letterSpacing: '-0.02em' }}>
            {timeGreeting}, {doctorName}!
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '520px', lineHeight: 1.55 }}>
            {profile.targetExamDate ? (
              <span>Target exam: <strong>{profile.targetExamDate}</strong>. </span>
            ) : null}
            Your field notebook is open. Work through your daily practice sprint and review mistakes to lock in clinical principles.
          </p>
        </div>

        {/* Medical Tyto Greeting Mascot */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, maxWidth: '100%' }}>
          <TytoMascot
            state="welcome"
            size={120}
            speechBubble={welcomeQuote}
            speechPosition="top"
            quietMode={settings.quietMode}
          />
        </div>
      </section>

      {/* 2. PROMINENT SINGLE NEXT ACTION CARD (Duolingo-inspired clear next step) */}
      <section style={{ marginBottom: '24px' }}>
        {activeSession ? (
          /* Resume Active Block CTA */
          <div
            className="card-notebook card-notebook-interactive"
            style={{
              padding: '24px 28px',
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--coral)',
              boxShadow: '0 8px 24px -4px rgba(225, 29, 72, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-coral">Session In Progress</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Question {activeSession.currentIndex + 1} of {activeSession.questionSnapshots.length}
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-ink)', marginBottom: '4px' }}>
                {activeSession.name}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Pick up right where you left off. Your responses and timer are preserved.
              </p>
            </div>

            <button
              onClick={() => onResumeSession(activeSession.id)}
              className="btn btn-accent-coral btn-lg"
              id="today-resume-primary-btn"
              style={{ minWidth: '200px' }}
            >
              <Play size={18} fill="currentColor" />
              <span>Resume Block</span>
            </button>
          </div>
        ) : (
          /* Start 5 Questions Quick Sprint CTA */
          <div
            className="card-notebook card-notebook-interactive"
            style={{
              padding: '28px 32px',
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--primary-teal)',
              boxShadow: '0 8px 25px -4px rgba(15, 118, 110, 0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="badge badge-teal">Daily Recommended Action</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  5 Questions • ~10 mins
                </span>
              </div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--text-ink)', marginBottom: '4px' }}>
                5-Question Quick Sprint
              </h2>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', maxWidth: '540px' }}>
                Focused high-yield practice in tutor mode. Step-by-step clinical explanations and instant feedback.
              </p>
            </div>

            <button
              onClick={onStartQuickSprint}
              className="btn btn-primary btn-lg"
              id="today-start-sprint-btn"
              style={{ minWidth: '220px' }}
            >
              <Zap size={18} fill="currentColor" />
              <span>Start 5 Questions</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. DUE REVIEWS HUB (If reviews are due) */}
      {dueReviewsCount > 0 && (
        <section
          className="card-notebook"
          style={{
            padding: '20px 24px',
            marginBottom: '24px',
            backgroundColor: '#FFFBEB',
            border: '1.5px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
          aria-label="Due Reviews Alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--gold-light)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold-dark)',
                flexShrink: 0,
              }}
            >
              <RotateCcw size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#92400E' }}>
                {dueReviewsCount} Question{dueReviewsCount === 1 ? '' : 's'} Due for Spaced Review
              </div>
              <div style={{ fontSize: '0.86rem', color: '#78350F' }}>
                Strengthen concepts before recall fades. Mapped questions update your review intervals automatically.
              </div>
            </div>
          </div>

          <button
            onClick={onStartDueReviewsSession}
            className="btn btn-sm"
            style={{
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              boxShadow: '0 3px 0 #92400E',
            }}
            id="today-start-reviews-btn"
          >
            <RotateCcw size={15} />
            <span>Review Now ({dueReviewsCount})</span>
          </button>
        </section>
      )}

      {/* 4. COMPACT PROGRESS & STUDY TOOLS */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {/* Daily Habit & Streak Widget */}
        {streakState ? (
          <DailyHabitWidget
            streakState={streakState}
            quietMode={settings.quietMode}
            justQualified={justQualified}
            onClearJustQualified={onClearJustQualified}
          />
        ) : (
          <div className="card-notebook" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Target size={18} style={{ color: 'var(--primary-teal)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Daily Habit</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading study streak...</p>
          </div>
        )}

        {/* Quick Access to Flashcards & Error Notebook */}
        <div
          className="card-notebook"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.04em' }}>
            Active Study Tools
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={onOpenFlashcards}
              className="btn btn-secondary btn-sm"
              style={{ flex: '1 1 120px', minWidth: '110px', justifyContent: 'space-between', padding: '10px 14px' }}
              id="today-open-flashcards-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} style={{ color: 'var(--primary-teal)' }} />
                <span>Cards</span>
              </div>
              {dueFlashcardsCount > 0 && (
                <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>
                  {dueFlashcardsCount} Due
                </span>
              )}
            </button>

            <button
              onClick={onOpenErrorNotebook}
              className="btn btn-secondary btn-sm"
              style={{ flex: '1 1 120px', minWidth: '110px', justifyContent: 'space-between', padding: '10px 14px' }}
              id="today-open-errors-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} style={{ color: 'var(--coral)' }} />
                <span>Mistake Log</span>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>
      </section>

      {/* 5. RECENT SESSIONS LIST (Compact, truthful history without endless panels) */}
      {completedRecent.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-ink)' }}>
              Recent Practice Blocks
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Last {completedRecent.length} completed
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {completedRecent.map((s) => {
              const score = s.score!;
              return (
                <div
                  key={s.id}
                  className="card-notebook card-notebook-interactive"
                  onClick={() => onViewResults(s.id)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: score.percentage >= 70 ? 'var(--mint-light)' : 'var(--coral-light)',
                        color: score.percentage >= 70 ? 'var(--mint)' : 'var(--coral)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      {score.percentage}%
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-ink)' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                        <span>{score.correctCount} / {score.totalQuestions} Correct</span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={12} />
                          {Math.round(score.totalTimeSeconds / 60)}m
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--primary-teal)', fontWeight: 600 }}>
                    <span>Inspect Results</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardView;
