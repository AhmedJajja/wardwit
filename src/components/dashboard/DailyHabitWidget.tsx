import React, { useState, useEffect, useRef } from 'react';
import { Flame, Award, HelpCircle, Check, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { StreakState, WeekStripDay } from '../../domain/dailyHabit';

interface DailyHabitWidgetProps {
  streakState: StreakState;
  quietMode?: boolean;
  justQualified?: boolean;
  onClearJustQualified?: () => void;
}

export const DailyHabitWidget: React.FC<DailyHabitWidgetProps> = ({
  streakState,
  quietMode = false,
  justQualified = false,
  onClearJustQualified,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTriggeredRef = useRef(false);

  // Trigger brief completion reaction when goal is achieved today
  useEffect(() => {
    if (justQualified && !celebrationTriggeredRef.current) {
      celebrationTriggeredRef.current = true;
      setShowCelebration(true);

      // Check prefers-reduced-motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!quietMode && !prefersReducedMotion) {
        try {
          confetti({
            particleCount: 45,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#0D9488', '#F59E0B', '#10B981', '#38BDF8'],
            disableForReducedMotion: true,
          });
        } catch {
          // Graceful fallback if canvas is unavailable
        }
      }

      const timer = setTimeout(() => {
        setShowCelebration(false);
        onClearJustQualified?.();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [justQualified, quietMode, onClearJustQualified]);

  const progressPercent = Math.min(100, Math.round((streakState.todayCount / streakState.todayGoal) * 100));

  return (
    <div
      className="card-notebook daily-habit-card"
      style={{
        padding: '22px 24px',
        backgroundColor: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Daily Habit & Streak"
      id="daily-habit-widget"
    >
      {/* Brief celebration toast overlay */}
      {showCelebration && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--mint-bg, #ECFDF5)',
            border: '1.5px solid var(--mint, #10B981)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'fadeIn 0.25s ease-out',
          }}
          id="daily-goal-celebration-toast"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ color: 'var(--mint, #10B981)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#065F46' }}>
                Daily Practice Goal Achieved!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#047857' }}>
                5 distinct actions completed for today. Your streak is protected!
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCelebration(false)}
            aria-label="Dismiss notification"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#047857',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Header: Streak Count, Best Streak, and Progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        {/* Left: Streak Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: streakState.currentStreak > 0 ? '#FEF3C7' : 'var(--bg-canvas)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: streakState.currentStreak > 0 ? '#D97706' : 'var(--text-light)',
              flexShrink: 0,
            }}
          >
            <Flame
              size={22}
              fill={streakState.currentStreak > 0 ? 'currentColor' : 'none'}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-ink)',
                  letterSpacing: '-0.01em',
                }}
                id="habit-current-streak-text"
              >
                {streakState.currentStreak} Day {streakState.currentStreak === 1 ? 'Streak' : 'Streak'}
              </span>

              {streakState.bestStreak > 0 && (
                <span
                  className="badge badge-gold"
                  style={{ fontSize: '0.72rem', padding: '2px 7px', gap: '4px' }}
                  title="Best consecutive streak achieved"
                  id="habit-best-streak-badge"
                >
                  <Award size={11} />
                  <span>Best: {streakState.bestStreak}d</span>
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {streakState.statusMessage}
            </div>
          </div>
        </div>

        {/* Right: Today's Actions & Policy Help */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-light)' }}>
              Today's Actions
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: streakState.todayQualified ? 'var(--mint, #10B981)' : 'var(--text-ink)',
              }}
              id="habit-today-actions-count"
            >
              {Math.min(streakState.todayCount, streakState.todayGoal)} / {streakState.todayGoal}
            </div>
          </div>

          {/* Help trigger */}
          <button
            onClick={() => setShowHelp((prev) => !prev)}
            aria-label="View daily habit policy"
            title="Daily habit policy details"
            className="btn btn-secondary btn-sm"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-muted)',
            }}
            id="habit-help-toggle-btn"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* Policy Help Box (Toggleable, Accessible) */}
      {showHelp && (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: 'var(--text-muted)',
          }}
          id="habit-policy-help-box"
        >
          <div style={{ fontWeight: 700, color: 'var(--text-ink)', marginBottom: '4px' }}>
            Daily Habit Policy
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li><strong>Target:</strong> 5 distinct questions answered or due review cards completed within the study day.</li>
            <li><strong>Timezone:</strong> Calculated by Pakistan Standard Time (Asia/Karachi). Midnight updates the day.</li>
            <li><strong>No Farming:</strong> Repeatedly practicing or rating the same item within the same day counts only once.</li>
            <li><strong>Separate from Accuracy:</strong> Correctness is not required — 5 wrong answers still count towards habit formation.</li>
            <li><strong>Streak Grace:</strong> Yesterday's streak remains active while today is still open. Missed full days reset current streak.</li>
          </ul>
        </div>
      )}

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--bg-canvas)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            backgroundColor: streakState.todayQualified ? 'var(--mint, #10B981)' : 'var(--primary-teal)',
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Compact Week Strip (7 Days: Mon..Sun in Karachi) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
        }}
        role="group"
        aria-label="Weekly habit consistency strip"
      >
        {streakState.weekDays.map((day: WeekStripDay) => {
          let bg = 'var(--bg-canvas)';
          let borderColor = 'var(--border)';
          let dotColor = 'var(--text-light)';
          let title = `${day.dayName} (${day.dateKey}): ${day.qualifyingCount} actions`;

          if (day.isQualified) {
            bg = '#F0FDF4';
            borderColor = '#86EFAC';
            dotColor = '#16A34A';
            title += ' — Goal Met ✓';
          } else if (day.isToday) {
            bg = '#F0FDFA';
            borderColor = 'var(--primary-teal)';
            dotColor = 'var(--primary-teal)';
            title += ' — Today (In progress)';
          }

          return (
            <div
              key={day.dateKey}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 4px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: bg,
                border: `1.5px solid ${borderColor}`,
                position: 'relative',
              }}
              title={title}
              id={`week-day-pill-${day.dateKey}`}
            >
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: day.isToday ? 'var(--primary-teal)' : 'var(--text-light)',
                  marginBottom: '2px',
                }}
              >
                {day.dayLabel}
              </span>

              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: day.isToday ? 800 : 600,
                  color: day.isToday ? 'var(--text-ink)' : 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                {day.dayNumber}
              </span>

              {/* Status Dot / Checkmark */}
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: day.isQualified
                    ? '#16A34A'
                    : day.isToday
                    ? 'rgba(15, 118, 110, 0.15)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: day.isQualified
                    ? 'none'
                    : `1.5px ${day.isFuture ? 'dashed' : 'solid'} ${dotColor}`,
                  color: day.isQualified ? '#FFFFFF' : dotColor,
                }}
              >
                {day.isQualified ? (
                  <Check size={11} strokeWidth={3} />
                ) : day.isToday ? (
                  <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>
                    {day.qualifyingCount}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
