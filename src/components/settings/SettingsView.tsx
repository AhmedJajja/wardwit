import React, { useState } from 'react';
import { ClipMascot } from '../mascot/ClipMascot';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { BRAND } from '../../config/brand.config';
import type { UserProfile, UserSettings, MBBSYear } from '../../domain/types';
import {
  exportLocalBackup,
  importLocalBackup,
  clearAllLocalData,
} from '../../persistence/indexedDbRepo';
import {
  Save,
  Download,
  Upload,
  Trash2,
  HardDrive,
  VolumeX,
  Volume2,
  Palette,
  User,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface SettingsViewProps {
  profile: UserProfile;
  settings: UserSettings;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSaveSettings: (settings: UserSettings) => Promise<void>;
  onReloadAllData: () => Promise<void>;
}

const MBBS_YEAR_OPTIONS: MBBSYear[] = [
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Final Year 5',
  'Graduate / House Officer',
  'Other',
];

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile: initialProfile,
  settings: initialSettings,
  onSaveProfile,
  onSaveSettings,
  onReloadAllData,
}) => {
  // Profile state
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [mbbsYear, setMbbsYear] = useState<MBBSYear>(initialProfile.mbbsYear);
  const [college, setCollege] = useState(initialProfile.college || '');
  const [targetExamDate, setTargetExamDate] = useState(initialProfile.targetExamDate || '');
  const [selectedDays, setSelectedDays] = useState<string[]>(initialProfile.preferredStudyDays || []);
  const [dailyGoal, setDailyGoal] = useState<number>(initialProfile.dailyQuestionGoal || 10);

  // Settings state
  const [quietMode, setQuietMode] = useState<boolean>(initialSettings.quietMode);
  const [theme, setTheme] = useState<'warm-ivory' | 'light' | 'dark'>(initialSettings.theme || 'warm-ivory');

  // Backup & Reset state
  const [backupMessage, setBackupMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updatedProfile: UserProfile = {
        ...initialProfile,
        displayName: displayName.trim() || 'Doctor-in-Training',
        mbbsYear,
        college: college.trim(),
        targetExamDate,
        preferredStudyDays: selectedDays,
        dailyQuestionGoal: dailyGoal,
        updatedAt: Date.now(),
      };

      const updatedSettings: UserSettings = {
        ...initialSettings,
        quietMode,
        theme,
      };

      await onSaveProfile(updatedProfile);
      await onSaveSettings(updatedSettings);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Export JSON backup
  const handleExportBackup = async () => {
    try {
      const json = await exportLocalBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wardwit-local-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupMessage({ text: 'Backup downloaded successfully.', isError: false });
    } catch (err: any) {
      setBackupMessage({ text: `Export failed: ${err.message}`, isError: true });
    }
  };

  // Import JSON backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importLocalBackup(text);
        if (res.success) {
          setBackupMessage({ text: res.message, isError: false });
          await onReloadAllData();
        } else {
          setBackupMessage({ text: res.message, isError: true });
        }
      } catch (err: any) {
        setBackupMessage({ text: `Import failed: ${err.message}`, isError: true });
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Complete data reset
  const handleConfirmReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      return;
    }
    await clearAllLocalData();
    setShowResetModal(false);
    await onReloadAllData();
    window.location.reload();
  };

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '16px', marginBottom: '24px' }}>
        <div>
          <span className="badge badge-teal" style={{ marginBottom: '4px' }}>System Preferences</span>
          <h1 style={{ fontSize: '1.8rem' }}>Settings & Privacy</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage profile goals, study pacing, quiet mode, and browser-only data backups.
          </p>
        </div>

        <ClipMascot
          pose="focus"
          size={95}
          speechBubble={quietMode ? undefined : 'Your field notebook, your rules!'}
          quietMode={quietMode}
        />
      </div>

      <form onSubmit={handleSaveAll} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile & MBBS Year */}
        <div className="card-notebook" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User size={20} style={{ color: 'var(--primary-teal)' }} />
            <h2 style={{ fontSize: '1.2rem' }}>Student Profile & MBBS Year</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="settings-name" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Display Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
            </div>

            <div>
              <label htmlFor="settings-mbbs-year" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                MBBS Stage
              </label>
              <select
                id="settings-mbbs-year"
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
              <label htmlFor="settings-college" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Medical College (Optional)
              </label>
              <input
                id="settings-college"
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="e.g. King Edward, Aga Khan, Dow..."
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
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'block', marginTop: '4px' }}>
                {BRAND.collegeDisclaimer}
              </span>
            </div>

            <div>
              <label htmlFor="settings-target-date" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Target Step 1 Date (Optional)
              </label>
              <input
                id="settings-target-date"
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
          </div>

          {/* Daily Goal & Study Days */}
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--bg-surface-alt)', paddingTop: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              <div>
                <label htmlFor="settings-daily-goal" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                  Daily Question Goal: {dailyGoal} questions
                </label>
                <input
                  id="settings-daily-goal"
                  type="range"
                  min="5"
                  max="40"
                  step="5"
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary-teal)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>5 (Light)</span>
                  <span>10 (Standard)</span>
                  <span>20 (Sprint)</span>
                  <span>40 (Intensive)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                  Study Days
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                          padding: '4px 8px',
                          minWidth: '44px',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Mode & Appearance */}
        <div className="card-notebook" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Palette size={20} style={{ color: 'var(--primary-teal)' }} />
            <h2 style={{ fontSize: '1.2rem' }}>Experience & Quiet Mode</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Quiet Mode Toggle */}
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border-ink)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {quietMode ? <VolumeX size={20} style={{ color: 'var(--coral)' }} /> : <Volume2 size={20} style={{ color: 'var(--mint)' }} />}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Quiet Mode</span>
                </div>
                <input
                  type="checkbox"
                  checked={quietMode}
                  onChange={(e) => setQuietMode(e.target.checked)}
                  id="settings-quiet-mode-toggle"
                  style={{ width: '20px', height: '20px', accentColor: 'var(--primary-teal)', cursor: 'pointer' }}
                />
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Suppresses playful mascot jokes, celebratory quips, and confetti animations. Ideal for strictly clinical focus or quiet study spaces.
              </p>
            </div>

            {/* Theme Preference */}
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border-ink)',
              }}
            >
              <label htmlFor="theme-select" style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>
                Visual Style
              </label>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-ink)',
                  fontSize: '0.92rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-ink)',
                }}
              >
                <option value="warm-ivory">Warm Ivory Field Notebook (Standard)</option>
                <option value="light">Clean White Medical Lab</option>
                <option value="dark">Dark Ink Night Study</option>
              </select>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '6px' }}>
                Warm ivory field notebook palette uses high-contrast ink on parchment tones.
              </span>
            </div>
          </div>
        </div>

        {/* Save Settings CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          {saveSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--mint)', fontWeight: 600, fontSize: '0.9rem' }}>
              <CheckCircle size={18} />
              <span>Settings saved to local browser!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary"
            id="settings-save-btn"
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>

        {/* Data Persistence, Backup, and Honest Privacy */}
        <div className="card-notebook" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <HardDrive size={20} style={{ color: 'var(--primary-teal)' }} />
            <h2 style={{ fontSize: '1.2rem' }}>Local Data & Storage Honesty</h2>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-surface-alt)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border-ink)',
              marginBottom: '20px',
              fontSize: '0.88rem',
              lineHeight: 1.55,
              color: 'var(--text-muted)',
            }}
          >
            <strong style={{ color: 'var(--text-ink)', display: 'block', marginBottom: '4px' }}>
              Where is your study data saved?
            </strong>
            WardWit operates entirely within your browser using <strong>IndexedDB</strong>. 
            There are NO remote servers, external user databases, or cloud sync trackers. 
            Your attempts, question-version snapshots, and custom sessions live only on this computer and browser.
            To migrate to another device, use the JSON Backup tool below.
          </div>

          {backupMessage && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                backgroundColor: backupMessage.isError ? 'var(--coral-light)' : 'var(--mint-light)',
                border: `1.5px solid ${backupMessage.isError ? 'var(--coral)' : 'var(--mint)'}`,
                color: 'var(--text-ink)',
                fontSize: '0.88rem',
              }}
            >
              {backupMessage.text}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            {/* Export Backup Button */}
            <button
              type="button"
              onClick={handleExportBackup}
              className="btn btn-secondary"
              id="settings-export-backup-btn"
            >
              <Download size={16} />
              <span>Export Local Backup (.json)</span>
            </button>

            {/* Import Backup File Input */}
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} />
              <span>Import Local Backup (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackup}
                style={{ display: 'none' }}
                id="settings-import-backup-input"
              />
            </label>

            {/* Clear All Data Trigger */}
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="btn btn-sm btn-outline"
              style={{ borderColor: 'var(--coral)', color: 'var(--coral)', marginLeft: 'auto' }}
              id="settings-clear-data-btn"
            >
              <Trash2 size={14} />
              <span>Clear All Local Data</span>
            </button>
          </div>
        </div>
      </form>

      {/* Clear Data 2-Step Confirmation Modal */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-data-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(21, 26, 30, 0.8)',
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
              maxWidth: '460px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={24} style={{ color: 'var(--coral)' }} />
              <h3 id="clear-data-modal-title" style={{ fontSize: '1.25rem' }}>Erase All Local Data?</h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '14px', lineHeight: 1.5 }}>
              This will permanently delete all completed blocks, attempt history, and profile notes from this browser. This action cannot be undone.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="reset-confirm-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                Type <strong>RESET</strong> below to confirm deletion:
              </label>
              <input
                id="reset-confirm-input"
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--coral)',
                  fontSize: '0.92rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                className="btn btn-accent-coral"
                id="confirm-erase-everything-btn"
                style={{
                  opacity: resetConfirmText.trim().toUpperCase() !== 'RESET' ? 0.4 : 1,
                  cursor: resetConfirmText.trim().toUpperCase() !== 'RESET' ? 'not-allowed' : 'pointer',
                }}
              >
                Erase Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
