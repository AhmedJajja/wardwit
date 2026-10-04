import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Compass,
  Layers,
  Settings,
  Play,
  VolumeX,
  Sparkles,
  FileText,
  BarChart2,
  FolderEdit,
  MoreVertical,
  HelpCircle,
  Flame,
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
  currentStreak?: number;
  streakTooltip?: string;
  onToggleQuietMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScreen,
  onNavigate,
  hasActiveSession,
  onResumeSession,
  settings,
  dueFlashcardsCount = 0,
  dueReviewsCount = 0,
  currentStreak = 0,
  streakTooltip,
  onToggleQuietMode,
}) => {
  const [showSecondaryMenu, setShowSecondaryMenu] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close secondary menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSecondaryMenu(false);
      }
    };
    if (showSecondaryMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSecondaryMenu]);

  // Determine active primary destination
  const isToday = currentScreen === 'dashboard';
  const isPractice = currentScreen === 'create-session';
  const isCards = currentScreen === 'flashcards';

  const handleSelectMenuItem = (screen: ScreenName) => {
    setShowSecondaryMenu(false);
    onNavigate(screen);
  };

  return (
    <>
      {/* Desktop & Mobile Header */}
      <header
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          top: 0,
          zIndex: 90,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            paddingBottom: '8px',
            minHeight: '62px',
          }}
        >
          {/* Brand & Tyto Avatar */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onNavigate('dashboard')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            aria-label="WardWit Home"
            id="brand-logo-btn"
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-teal-light)',
                border: '1.5px solid rgba(15, 118, 110, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src="/assets/tyto-doctor.png"
                alt="Tyto Mascot"
                width={36}
                height={36}
                style={{ objectFit: 'cover', transform: 'scale(1.15) translateY(2px)' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--primary-teal)',
                  }}
                >
                  {BRAND.appName}
                </span>
                <span className="badge badge-demo" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                  Demo
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.1 }}>
                USMLE Step 1 Study Partner
              </div>
            </div>
          </div>

          {/* Desktop Navigation: Exactly 3 Primary Destinations */}
          <nav
            className="desktop-nav-tabs"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-canvas)',
              padding: '4px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
            aria-label="Primary Navigation"
          >
            {/* 1. Today */}
            <button
              onClick={() => onNavigate('dashboard')}
              className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                boxShadow: isToday ? 'var(--btn-shadow-teal)' : 'none',
                border: isToday ? 'none' : 'transparent',
                position: 'relative',
              }}
              id="nav-today-btn"
            >
              <Calendar size={15} />
              <span>Today</span>
              {dueReviewsCount > 0 && (
                <span
                  className="badge badge-gold"
                  style={{ fontSize: '0.65rem', padding: '1px 5px', marginLeft: '2px' }}
                  title={`${dueReviewsCount} reviews due`}
                >
                  {dueReviewsCount}
                </span>
              )}
            </button>

            {/* 2. Practice */}
            <button
              onClick={() => onNavigate('create-session')}
              className={`btn btn-sm ${isPractice ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                boxShadow: isPractice ? 'var(--btn-shadow-teal)' : 'none',
                border: isPractice ? 'none' : 'transparent',
              }}
              id="nav-practice-btn"
            >
              <Compass size={15} />
              <span>Practice</span>
            </button>

            {/* 3. Cards */}
            <button
              onClick={() => onNavigate('flashcards')}
              className={`btn btn-sm ${isCards ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                boxShadow: isCards ? 'var(--btn-shadow-teal)' : 'none',
                border: isCards ? 'none' : 'transparent',
                position: 'relative',
              }}
              id="nav-cards-btn"
            >
              <Layers size={15} />
              <span>Cards</span>
              {dueFlashcardsCount > 0 && (
                <span
                  className="badge badge-coral"
                  style={{ fontSize: '0.65rem', padding: '1px 5px', marginLeft: '2px' }}
                  title={`${dueFlashcardsCount} cards due`}
                >
                  {dueFlashcardsCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Header Action Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Active Session Quick Resume Button (if in progress and not currently in player) */}
            {hasActiveSession && currentScreen !== 'player' && (
              <button
                onClick={onResumeSession}
                className="btn btn-accent-coral btn-sm"
                title="Resume unfinished practice session"
                id="navbar-resume-btn"
              >
                <Play size={13} fill="currentColor" />
                <span style={{ fontSize: '0.85rem' }}>Resume</span>
              </button>
            )}

            {/* Compact Streak Pill */}
            {currentStreak > 0 && (
              <div
                className="badge badge-gold"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  gap: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'default',
                }}
                title={streakTooltip || `${currentStreak} day streak`}
                id="navbar-streak-pill"
              >
                <Flame size={13} fill="currentColor" />
                <span>{currentStreak}d</span>
              </div>
            )}

            {/* Quiet Mode Toggle */}
            {onToggleQuietMode && (
              <button
                onClick={onToggleQuietMode}
                className="btn btn-sm btn-secondary"
                title={settings.quietMode ? 'Quiet Mode ON (Click to restore Tyto mascot banter)' : 'Quiet Mode OFF (Click to silence Tyto)'}
                aria-label="Toggle quiet mode"
                id="nav-quiet-toggle-btn"
                style={{
                  padding: '6px 10px',
                  color: settings.quietMode ? 'var(--coral)' : 'var(--text-muted)',
                }}
              >
                {settings.quietMode ? <VolumeX size={16} /> : <Sparkles size={16} />}
              </button>
            )}

            {/* Secondary Menu (Settings, Error Notebook, Analytics, Workspace) */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setShowSecondaryMenu((prev) => !prev)}
                className="btn btn-sm btn-secondary"
                aria-expanded={showSecondaryMenu}
                aria-haspopup="true"
                id="secondary-menu-btn"
                title="Profile, Notes, Analytics & Workspace"
                style={{
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <MoreVertical size={16} />
              </button>

              {/* Secondary Dropdown Menu */}
              {showSecondaryMenu && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '240px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
                    padding: '6px',
                    zIndex: 120,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px 6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--text-light)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Study Companion
                  </div>

                  <button
                    role="menuitem"
                    onClick={() => handleSelectMenuItem('settings')}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'flex-start',
                      width: '100%',
                      background: currentScreen === 'settings' ? 'var(--primary-teal-subtle)' : 'transparent',
                      color: currentScreen === 'settings' ? 'var(--primary-teal)' : 'var(--text-ink)',
                      border: 'none',
                      boxShadow: 'none',
                    }}
                    id="menu-settings-btn"
                  >
                    <Settings size={15} />
                    <span>Profile & Settings</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleSelectMenuItem('error-notebook')}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'flex-start',
                      width: '100%',
                      background: currentScreen === 'error-notebook' ? 'var(--primary-teal-subtle)' : 'transparent',
                      color: currentScreen === 'error-notebook' ? 'var(--primary-teal)' : 'var(--text-ink)',
                      border: 'none',
                      boxShadow: 'none',
                    }}
                    id="menu-error-notebook-btn"
                  >
                    <FileText size={15} />
                    <span>Mistake Log</span>
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => handleSelectMenuItem('analytics')}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'flex-start',
                      width: '100%',
                      background: currentScreen === 'analytics' ? 'var(--primary-teal-subtle)' : 'transparent',
                      color: currentScreen === 'analytics' ? 'var(--primary-teal)' : 'var(--text-ink)',
                      border: 'none',
                      boxShadow: 'none',
                    }}
                    id="menu-analytics-btn"
                  >
                    <BarChart2 size={15} />
                    <span>Study History</span>
                  </button>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                  <div
                    style={{
                      padding: '6px 12px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--text-light)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Content Authoring
                  </div>

                  <button
                    role="menuitem"
                    onClick={() => handleSelectMenuItem('workspace')}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'flex-start',
                      width: '100%',
                      background: currentScreen === 'workspace' ? 'var(--primary-teal-subtle)' : 'transparent',
                      color: currentScreen === 'workspace' ? 'var(--primary-teal)' : 'var(--text-ink)',
                      border: 'none',
                      boxShadow: 'none',
                    }}
                    id="menu-workspace-btn"
                  >
                    <FolderEdit size={15} />
                    <span>Content Workspace</span>
                  </button>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                  <div
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>Offline IndexedDB Storage</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar: Exactly 3 Primary Destinations */}
      <nav id="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`mobile-nav-item ${isToday ? 'active' : ''}`}
          id="mobile-nav-today"
          aria-label="Today"
        >
          <div style={{ position: 'relative' }}>
            <Calendar size={20} />
            {dueReviewsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--gold-accent)',
                }}
              />
            )}
          </div>
          <span>Today</span>
        </button>

        <button
          onClick={() => onNavigate('create-session')}
          className={`mobile-nav-item ${isPractice ? 'active' : ''}`}
          id="mobile-nav-practice"
          aria-label="Practice"
        >
          <Compass size={20} />
          <span>Practice</span>
        </button>

        <button
          onClick={() => onNavigate('flashcards')}
          className={`mobile-nav-item ${isCards ? 'active' : ''}`}
          id="mobile-nav-cards"
          aria-label="Cards"
        >
          <div style={{ position: 'relative' }}>
            <Layers size={20} />
            {dueFlashcardsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-8px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--coral)',
                }}
              />
            )}
          </div>
          <span>Cards</span>
        </button>
      </nav>
    </>
  );
};

export default Navbar;
