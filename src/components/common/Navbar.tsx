import React from 'react';
import {
  BookOpen,
  PlusCircle,
  Settings,
  HardDrive,
  Play,
  VolumeX,
  Sparkles,
  FileText,
  Layers,
  BarChart2,
  FolderEdit,
} from 'lucide-react';
import { BRAND } from '../../config/brand.config';
import type { UserSettings } from '../../domain/types';

export type ScreenName =
  | 'dashboard'
  | 'create-session'
  | 'player'
  | 'results'
  | 'error-notebook'
  | 'flashcards'
  | 'analytics'
  | 'workspace'
  | 'settings';

interface NavbarProps {
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  hasActiveSession: boolean;
  onResumeSession?: () => void;
  settings: UserSettings;
  dueFlashcardsCount?: number;
  dueReviewsCount?: number;
  onToggleQuietMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  hasActiveSession,
  onResumeSession,
  settings,
  dueFlashcardsCount = 0,
  dueReviewsCount: _dueReviewsCount = 0,
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
          paddingTop: '10px',
          paddingBottom: '10px',
          flexWrap: 'wrap',
          gap: '10px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Active session resume prompt */}
          {hasActiveSession && currentScreen !== 'player' && (
            <button
              onClick={onResumeSession}
              className="btn btn-accent-coral btn-sm"
              title="Resume unfinished session"
              id="navbar-resume-btn"
            >
              <Play size={13} fill="currentColor" />
              <span>Resume Session</span>
            </button>
          )}

          {/* Nav links */}
          <nav style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }} aria-label="Main Navigation">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`btn btn-sm ${currentScreen === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-dashboard-btn"
            >
              <BookOpen size={14} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('create-session')}
              className={`btn btn-sm ${currentScreen === 'create-session' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-new-session-btn"
            >
              <PlusCircle size={14} />
              <span>New Block</span>
            </button>

            <button
              onClick={() => onNavigate('error-notebook')}
              className={`btn btn-sm ${currentScreen === 'error-notebook' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-error-notebook-btn"
            >
              <FileText size={14} />
              <span>Error Notebook</span>
            </button>

            <button
              onClick={() => onNavigate('flashcards')}
              className={`btn btn-sm ${currentScreen === 'flashcards' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-flashcards-btn"
              style={{ position: 'relative' }}
            >
              <Layers size={14} />
              <span>Flashcards</span>
              {dueFlashcardsCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--coral)',
                    color: '#FFF',
                    borderRadius: '10px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    marginLeft: '2px',
                  }}
                >
                  {dueFlashcardsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onNavigate('analytics')}
              className={`btn btn-sm ${currentScreen === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-analytics-btn"
            >
              <BarChart2 size={14} />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => onNavigate('workspace')}
              className={`btn btn-sm ${currentScreen === 'workspace' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-workspace-btn"
            >
              <FolderEdit size={14} />
              <span>Workspace</span>
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className={`btn btn-sm ${currentScreen === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              id="nav-settings-btn"
            >
              <Settings size={14} />
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
                padding: '4px 8px',
              }}
            >
              {settings.quietMode ? <VolumeX size={14} /> : <Sparkles size={14} />}
            </button>
          )}

          {/* Local Storage Indicator Pill */}
          <div
            title="All progress and sessions are saved locally in your browser’s IndexedDB."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-surface-alt)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-ink)',
            }}
          >
            <HardDrive size={12} style={{ color: 'var(--mint)' }} />
            <span>Local DB</span>
          </div>
        </div>
      </div>
    </header>
  );
};
