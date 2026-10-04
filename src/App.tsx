import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar, type ScreenName } from './components/common/Navbar';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { CreateSessionView } from './components/session-create/CreateSessionView';
import { QuestionPlayerView } from './components/player/QuestionPlayerView';
import { ResultsView } from './components/results/ResultsView';
import { SettingsView } from './components/settings/SettingsView';
import { ErrorNotebookView } from './components/error-notebook/ErrorNotebookView';
import { FlashcardsView } from './components/flashcards/FlashcardsView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { ContentWorkspaceView } from './components/workspace/ContentWorkspaceView';

import {
  questionRepo,
  sessionRepo,
  profileRepo,
  settingsRepo,
  dailyActivityRepo,
  reviewQueueRepo,
  errorNotebookRepo,
  flashcardRepo,
  questionReportRepo,
  achievementRepo,
  discoverCardRepo,
  saveQuestionToReview,
  saveDiscoverCardToReview,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
} from './persistence/indexedDbRepo';

import { buildQuestionHistory, filterQuestionsForSession } from './domain/eligibility';
import { computeDeadline } from './domain/timer';
import {
  getDueReviewItems,
  buildDueReviewSessionPlan,
  recordReviewAttempt,
} from './domain/spacedReview';
import { createFlashcard, reviewFlashcard } from './domain/flashcardReview';
import { evaluateAchievements } from './domain/achievements';
import { generateDailyStudyPlan } from './domain/studyPlan';
import { buildUnifiedReviewQueue, type UnifiedReviewItem } from './domain/unifiedReview';
import { getKarachiDayKey, getMsUntilNextKarachiMidnight } from './domain/studyDay';
import {
  computeStreakState,
  canonicalizeQuestionId,
  canonicalizeReviewItem,
} from './domain/dailyHabit';

import type {
  Question,
  StudySession,
  UserProfile,
  UserSettings,
  DailyActivityRecord,
  SessionFilterCriteria,
  QuestionPool,
  ReviewQueueItem,
  ErrorNotebookEntry,
  Flashcard,
  QuestionReport,
  ReportIssueType,
  ErrorCause,
  ConfidenceLevel,
  DiscoverCard,
  SaveToReviewResult,
  QuestionUserAnswer,
} from './domain/types';

const VALID_SCREENS: ScreenName[] = [
  'dashboard',
  'create-session',
  'player',
  'results',
  'error-notebook',
  'flashcards',
  'analytics',
  'workspace',
  'settings',
];

export interface ParsedRoute {
  screen: ScreenName;
  sessionId?: string;
  rawParams: Record<string, string>;
}

export function parseHashRoute(hash = typeof window !== 'undefined' ? window.location.hash : ''): ParsedRoute {
  const clean = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = clean.split('?');
  const pathSegments = pathPart ? pathPart.split('/').filter(Boolean) : [];
  const rawSegment = pathSegments[0] || 'today';

  let screen: ScreenName = 'dashboard';
  if (rawSegment === 'today' || rawSegment === 'dashboard') {
    screen = 'dashboard';
  } else if (rawSegment === 'practice' || rawSegment === 'create-session') {
    screen = 'create-session';
  } else if (rawSegment === 'cards' || rawSegment === 'flashcards') {
    screen = 'flashcards';
  } else if (VALID_SCREENS.includes(rawSegment as ScreenName)) {
    screen = rawSegment as ScreenName;
  }

  const rawParams: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      rawParams[key] = val;
    });
  }

  const sessionId = rawParams.sessionId || (pathSegments.length > 1 ? pathSegments[1] : undefined);
  return { screen, sessionId, rawParams };
}

export function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentScreen, setCurrentScreenState] = useState<ScreenName>(() => parseHashRoute().screen);
  const [resultsNotFound, setResultsNotFound] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Navigate helper syncs window.location.hash with clean destination slugs
  const navigate = useCallback((target: ScreenName | 'today' | 'practice' | 'cards', params?: { sessionId?: string }) => {
    let resolved: ScreenName = 'dashboard';
    let slug = 'today';

    if (target === 'today' || target === 'dashboard') {
      resolved = 'dashboard';
      slug = 'today';
    } else if (target === 'practice' || target === 'create-session') {
      resolved = 'create-session';
      slug = 'practice';
    } else if (target === 'cards' || target === 'flashcards') {
      resolved = 'flashcards';
      slug = 'cards';
    } else {
      resolved = target as ScreenName;
      slug = target;
    }

    let hash = `#/${slug}`;
    if (params?.sessionId) {
      hash += `?sessionId=${encodeURIComponent(params.sessionId)}`;
    }
    window.location.hash = hash;
    setCurrentScreenState(resolved);
  }, []);

  // Core domain state
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [viewingSession, setViewingSession] = useState<StudySession | null>(null);
  const [activeDayKey, setActiveDayKey] = useState<string>(() => getKarachiDayKey());
  const [allDailyActivity, setAllDailyActivity] = useState<DailyActivityRecord[]>([]);
  const [justQualifiedToday, setJustQualifiedToday] = useState<boolean>(false);

  // Phase 2 & Learning Content domain state
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [errorEntries, setErrorEntries] = useState<ErrorNotebookEntry[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [discoverCards, setDiscoverCards] = useState<DiscoverCard[]>([]);
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<Record<string, number>>({});

  // Onboarding modal visibility
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [createSessionInitialPool, setCreateSessionInitialPool] = useState<QuestionPool>('all');

  // Sync hash routing on window hashchange (browser back/forward & direct links)
  useEffect(() => {
    const handleHashChange = async () => {
      const { screen, sessionId } = parseHashRoute();

      if (screen === 'player') {
        if (!activeSession) {
          const inProgress = await sessionRepo.getActiveSession();
          if (inProgress) {
            setActiveSession(inProgress);
            setCurrentScreenState('player');
            return;
          }
          window.location.hash = '#/dashboard';
          setCurrentScreenState('dashboard');
          return;
        }
      }

      if (screen === 'results') {
        if (sessionId) {
          if (viewingSession && viewingSession.id === sessionId) {
            setResultsNotFound(false);
            setCurrentScreenState('results');
            return;
          }
          const found = sessions.find((s) => s.id === sessionId) || (await sessionRepo.getById(sessionId));
          if (found) {
            setViewingSession(found);
            setResultsNotFound(false);
            setCurrentScreenState('results');
            return;
          } else {
            setViewingSession(null);
            setResultsNotFound(true);
            setCurrentScreenState('results');
            return;
          }
        } else if (viewingSession) {
          setResultsNotFound(false);
          window.location.hash = `#/results?sessionId=${encodeURIComponent(viewingSession.id)}`;
          setCurrentScreenState('results');
          return;
        } else {
          window.location.hash = '#/dashboard';
          setCurrentScreenState('dashboard');
          return;
        }
      }

      setCurrentScreenState(screen);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeSession, viewingSession, sessions]);

  // Compute question history stats from past sessions
  const historyStats = useMemo(() => {
    const base = buildQuestionHistory(sessions);
    const dueReviews = getDueReviewItems(reviewQueue);
    return {
      ...base,
      dueReviewQuestionIds: new Set(dueReviews.map((r) => r.questionId)),
    };
  }, [sessions, reviewQueue]);

  // Load all initial data from IndexedDB
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        loadedProfile,
        loadedSettings,
        loadedQuestions,
        loadedSessions,
        loadedToday,
        loadedReviewQueue,
        loadedErrorEntries,
        loadedFlashcards,
        loadedReports,
        loadedAchievements,
        loadedDiscoverCards,
      ] = await Promise.all([
        profileRepo.getProfile(),
        settingsRepo.getSettings(),
        questionRepo.getAll(),
        sessionRepo.getAll(),
        dailyActivityRepo.getAll(),
        reviewQueueRepo.getAll(),
        errorNotebookRepo.getAll(),
        flashcardRepo.getAll(),
        questionReportRepo.getAll(),
        achievementRepo.getEarned(),
        discoverCardRepo.getAll(),
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
      setReviewQueue(loadedReviewQueue);
      setErrorEntries(loadedErrorEntries);
      setFlashcards(loadedFlashcards);
      setDiscoverCards(loadedDiscoverCards);
      setReports(loadedReports);
      setEarnedAchievements(loadedAchievements);

      // Check for in-progress session
      const inProgress = loadedSessions
        .filter((s) => s.status === 'in-progress')
        .sort((a, b) => b.startedAt - a.startedAt)[0];
      setActiveSession(inProgress || null);

      setAllDailyActivity(loadedToday as DailyActivityRecord[]);

      // Reconcile initial route on load / refresh
      const { screen, sessionId } = parseHashRoute();
      if (screen === 'results') {
        if (sessionId) {
          const found = loadedSessions.find((s) => s.id === sessionId) || (await sessionRepo.getById(sessionId));
          if (found) {
            setViewingSession(found);
            setResultsNotFound(false);
            setCurrentScreenState('results');
          } else {
            setViewingSession(null);
            setResultsNotFound(true);
            setCurrentScreenState('results');
          }
        } else {
          window.location.hash = '#/dashboard';
          setCurrentScreenState('dashboard');
        }
      } else if (screen === 'player') {
        if (inProgress) {
          setActiveSession(inProgress);
          setCurrentScreenState('player');
        } else {
          window.location.hash = '#/dashboard';
          setCurrentScreenState('dashboard');
        }
      } else {
        setCurrentScreenState(screen);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update UI when midnight passes in Asia/Karachi and when the app regains focus
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const checkAndUpdateDay = () => {
      const nowDay = getKarachiDayKey();
      setActiveDayKey((prev) => (prev !== nowDay ? nowDay : prev));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndUpdateDay();
      }
    };

    const handleFocus = () => {
      checkAndUpdateDay();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    const scheduleNextMidnight = () => {
      const msUntilMidnight = getMsUntilNextKarachiMidnight();
      timerId = setTimeout(() => {
        checkAndUpdateDay();
        scheduleNextMidnight();
      }, msUntilMidnight + 100);
    };
    scheduleNextMidnight();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearTimeout(timerId);
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'warm-ivory');
  }, [settings.theme]);

  // Calculate daily study plan
  const approvedQuestions = useMemo(() => {
    return allQuestions.filter((q) => q.editorialStatus === 'approved');
  }, [allQuestions]);

  const todayActivity = useMemo(() => {
    return allDailyActivity.find((a) => a.date === activeDayKey) || null;
  }, [allDailyActivity, activeDayKey]);

  const streakState = useMemo(() => {
    return computeStreakState(allDailyActivity, activeDayKey);
  }, [allDailyActivity, activeDayKey]);

  const studyPlan = useMemo(() => {
    return generateDailyStudyPlan(
      profile,
      todayActivity,
      activeSession,
      approvedQuestions,
      historyStats.answeredQuestionIds,
      reviewQueue
    );
  }, [profile, todayActivity, activeSession, approvedQuestions, historyStats, reviewQueue]);

  const dueCardsCount = useMemo(() => {
    return buildUnifiedReviewQueue(flashcards, reviewQueue, allQuestions, Date.now()).length;
  }, [flashcards, reviewQueue, allQuestions]);

  // Check achievements evaluation
  const checkAchievements = useCallback(
    async (currentSessions: StudySession[], currentErrors: ErrorNotebookEntry[], currentCards: Flashcard[]) => {
      const updated = evaluateAchievements(currentSessions, currentErrors, currentCards, earnedAchievements);
      if (Object.keys(updated).length !== Object.keys(earnedAchievements).length) {
        setEarnedAchievements(updated);
        await achievementRepo.saveEarned(updated);
      }
    },
    [earnedAchievements]
  );

  // Handle saving profile
  const handleSaveProfile = async (updated: UserProfile) => {
    try {
      await profileRepo.saveProfile(updated);
      setProfile(updated);
      setShowOnboarding(false);
      setStorageError(null);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setStorageError('Storage Notice: Unable to save profile to local browser storage.');
    }
  };

  // Handle skipping onboarding (marks completed so user is not prompted on refresh)
  const handleSkipOnboarding = async () => {
    try {
      const skipped: UserProfile = {
        ...profile,
        onboardingCompleted: true,
        updatedAt: Date.now(),
      };
      await profileRepo.saveProfile(skipped);
      setProfile(skipped);
      setShowOnboarding(false);
      setStorageError(null);
    } catch (err) {
      console.error('Failed to save skipped onboarding state:', err);
      setShowOnboarding(false);
    }
  };

  // Handle saving settings
  const handleSaveSettings = async (updated: UserSettings) => {
    try {
      await settingsRepo.saveSettings(updated);
      setSettings(updated);
      setStorageError(null);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStorageError('Storage Notice: Unable to save settings to local browser storage.');
    }
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

    try {
      await sessionRepo.save(newSession);
      setActiveSession(newSession);
      setSessions((prev) => [newSession, ...prev]);
      setStorageError(null);
      navigate('player');
    } catch (err) {
      console.error('Failed to save new session:', err);
      setStorageError('Storage Notice: Unable to save new session to local storage.');
    }
  };

  // Launch 5-question quick sprint
  const handleStartQuickSprint = () => {
    const criteria: SessionFilterCriteria = {
      systems: [],
      disciplines: [],
      topics: [],
      pool: 'all',
      count: 5,
      mode: 'tutor',
    };
    handleLaunchSession(criteria);
  };

  // Launch due reviews session using deterministic mapping
  const handleStartDueReviewsSession = async () => {
    const dueItems = getDueReviewItems(reviewQueue);
    if (dueItems.length === 0) return;

    const plan = buildDueReviewSessionPlan(dueItems, approvedQuestions);
    if (plan.questions.length === 0) return;

    const now = Date.now();
    const questionSnapshots: Question[] = JSON.parse(JSON.stringify(plan.questions));

    const reviewSession: StudySession = {
      id: `session-due-reviews-${now}`,
      name: `Spaced Review Block (${questionSnapshots.length} Qs)`,
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots,
      currentIndex: 0,
      answers: {},
      reviewMappings: plan.reviewMappings,
    };

    for (const q of questionSnapshots) {
      reviewSession.answers[q.id] = {
        selectedOptionId: null,
        isFlagged: false,
        eliminatedOptionIds: [],
        timeSpentSeconds: 0,
      };
    }

    try {
      await sessionRepo.save(reviewSession);
      setActiveSession(reviewSession);
      setSessions((prev) => [reviewSession, ...prev]);
      setStorageError(null);
      navigate('player');
    } catch (err) {
      console.error('Failed to save review session:', err);
      setStorageError('Storage Notice: Unable to launch review session.');
    }
  };

  // Resume an existing session
  const handleResumeSession = async (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId) || (await sessionRepo.getById(sessionId));
    if (s) {
      setActiveSession(s);
      navigate('player');
    }
  };

  // Save session state (autosave from player)
  const handleSaveSessionState = async (updated: StudySession) => {
    try {
      await sessionRepo.save(updated);
      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      console.error('Autosave failed:', err);
      setStorageError('Storage Notice: Autosave failed. Changes may not be persisted.');
      throw err;
    }
  };

  // Finalize/Finish session using authoritative repository transaction
  const handleFinishSession = async (sessionToFinish: StudySession) => {
    try {
      const now = Date.now();
      const currentDay = getKarachiDayKey(now);
      const result = await sessionRepo.finalizeSessionTransaction(sessionToFinish, currentDay, now);

      const updatedSessions = [result.session, ...sessions.filter((s) => s.id !== result.session.id)];
      if (result.updatedActivity) {
        setAllDailyActivity((prev) => {
          const idx = prev.findIndex((a) => a.date === result.updatedActivity!.date);
          if (idx >= 0) {
            return prev.map((a, i) => (i === idx ? result.updatedActivity! : a));
          }
          return [...prev, result.updatedActivity!];
        });
      }
      if (result.justQualified) {
        setJustQualifiedToday(true);
      }
      if (result.updatedReviewItems && result.updatedReviewItems.length > 0) {
        const updatedMap = new Map(result.updatedReviewItems.map((item) => [item.id, item]));
        setReviewQueue((prev) => prev.map((item) => updatedMap.get(item.id) || item));
      }
      if (result.newReviewItems && result.newReviewItems.length > 0) {
        setReviewQueue((prev) => [...prev, ...result.newReviewItems!]);
      }

      setActiveSession(null);
      setViewingSession(result.session);
      setResultsNotFound(false);
      setSessions(updatedSessions);
      setStorageError(null);
      navigate('results', { sessionId: result.session.id });

      // Check achievements from persisted records
      await checkAchievements(updatedSessions, errorEntries, flashcards);
    } catch (err: any) {
      console.error('Failed to finish session:', err);
      setStorageError('Storage Notice: Unable to finalize session to local storage.');
      throw err; // Re-throw so caller (QuestionPlayerView) receives typed failure and resets lock!
    }
  };

  // Record tutor mode answer submission as a qualifying habit action
  const handleRecordTutorAnswer = async (questionId: string) => {
    try {
      const now = Date.now();
      const currentDay = getKarachiDayKey(now);
      const res = await dailyActivityRepo.recordQualifyingAction(
        currentDay,
        canonicalizeQuestionId(questionId),
        { questionsAnswered: 1 },
        now
      );
      setAllDailyActivity((prev) => {
        const idx = prev.findIndex((a) => a.date === res.record.date);
        if (idx >= 0) {
          return prev.map((a, i) => (i === idx ? res.record : a));
        }
        return [...prev, res.record];
      });
      if (res.justQualified) {
        setJustQualifiedToday(true);
      }
    } catch (err) {
      console.warn('Could not record qualifying tutor action:', err);
    }
  };

  // View results of an already completed session
  const handleViewResults = (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId);
    if (s) {
      setViewingSession(s);
      setResultsNotFound(false);
    }
    navigate('results', { sessionId });
  };

  // Start a targeted review session with specific question IDs (from results screen)
  const handleStartReviewSession = async (questionIds: string[]) => {
    const subset = allQuestions.filter((q) => questionIds.includes(q.id) && q.editorialStatus === 'approved');
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

    try {
      await sessionRepo.save(reviewSession);
      setActiveSession(reviewSession);
      setSessions((prev) => [reviewSession, ...prev]);
      setStorageError(null);
      navigate('player');
    } catch (err) {
      console.error('Failed to save review session:', err);
      setStorageError('Storage Notice: Unable to launch review session.');
    }
  };

  // Start a review session from an exact question snapshot (from Error Notebook)
  const handleStartReviewFromSnapshot = async (snapshot: Question) => {
    const now = Date.now();
    const clonedSnapshot: Question = JSON.parse(JSON.stringify(snapshot));

    const reviewSession: StudySession = {
      id: `session-review-${now}`,
      name: `Error Review: ${clonedSnapshot.topic || clonedSnapshot.id} (v${clonedSnapshot.version})`,
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 10,
      questionSnapshots: [clonedSnapshot],
      currentIndex: 0,
      answers: {
        [clonedSnapshot.id]: {
          selectedOptionId: null,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 0,
        },
      },
    };

    try {
      await sessionRepo.save(reviewSession);
      setActiveSession(reviewSession);
      setSessions((prev) => [reviewSession, ...prev]);
      setStorageError(null);
      navigate('player');
    } catch (err) {
      console.error('Failed to save snapshot review session:', err);
      setStorageError('Storage Notice: Unable to launch review session.');
    }
  };

  // Error Notebook Handlers
  const handleSaveErrorEntry = async (entry: ErrorNotebookEntry) => {
    try {
      await errorNotebookRepo.save(entry);
      const updated = [entry, ...errorEntries.filter((e) => e.id !== entry.id)];
      setErrorEntries(updated);
      setStorageError(null);
      await checkAchievements(sessions, updated, flashcards);
    } catch (err) {
      console.error('Failed to save error notebook entry:', err);
      setStorageError('Storage Notice: Unable to save error notebook entry.');
    }
  };

  const handleDeleteErrorEntry = async (id: string) => {
    try {
      await errorNotebookRepo.delete(id);
      setErrorEntries((prev) => prev.filter((e) => e.id !== id));
      setStorageError(null);
    } catch (err) {
      console.error('Failed to delete error notebook entry:', err);
      setStorageError('Storage Notice: Unable to delete error notebook entry.');
    }
  };

  const handleCreateErrorEntryFromPlayer = async (
    q: Question,
    selectedOptionId: string | null,
    cause: ErrorCause,
    notes: string,
    takeaway: string
  ) => {
    const now = Date.now();
    const entry: ErrorNotebookEntry = {
      id: `err-${now}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: q.id,
      questionSnapshot: JSON.parse(JSON.stringify(q)),
      selectedOptionId,
      cause,
      studentNotes: notes,
      personalTakeaway: takeaway,
      createdAt: now,
      updatedAt: now,
    };
    await handleSaveErrorEntry(entry);
  };

  // Flashcards Handlers
  const handleSaveFlashcard = async (card: Flashcard) => {
    try {
      await flashcardRepo.save(card);
      const updated = [card, ...flashcards.filter((c) => c.id !== card.id)];
      setFlashcards(updated);
      setStorageError(null);
      await checkAchievements(sessions, errorEntries, updated);
    } catch (err) {
      console.error('Failed to save flashcard:', err);
      setStorageError('Storage Notice: Unable to save flashcard to local storage.');
      throw err;
    }
  };

  const handleDeleteFlashcard = async (id: string) => {
    try {
      await flashcardRepo.delete(id);
      setFlashcards((prev) => prev.filter((c) => c.id !== id));
      setStorageError(null);
    } catch (err) {
      console.error('Failed to delete flashcard:', err);
      setStorageError('Storage Notice: Unable to delete flashcard.');
    }
  };

  const handleCreateFlashcardFromEntry = async (front: string, back: string, topic: string) => {
    const card = createFlashcard(front, back, 'personal', { topic });
    await handleSaveFlashcard(card);
  };

  // Manual save question to review queue (idempotent, returns honest status)
  const handleSaveQuestionToReview = async (
    question: Question,
    answer?: QuestionUserAnswer
  ): Promise<SaveToReviewResult> => {
    try {
      const res = await saveQuestionToReview(question, answer);
      if (res.card) {
        setFlashcards((prev) => [...prev.filter((f) => f.id !== res.card!.id), res.card!]);
        const updatedRq = await reviewQueueRepo.getAll();
        setReviewQueue(updatedRq);
      }
      return res;
    } catch (err) {
      console.error('Failed to save question to review:', err);
      return {
        status: 'error',
        message: 'Storage notice: Could not save item to review queue.',
      };
    }
  };

  // Manual save Discover card to review queue (idempotent, returns honest status)
  const handleSaveDiscoverCardToReview = async (
    card: DiscoverCard
  ): Promise<SaveToReviewResult> => {
    try {
      const res = await saveDiscoverCardToReview(card);
      if (res.card) {
        setFlashcards((prev) => [...prev.filter((f) => f.id !== res.card!.id), res.card!]);
      }
      return res;
    } catch (err) {
      console.error('Failed to save discover card to review:', err);
      return {
        status: 'error',
        message: 'Storage notice: Could not save Discover concept to review queue.',
      };
    }
  };

  // Unified review rating handler (again / hard / remembered)
  // Preserves distinct scheduling semantics: updates card SRS and/or reviewQueue records
  const handleRateReviewItem = async (
    item: UnifiedReviewItem,
    rating: 'again' | 'hard' | 'remembered'
  ) => {
    const now = Date.now();

    // 1. Update backing flashcard if present
    if (item.flashcardId) {
      const card = flashcards.find((f) => f.id === item.flashcardId);
      if (card) {
        const ratingMap: Record<string, 'again' | 'difficult' | 'remembered'> = {
          again: 'again',
          hard: 'difficult',
          remembered: 'remembered',
        };
        const updatedCard = reviewFlashcard(card, ratingMap[rating], now);
        await flashcardRepo.save(updatedCard);
        setFlashcards((prev) => prev.map((f) => (f.id === updatedCard.id ? updatedCard : f)));
      }
    }

    // 2. Update backing reviewQueueItem if present
    if (item.reviewQueueItemId) {
      const queueItem = reviewQueue.find((rq) => rq.id === item.reviewQueueItemId);
      if (queueItem) {
        const isCorrect = rating !== 'again';
        const confidence: ConfidenceLevel = rating === 'hard' ? 'unsure' : 'confident';
        const updatedQueueItem = recordReviewAttempt(queueItem, isCorrect, confidence, now);
        await reviewQueueRepo.save(updatedQueueItem);
        setReviewQueue((prev) =>
          prev.map((rq) => (rq.id === updatedQueueItem.id ? updatedQueueItem : rq))
        );
      }
    }

    // 3. Record daily review credit together with schedule changes
    try {
      const currentDay = getKarachiDayKey(now);
      const canonicalId = canonicalizeReviewItem({
        id: item.id,
        sourceQuestionId: item.sourceQuestionId,
        sourceDiscoverCardId: item.sourceDiscoverCardId,
        flashcardId: item.flashcardId,
      });

      const res = await dailyActivityRepo.recordQualifyingAction(
        currentDay,
        canonicalId,
        { flashcardsReviewed: 1 },
        now
      );
      setAllDailyActivity((prev) => {
        const idx = prev.findIndex((a) => a.date === res.record.date);
        if (idx >= 0) {
          return prev.map((a, i) => (i === idx ? res.record : a));
        }
        return [...prev, res.record];
      });
      if (res.justQualified) {
        setJustQualifiedToday(true);
      }
    } catch (err) {
      console.warn('Could not record review activity credit:', err);
    }
  };

  // Retry question handler launched from Cards review item
  // Preserves question review scheduler and attaches review mapping
  const handleRetryQuestion = async (questionId: string) => {
    const targetQuestion = allQuestions.find((q) => q.id === questionId);
    if (!targetQuestion) return;

    const now = Date.now();
    const questionSnapshots = [JSON.parse(JSON.stringify(targetQuestion))];
    const matchingQueueItems = reviewQueue.filter(
      (rq) => rq.questionId === questionId && rq.status === 'pending'
    );

    const retrySession: StudySession = {
      id: `session-retry-${questionId}-${now}`,
      name: `Retry: ${targetQuestion.topic}`,
      mode: 'tutor',
      status: 'in-progress',
      createdAt: now,
      startedAt: now,
      durationMinutes: 5,
      questionSnapshots,
      currentIndex: 0,
      answers: {
        [questionId]: {
          selectedOptionId: null,
          isFlagged: false,
          eliminatedOptionIds: [],
          timeSpentSeconds: 0,
        },
      },
      reviewMappings: matchingQueueItems.length > 0
        ? {
            [questionId]: {
              questionId,
              originatingItemIds: matchingQueueItems.map((item) => item.id),
              originalQuestionIds: [questionId],
              wasAlternate: false,
            },
          }
        : undefined,
    };

    try {
      await sessionRepo.save(retrySession);
      setActiveSession(retrySession);
      setSessions((prev) => [retrySession, ...prev]);
      setStorageError(null);
      navigate('player');
    } catch (err) {
      console.error('Failed to launch retry session:', err);
      setStorageError('Storage Notice: Unable to launch retry session.');
    }
  };

  // Discover Card CRUD for Content Workspace
  const handleSaveDiscoverCard = async (card: DiscoverCard) => {
    try {
      await discoverCardRepo.save(card);
      setDiscoverCards((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
      setStorageError(null);
    } catch (err) {
      console.error('Failed to save discover card:', err);
      setStorageError('Storage Notice: Unable to save Discover card to local bank.');
    }
  };

  const handleDeleteDiscoverCard = async (id: string) => {
    try {
      await discoverCardRepo.delete(id);
      setDiscoverCards((prev) => prev.filter((c) => c.id !== id));
      setStorageError(null);
    } catch (err) {
      console.error('Failed to delete discover card:', err);
      setStorageError('Storage Notice: Unable to delete Discover card.');
    }
  };

  // Question Reports Handler
  const handleReportQuestion = async (reportData: {
    questionId: string;
    questionVersion: number;
    issueType: ReportIssueType;
    comment: string;
  }) => {
    try {
      const now = Date.now();
      const rep: QuestionReport = {
        id: `rep-${now}-${Math.random().toString(36).slice(2, 6)}`,
        questionId: reportData.questionId,
        questionVersion: reportData.questionVersion,
        issueType: reportData.issueType,
        comment: reportData.comment,
        createdAt: now,
        resolved: false,
      };
      await questionReportRepo.save(rep);
      setReports((prev) => [rep, ...prev]);
      setStorageError(null);
    } catch (err) {
      console.error('Failed to save report:', err);
      setStorageError('Storage Notice: Unable to save question report.');
    }
  };

  const handleResolveReport = async (reportId: string, note?: string) => {
    try {
      await questionReportRepo.markResolved(reportId, note);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, resolved: true, resolvedAt: Date.now(), resolutionNote: note } : r
        )
      );
      setStorageError(null);
    } catch (err) {
      console.error('Failed to resolve report:', err);
      setStorageError('Storage Notice: Unable to update report status.');
    }
  };

  // Content Workspace Handlers
  const handleSaveQuestion = async (q: Question) => {
    try {
      await questionRepo.save(q);
      setAllQuestions((prev) => [q, ...prev.filter((item) => item.id !== q.id)]);
      setStorageError(null);
    } catch (err) {
      console.error('Failed to save question:', err);
      setStorageError('Storage Notice: Unable to save question to local bank.');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await questionRepo.delete(id);
      setAllQuestions((prev) => prev.filter((q) => q.id !== id));
      setStorageError(null);
    } catch (err) {
      console.error('Failed to delete question:', err);
      setStorageError('Storage Notice: Unable to delete question.');
    }
  };

  // Start new session shortcut from dashboard
  const handleStartFromDashboard = (pool: QuestionPool = 'all') => {
    setCreateSessionInitialPool(pool);
    navigate('create-session');
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
        onNavigate={navigate}
        hasActiveSession={Boolean(activeSession)}
        onResumeSession={() => activeSession && handleResumeSession(activeSession.id)}
        settings={settings}
        dueFlashcardsCount={dueCardsCount}
        dueReviewsCount={studyPlan.dueReviewsCount}
        currentStreak={streakState.currentStreak}
        streakTooltip={`${streakState.currentStreak}d streak • ${streakState.todayCount}/5 actions today`}
        onToggleQuietMode={handleToggleQuietMode}
      />

      {/* Main Body View */}
      <main id="main-content">
        {/* Global Storage Error Alert */}
        {storageError && (
          <div
            role="alert"
            className="container"
            style={{
              marginTop: '16px',
              backgroundColor: 'var(--coral-light)',
              border: '2px solid var(--coral)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              color: 'var(--coral)',
              fontWeight: 600,
            }}
          >
            <span>{storageError}</span>
            <button
              onClick={() => setStorageError(null)}
              className="btn btn-sm btn-secondary"
              style={{ minHeight: '32px', padding: '2px 10px' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {currentScreen === 'dashboard' && (
          <DashboardView
            profile={profile}
            settings={settings}
            activeSession={activeSession}
            recentSessions={sessions}
            todayActivity={todayActivity}
            dueReviewsCount={studyPlan.dueReviewsCount}
            dueFlashcardsCount={dueCardsCount}
            availableUnusedCount={studyPlan.availableUnusedCount}
            isPlannedStudyDay={studyPlan.isPlannedStudyDay}
            earnedAchievements={earnedAchievements}
            totalApprovedQuestionsCount={approvedQuestions.length}
            streakState={streakState}
            justQualified={justQualifiedToday}
            onClearJustQualified={() => setJustQualifiedToday(false)}
            onStartNewSession={handleStartFromDashboard}
            onStartQuickSprint={handleStartQuickSprint}
            onStartDueReviewsSession={handleStartDueReviewsSession}
            onOpenFlashcards={() => navigate('flashcards')}
            onOpenErrorNotebook={() => navigate('error-notebook')}
            onResumeSession={handleResumeSession}
            onViewResults={handleViewResults}
            onOpenSettings={() => navigate('settings')}
          />
        )}

        {currentScreen === 'create-session' && (
          <CreateSessionView
            allQuestions={approvedQuestions}
            historyStats={historyStats}
            settings={settings}
            initialPool={createSessionInitialPool}
            onLaunchSession={handleLaunchSession}
            onCancel={() => navigate('dashboard')}
          />
        )}

        {currentScreen === 'player' && activeSession && (
          <QuestionPlayerView
            session={activeSession}
            settings={settings}
            onSaveSession={handleSaveSessionState}
            onFinishSession={handleFinishSession}
            onExitToDashboard={() => navigate('dashboard')}
            onReportQuestion={handleReportQuestion}
            onAddToErrorNotebook={handleCreateErrorEntryFromPlayer}
            onSaveQuestionToReview={handleSaveQuestionToReview}
            onRecordTutorAnswer={handleRecordTutorAnswer}
          />
        )}

        {currentScreen === 'results' && (
          viewingSession && !resultsNotFound ? (
            <ResultsView
              session={viewingSession}
              settings={settings}
              onStartReviewSession={handleStartReviewSession}
              onReturnToDashboard={() => navigate('dashboard')}
              onSaveQuestionToReview={handleSaveQuestionToReview}
            />
          ) : (
            <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div className="card-notebook" style={{ maxWidth: '480px', margin: '0 auto', padding: '32px' }}>
                <h2 style={{ marginBottom: '12px', color: 'var(--coral)' }}>Session Results Not Found</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                  The requested study session results could not be located in local storage or may have been deleted.
                </p>
                <button
                  onClick={() => navigate('dashboard')}
                  className="btn btn-primary"
                  id="return-to-dashboard-btn"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )
        )}

        {currentScreen === 'error-notebook' && (
          <ErrorNotebookView
            entries={errorEntries}
            settings={settings}
            onSaveEntry={handleSaveErrorEntry}
            onDeleteEntry={handleDeleteErrorEntry}
            onCreateFlashcardFromEntry={handleCreateFlashcardFromEntry}
            onJumpToQuestionReview={(entry) => handleStartReviewFromSnapshot(entry.questionSnapshot)}
          />
        )}

        {currentScreen === 'flashcards' && (
          <FlashcardsView
            flashcards={flashcards}
            reviewQueue={reviewQueue}
            discoverCards={discoverCards}
            questions={allQuestions}
            settings={settings}
            onSaveCard={handleSaveFlashcard}
            onDeleteCard={handleDeleteFlashcard}
            onRateReviewItem={handleRateReviewItem}
            onRetryQuestion={handleRetryQuestion}
            onSaveDiscoverCardToReview={handleSaveDiscoverCardToReview}
          />
        )}

        {currentScreen === 'analytics' && (
          <AnalyticsView
            sessions={sessions}
            settings={settings}
          />
        )}

        {currentScreen === 'workspace' && (
          <ContentWorkspaceView
            questions={allQuestions}
            reports={reports}
            settings={settings}
            discoverCards={discoverCards}
            onSaveQuestion={handleSaveQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onSaveDiscoverCard={handleSaveDiscoverCard}
            onDeleteDiscoverCard={handleDeleteDiscoverCard}
            onResolveReport={handleResolveReport}
            onReloadBank={loadData}
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
        onSkip={handleSkipOnboarding}
        quietMode={settings.quietMode}
      />
    </div>
  );
}

export default App;
