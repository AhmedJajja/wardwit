import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar, type ScreenName } from './components/common/Navbar';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { CreateSessionView } from './components/session-create/CreateSessionView';
import { QuestionPlayerView } from './components/player/QuestionPlayerView';
import { ResultsView } from './components/results/ResultsView';
import { SettingsView } from './components/settings/SettingsView';

import {
  questionRepo,
  sessionRepo,
  profileRepo,
  settingsRepo,
  dailyActivityRepo,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
} from './persistence/indexedDbRepo';

import { buildQuestionHistory, filterQuestionsForSession } from './domain/eligibility';
import { computeDeadline } from './domain/timer';
import { finalizeSession } from './domain/scoring';
import type {
  Question,
  StudySession,
  UserProfile,
  UserSettings,
  DailyActivityRecord,
  SessionFilterCriteria,
  QuestionPool,
} from './domain/types';

export function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');

  // Core domain state
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [viewingSession, setViewingSession] = useState<StudySession | null>(null);
  const [todayActivity, setTodayActivity] = useState<DailyActivityRecord | null>(null);

  // Onboarding modal visibility
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [createSessionInitialPool, setCreateSessionInitialPool] = useState<QuestionPool>('all');

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Compute question history stats from past sessions
  const historyStats = useMemo(() => {
    return buildQuestionHistory(sessions);
  }, [sessions]);

  // Load all initial data from IndexedDB
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedProfile, loadedSettings, loadedQuestions, loadedSessions, loadedToday] =
        await Promise.all([
          profileRepo.getProfile(),
          settingsRepo.getSettings(),
          questionRepo.getAll(),
          sessionRepo.getAll(),
          dailyActivityRepo.getActivityForDate(todayStr),
        ]);

      if (loadedProfile) {
        setProfile(loadedProfile);
        setShowOnboarding(!loadedProfile.onboardingCompleted);
      } else {
        setShowOnboarding(true);
      }

      if (loadedSettings) {
        setSettings(loadedSettings);
        document.documentElement.setAttribute('data-theme', loadedSettings.theme || 'warm-ivory');
      }

      setAllQuestions(loadedQuestions);
      setSessions(loadedSessions);

      // Check for in-progress session
      const inProgress = loadedSessions
        .filter((s) => s.status === 'in-progress')
        .sort((a, b) => b.startedAt - a.startedAt)[0];
      setActiveSession(inProgress || null);

      setTodayActivity(loadedToday);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'warm-ivory');
  }, [settings.theme]);

  // Handle saving profile
  const handleSaveProfile = async (updated: UserProfile) => {
    await profileRepo.saveProfile(updated);
    setProfile(updated);
    setShowOnboarding(false);
  };

  // Handle saving settings
  const handleSaveSettings = async (updated: UserSettings) => {
    await settingsRepo.saveSettings(updated);
    setSettings(updated);
  };

  // Toggle Quiet Mode fast button in navbar
  const handleToggleQuietMode = async () => {
    const updated = { ...settings, quietMode: !settings.quietMode };
    await handleSaveSettings(updated);
  };

  // Launch new session from criteria
  const handleLaunchSession = async (criteria: SessionFilterCriteria) => {
    const eligibility = filterQuestionsForSession(allQuestions, historyStats, criteria);
    if (eligibility.actualCount === 0) return;

    const now = Date.now();
    const durationMinutes = criteria.durationMinutes || 10;
    const expiresAt =
      criteria.mode === 'timed' ? computeDeadline(now, durationMinutes) : undefined;

    // Create deep snapshots of questions so later bank changes don't mutate this attempt
    const questionSnapshots: Question[] = JSON.parse(
      JSON.stringify(eligibility.eligibleQuestions)
    );

    const newSession: StudySession = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${criteria.mode === 'timed' ? 'Timed' : 'Tutor'} Block (${questionSnapshots.length} Qs)`,
      mode: criteria.mode,
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes,
      expiresAt,
      questionSnapshots,
      currentIndex: 0,
      answers: {},
    };

    // Pre-populate empty answers for all questions
    for (const q of questionSnapshots) {
      newSession.answers[q.id] = {
        selectedOptionId: null,
        isFlagged: false,
        eliminatedOptionIds: [],
        timeSpentSeconds: 0,
      };
    }

    await sessionRepo.save(newSession);
    setActiveSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentScreen('player');
  };

  // Resume an existing session
  const handleResumeSession = async (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId) || (await sessionRepo.getById(sessionId));
    if (s) {
      setActiveSession(s);
      setCurrentScreen('player');
    }
  };

  // Save session state (autosave from player)
  const handleSaveSessionState = async (updated: StudySession) => {
    await sessionRepo.save(updated);
    setActiveSession(updated);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  // Finalize/Finish session
  const handleFinishSession = async (sessionToFinish: StudySession) => {
    const finalized = finalizeSession(sessionToFinish);
    await sessionRepo.save(finalized);

    // Compute questions delta and update daily local activity
    const answeredCount = finalized.score?.correctCount !== undefined
      ? (finalized.score.correctCount + finalized.score.incorrectCount)
      : 0;
    const correctCount = finalized.score?.correctCount || 0;

    const updatedActivity = await dailyActivityRepo.recordActivity(
      todayStr,
      answeredCount,
      correctCount,
      true
    );

    setTodayActivity(updatedActivity);
    setActiveSession(null);
    setViewingSession(finalized);
    setSessions((prev) => [finalized, ...prev.filter((s) => s.id !== finalized.id)]);
    setCurrentScreen('results');
  };

  // View results of an already completed session
  const handleViewResults = (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId);
    if (s) {
      setViewingSession(s);
      setCurrentScreen('results');
    }
  };

  // Start a targeted review session with specific question IDs (from results screen)
  const handleStartReviewSession = async (questionIds: string[]) => {
    const subset = allQuestions.filter((q) => questionIds.includes(q.id));
    if (subset.length === 0) return;

    const now = Date.now();
    const questionSnapshots: Question[] = JSON.parse(JSON.stringify(subset));

    const reviewSession: StudySession = {
      id: `session-review-${now}`,
      name: `Targeted Review Block (${questionSnapshots.length} Qs)`,
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots,
      currentIndex: 0,
      answers: {},
    };

    for (const q of questionSnapshots) {
      reviewSession.answers[q.id] = {
        selectedOptionId: null,
        isFlagged: false,
        eliminatedOptionIds: [],
        timeSpentSeconds: 0,
      };
    }

    await sessionRepo.save(reviewSession);
    setActiveSession(reviewSession);
    setSessions((prev) => [reviewSession, ...prev]);
    setCurrentScreen('player');
  };

  // Start new session shortcut from dashboard
  const handleStartFromDashboard = (pool: QuestionPool = 'all') => {
    setCreateSessionInitialPool(pool);
    setCurrentScreen('create-session');
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800 }}>
          Opening WardWit Field Notebook...
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Loading local browser IndexedDB
        </div>
      </div>
    );
  }

  return (
    <div className={`wardwit-app ${settings.quietMode ? 'quiet-mode' : ''}`}>
      {/* Top Navigation */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        hasActiveSession={Boolean(activeSession)}
        onResumeSession={() => activeSession && handleResumeSession(activeSession.id)}
        settings={settings}
        onToggleQuietMode={handleToggleQuietMode}
      />

      {/* Main Body View */}
      <main id="main-content">
        {currentScreen === 'dashboard' && (
          <DashboardView
            profile={profile}
            settings={settings}
            activeSession={activeSession}
            recentSessions={sessions}
            todayActivity={todayActivity}
            onStartNewSession={handleStartFromDashboard}
            onResumeSession={handleResumeSession}
            onViewResults={handleViewResults}
            onOpenSettings={() => setCurrentScreen('settings')}
          />
        )}

        {currentScreen === 'create-session' && (
          <CreateSessionView
            allQuestions={allQuestions}
            historyStats={historyStats}
            settings={settings}
            initialPool={createSessionInitialPool}
            onLaunchSession={handleLaunchSession}
            onCancel={() => setCurrentScreen('dashboard')}
          />
        )}

        {currentScreen === 'player' && activeSession && (
          <QuestionPlayerView
            session={activeSession}
            settings={settings}
            onSaveSession={handleSaveSessionState}
            onFinishSession={handleFinishSession}
            onExitToDashboard={() => setCurrentScreen('dashboard')}
          />
        )}

        {currentScreen === 'results' && viewingSession && (
          <ResultsView
            session={viewingSession}
            settings={settings}
            onStartReviewSession={handleStartReviewSession}
            onReturnToDashboard={() => setCurrentScreen('dashboard')}
          />
        )}

        {currentScreen === 'settings' && (
          <SettingsView
            profile={profile}
            settings={settings}
            onSaveProfile={handleSaveProfile}
            onSaveSettings={handleSaveSettings}
            onReloadAllData={loadData}
          />
        )}
      </main>

      {/* First-time Onboarding Modal */}
      <OnboardingModal
        initialProfile={profile}
        isOpen={showOnboarding}
        onComplete={handleSaveProfile}
        onSkip={() => setShowOnboarding(false)}
        quietMode={settings.quietMode}
      />
    </div>
  );
}

export default App;
