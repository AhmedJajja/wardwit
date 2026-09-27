import React from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { ClipMascot } from '../mascot/ClipMascot';
import { calculateComprehensiveStats } from '../../domain/analytics';
import type { StudySession, UserSettings } from '../../domain/types';
import {
  Target,
  BarChart2,
  Calendar,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

interface AnalyticsViewProps {
  sessions: StudySession[];
  settings: UserSettings;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ sessions, settings }) => {
  const stats = calculateComprehensiveStats(sessions);

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-teal" style={{ marginBottom: '4px' }}>Audited Metrics</span>
          <h1 style={{ fontSize: '1.85rem' }}>Honest Practice Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Empirical local performance metrics. No fabricated percentiles, predicted USMLE 3-digit scores, or AI mastery estimations.
          </p>
        </div>

        <ClipMascot
          pose="focus"
          size={95}
          speechBubble={settings.quietMode ? undefined : 'First attempts measure baseline memory; repeats show review mastery.'}
          quietMode={settings.quietMode}
        />
      </div>

      {/* Core Rule & Honesty Legend */}
      <div
        className="card-notebook"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          backgroundColor: 'var(--bg-surface-alt)',
          border: '1.5px solid var(--border-ink)',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-ink)', fontWeight: 700, marginBottom: '4px' }}>
          <ShieldAlert size={18} style={{ color: 'var(--primary-teal)' }} />
          <span>Practice Signals Policy & Signal Rules</span>
        </div>
        <div>
          Performance indicators in WardWit are <strong>practice signals</strong> derived purely from recorded local attempts:
          <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
            <li><strong>Insufficient Data</strong>: Assigned to topics with &lt; 3 attempts. Reliable signals require repeated encounters.</li>
            <li><strong>Needs More Practice</strong>: Assigned when accuracy is &lt; 60% with ≥ 3 attempts.</li>
            <li><strong>Steady Progress</strong>: Assigned when accuracy is ≥ 75% with ≥ 3 attempts.</li>
            <li><strong>Developing</strong>: Accuracy between 60% and 74%.</li>
          </ul>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Total Questions Attempted */}
        <div className="card-notebook" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Attempt Volume
            </span>
            <BarChart2 size={18} style={{ color: 'var(--primary-teal)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800 }}>
            {stats.totalAttempts}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across <strong>{stats.uniqueQuestionsAttempted}</strong> unique questions
          </div>
        </div>

        {/* First-Attempt Accuracy */}
        <div className="card-notebook" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              First-Attempt Accuracy
            </span>
            <Target size={18} style={{ color: 'var(--mint)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--primary-teal)' }}>
            {stats.firstAttemptAccuracy.percentage}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <strong>{stats.firstAttemptAccuracy.correct}</strong> of <strong>{stats.firstAttemptAccuracy.denominator}</strong> unique questions
          </div>
        </div>

        {/* Repeat-Attempt Accuracy */}
        <div className="card-notebook" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Repeat-Attempt Accuracy
            </span>
            <CheckCircle2 size={18} style={{ color: 'var(--marigold)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-ink)' }}>
            {stats.repeatAttemptAccuracy.denominator > 0 ? `${stats.repeatAttemptAccuracy.percentage}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats.repeatAttemptAccuracy.denominator > 0
              ? `${stats.repeatAttemptAccuracy.correct} of ${stats.repeatAttemptAccuracy.denominator} repeat attempts`
              : 'No repeat attempts yet'}
          </div>
        </div>
      </div>

      {/* Weekly Activity Breakdown */}
      <div className="card-notebook" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Calendar size={20} style={{ color: 'var(--primary-teal)' }} />
          <h2 style={{ fontSize: '1.25rem' }}>Weekly Study Consistency</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Tracks calendar study days and question volume across recent weeks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {stats.weeklyActivity.map((w, idx) => (
            <div
              key={idx}
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border-ink)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>
                {w.weekLabel}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-teal)' }}>
                {w.questionsCount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>questions</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Active on <strong>{w.activeDaysCount}</strong> of 7 days
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic Performance with Practice Signals */}
      <div className="card-notebook" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Topic-by-Topic Performance</h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Breakdown by concept area with minimum threshold indicators.
            </div>
          </div>

          {stats.insufficientDataTopicsCount > 0 && (
            <span className="badge badge-demo">
              {stats.insufficientDataTopicsCount} topic(s) need ≥3 attempts for a reliable signal
            </span>
          )}
        </div>

        {stats.topicPerformance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No questions answered yet. Complete practice sessions to view empirical topic data.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-ink)' }}>
                  <th style={{ padding: '10px 12px' }}>Topic</th>
                  <th style={{ padding: '10px 12px' }}>System</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Attempts</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Accuracy</th>
                  <th style={{ padding: '10px 12px' }}>Practice Signal</th>
                </tr>
              </thead>
              <tbody>
                {stats.topicPerformance.map((t) => {
                  let signalBadge = <span className="badge badge-mint">Steady Progress</span>;
                  if (t.signal === 'insufficient_data') {
                    signalBadge = <span className="badge badge-demo" title="Requires at least 3 attempts to establish a practice signal">Insufficient Data (&lt;3 Qs)</span>;
                  } else if (t.signal === 'needs_practice') {
                    signalBadge = <span className="badge badge-coral">Needs More Practice</span>;
                  } else if (t.signal === 'developing') {
                    signalBadge = <span className="badge badge-teal">Developing</span>;
                  }

                  return (
                    <tr key={t.topic} style={{ borderBottom: '1px solid var(--bg-surface-alt)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.topic}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t.system}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{t.attemptsCount}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>
                        {t.percentage}%
                      </td>
                      <td style={{ padding: '10px 12px' }}>{signalBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
