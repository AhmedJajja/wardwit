import React, { useState } from 'react';
import { ClipMascot } from '../mascot/ClipMascot';
import { BRAND } from '../../config/brand.config';
import type { UserProfile, MBBSYear } from '../../domain/types';
import { Calendar, Award, BookCheck, Check } from 'lucide-react';

interface OnboardingModalProps {
  initialProfile: UserProfile;
  isOpen: boolean;
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
  quietMode?: boolean;
}

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MBBS_YEAR_OPTIONS: MBBSYear[] = [
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Final Year 5',
  'Graduate / House Officer',
  'Other',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialProfile,
  isOpen,
  onComplete,
  onSkip,
  quietMode = false,
}) => {
  const [displayName, setDisplayName] = useState(initialProfile.displayName || '');
  const [mbbsYear, setMbbsYear] = useState<MBBSYear>(initialProfile.mbbsYear || 'Year 3');
  const [college, setCollege] = useState(initialProfile.college || '');
  const [targetExamDate, setTargetExamDate] = useState(initialProfile.targetExamDate || '');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    initialProfile.preferredStudyDays.length > 0 ? initialProfile.preferredStudyDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [dailyGoal, setDailyGoal] = useState<number>(initialProfile.dailyQuestionGoal || 10);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setValidationError(null);
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDays.length === 0) {
      setValidationError('Please select at least 1 planned study day per week.');
      return;
    }
    setValidationError(null);
    onComplete({
      ...initialProfile,
      displayName: displayName.trim() || 'Doctor-in-Training',
      mbbsYear,
      college: college.trim(),
      targetExamDate,
      preferredStudyDays: selectedDays,
      dailyQuestionGoal: dailyGoal,
      onboardingCompleted: true,
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(21, 26, 30, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="card-notebook"
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '28px',
          position: 'relative',
          backgroundColor: 'var(--bg-surface)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Header with Mascot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <ClipMascot
            pose="welcome"
            size={90}
            speechBubble={quietMode ? undefined : 'Assalam-o-Alaikum! Let’s set up your field notebook.'}
            quietMode={quietMode}
          />
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <span className="badge badge-teal" style={{ marginBottom: '6px' }}>Welcome to WardWit</span>
            <h2 id="onboarding-title" style={{ fontSize: '1.6rem', margin: '4px 0' }}>
              MBBS to Step 1 Study Setup
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Personalize your study routine. You can skip now and change these anytime in Settings.
            </p>
          </div>
        </div>

        {validationError && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--coral-light)',
              border: '1.5px solid var(--coral)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--coral)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {validationError}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Display Name */}
          <div>
            <label htmlFor="display-name" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
              Preferred Name / Handle
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Doc Sarah or Fatima"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border-ink)',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-ink)',
              }}
            />
          </div>

          {/* MBBS Year & College */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label htmlFor="mbbs-year" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                MBBS Training Stage
              </label>
              <select
                id="mbbs-year"
                value={mbbsYear}
                onChange={(e) => setMbbsYear(e.target.value as MBBSYear)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-ink)',
                  fontSize: '0.92rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-ink)',
                }}
              >
                {MBBS_YEAR_OPTIONS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="college" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Medical College (Optional)
              </label>
              <input
                id="college"
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="e.g. King Edward, Aga Khan, Dow, Allama Iqbal..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-ink)',
                  fontSize: '0.92rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-ink)',
                }}
              />
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '4px' }}>
                {BRAND.collegeDisclaimer}
              </span>
            </div>
          </div>

          {/* Target Exam Date & Daily Goal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label htmlFor="target-date" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                <Calendar size={15} />
                <span>Target Step 1 Date (Optional)</span>
              </label>
              <input
                id="target-date"
                type="date"
                value={targetExamDate}
                onChange={(e) => setTargetExamDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-ink)',
                  fontSize: '0.92rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-ink)',
                }}
              />
            </div>

            <div>
              <label htmlFor="daily-goal" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                <BookCheck size={15} />
                <span>Daily Question Goal: {dailyGoal} questions</span>
              </label>
              <input
                id="daily-goal"
                type="range"
                min="5"
                max="40"
                step="5"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-teal)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>5 (Light)</span>
                <span>10 (Standard)</span>
                <span>20 (Sprint)</span>
                <span>40 (Intensive)</span>
              </div>
            </div>
          </div>

          {/* Preferred Study Days */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
              Planned Study Days
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ALL_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className="btn btn-sm"
                    style={{
                      backgroundColor: isSelected ? 'var(--primary-teal)' : 'var(--bg-canvas)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-ink)',
                      minWidth: '54px',
                      padding: '6px 10px',
                    }}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <Check size={13} />}
                    <span>{day}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Storage & Demo Honesty Note */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface-alt)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-ink)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Award size={18} style={{ color: 'var(--primary-teal)', flexShrink: 0 }} />
            <span>
              <strong>Local Privacy:</strong> All data is stored purely in this browser's local IndexedDB. No accounts or external tracking.
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onSkip}
              className="btn btn-secondary"
              id="onboarding-skip-btn"
            >
              Skip for Now
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="onboarding-save-btn"
            >
              Save Profile & Start
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
