import React from 'react';
import { BookOpen, PlusCircle, Settings, HardDrive, Play, VolumeX, Sparkles } from 'lucide-react';
import { BRAND } from '../../config/brand.config';
import type { UserSettings } from '../../domain/types';

export type ScreenName = 'dashboard' | 'create-session' | 'player' | 'results' | 'settings';

interface NavbarProps {
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  hasActiveSession: boolean;
  onResumeSession?: () => void;
  settings: UserSettings;
  onToggleQuietMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  hasActiveSession,
  onResumeSession,
  settings,
  onToggleQuietMode,
}) => {
  return (
    <header
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '2px solid var(--border-ink)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 0 var(--border-ink)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '12px',
          paddingBottom: '12px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Brand & Logo */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('dashboard')}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
          aria-label="WardWit Home"
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: 'var(--primary-teal)',
              borderRadius: '8px',
              border: '2px solid var(--border-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-offset-sm)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '1.2rem',
              fontFamily: 'var(--font-heading)',
            }}
          >
            W
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-ink)',
                }}
              >
                {BRAND.appName}
              </span>
              <span className="badge badge-demo">Demo</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Field Notebook for Step 1
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Active session resume prompt */}
          {hasActiveSession && currentScreen !== 'player' && (
            <button
              onClick={onResumeSession}
              className="btn btn-accent-coral btn-sm"
              title="Resume unfinished session"
              id="navbar-resume-btn"
            >
              <Play size={14} fill="currentColor" />
              <span>Resume Session</span>
            </button>
          )}

          {/* Nav links */}
          <nav style={{ display: 'flex', gap: '6px' }} aria-label="Main Navigation">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`btn btn-sm ${currentScreen === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-dashboard-btn"
            >
              <BookOpen size={15} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('create-session')}
              className={`btn btn-sm ${currentScreen === 'create-session' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-new-session-btn"
            >
              <PlusCircle size={15} />
              <span>New Session</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`btn btn-sm ${currentScreen === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-settings-btn"
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
          </nav>

          {/* Quiet Mode Fast Toggle */}
          {onToggleQuietMode && (
            <button
              onClick={onToggleQuietMode}
              className="btn btn-sm btn-outline"
              title={settings.quietMode ? 'Quiet Mode ON (Click to enable playful mascot)' : 'Quiet Mode OFF (Click to silence humor)'}
              aria-label="Toggle quiet mode"
              id="nav-quiet-toggle-btn"
              style={{
                borderColor: settings.quietMode ? 'var(--coral)' : 'var(--border-ink)',
                color: settings.quietMode ? 'var(--coral)' : 'var(--text-muted)',
              }}
            >
              {settings.quietMode ? <VolumeX size={15} /> : <Sparkles size={15} />}
              <span style={{ fontSize: '0.8rem' }}>{settings.quietMode ? 'Quiet' : 'Playful'}</span>
            </button>
          )}

          {/* Local Storage Indicator Pill */}
          <div
            title="All progress and sessions are saved locally in your browser’s IndexedDB."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-surface-alt)',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-ink)',
            }}
          >
            <HardDrive size={13} style={{ color: 'var(--mint)' }} />
            <span>Local Browser DB</span>
          </div>
        </div>
      </div>
    </header>
  );
};
