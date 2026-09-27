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
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
} from './persistence/indexedDbRepo';

import { buildQuestionHistory, filterQuestionsForSession } from './domain/eligibility';
import { computeDeadline } from './domain/timer';
import { finalizeSession } from './domain/scoring';
import {
  createReviewQueueItem,
  getDueReviewItems,
  resolveReviewQuestion,
} from './domain/spacedReview';
import { createFlashcard, getDueFlashcards } from './domain/flashcardReview';
import { evaluateAchievements } from './domain/achievements';
import { generateDailyStudyPlan } from './domain/studyPlan';

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

  // Phase 2 domain state
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [errorEntries, setErrorEntries] = useState<ErrorNotebookEntry[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [earnedAchievements, setEarnedAchievements] = useState<Record<string, number>>({});

  // Onboarding modal visibility
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [createSessionInitialPool, setCreateSessionInitialPool] = useState<QuestionPool>('all');

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
      ] = await Promise.all([
        profileRepo.getProfile(),
        settingsRepo.getSettings(),
        questionRepo.getAll(),
        sessionRepo.getAll(),
        dailyActivityRepo.getActivityForDate(todayStr),
        reviewQueueRepo.getAll(),
        errorNotebookRepo.getAll(),
        flashcardRepo.getAll(),
        questionReportRepo.getAll(),
        achievementRepo.getEarned(),
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
      setReports(loadedReports);
      setEarnedAchievements(loadedAchievements);

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

  // Calculate daily study plan
  const approvedQuestions = useMemo(() => {
    return allQuestions.filter((q) => q.editorialStatus === 'approved');
  }, [allQuestions]);

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

  // Launch due reviews session
  const handleStartDueReviewsSession = async () => {
    const dueItems = getDueReviewItems(reviewQueue);
    if (dueItems.length === 0) return;

    // Resolve questions for due review items
    const questionsToReview: Question[] = [];
    for (const item of dueItems) {
      const resolution = resolveReviewQuestion(item, approvedQuestions);
      if (resolution && !questionsToReview.some((q) => q.id === resolution.question.id)) {
        questionsToReview.push(resolution.question);
      }
    }

    if (questionsToReview.length === 0) return;

    const now = Date.now();
    const questionSnapshots: Question[] = JSON.parse(JSON.stringify(questionsToReview));

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

    // Automatic entry into Review Queue for incorrect or guessed/unsure answers
    const newReviewItems: ReviewQueueItem[] = [];
    const now = Date.now();

    for (const q of finalized.questionSnapshots) {
      const ans = finalized.answers[q.id];
      if (!ans) continue;
      const chosen = ans.firstSubmittedOptionId ?? ans.selectedOptionId;
      if (!chosen) continue;

      const isCorrect = chosen === q.correctOptionId;
      if (!isCorrect) {
        newReviewItems.push(createReviewQueueItem(q.id, q.conceptId, 'incorrect', now));
      } else if (ans.confidence === 'guessed' || ans.confidence === 'unsure') {
        newReviewItems.push(createReviewQueueItem(q.id, q.conceptId, ans.confidence, now));
      }
    }

    if (newReviewItems.length > 0) {
      await reviewQueueRepo.saveBatch(newReviewItems);
      setReviewQueue((prev) => [...prev, ...newReviewItems]);
    }

    const updatedSessions = [finalized, ...sessions.filter((s) => s.id !== finalized.id)];
    setTodayActivity(updatedActivity);
    setActiveSession(null);
    setViewingSession(finalized);
    setSessions(updatedSessions);
    setCurrentScreen('results');

    // Check achievements
    await checkAchievements(updatedSessions, errorEntries, flashcards);
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

    await sessionRepo.save(reviewSession);
    setActiveSession(reviewSession);
    setSessions((prev) => [reviewSession, ...prev]);
    setCurrentScreen('player');
  };

  // Error Notebook Handlers
  const handleSaveErrorEntry = async (entry: ErrorNotebookEntry) => {
    await errorNotebookRepo.save(entry);
    const updated = [entry, ...errorEntries.filter((e) => e.id !== entry.id)];
    setErrorEntries(updated);
    await checkAchievements(sessions, updated, flashcards);
  };

  const handleDeleteErrorEntry = async (id: string) => {
    await errorNotebookRepo.delete(id);
    setErrorEntries((prev) => prev.filter((e) => e.id !== id));
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
    await flashcardRepo.save(card);
    const updated = [card, ...flashcards.filter((c) => c.id !== card.id)];
    setFlashcards(updated);
    await checkAchievements(sessions, errorEntries, updated);
  };

  const handleDeleteFlashcard = async (id: string) => {
    await flashcardRepo.delete(id);
    setFlashcards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCreateFlashcardFromEntry = async (front: string, back: string, topic: string) => {
    const card = createFlashcard(front, back, 'personal', { topic });
    await handleSaveFlashcard(card);
  };

  // Question Reports Handler
  const handleReportQuestion = async (reportData: {
    questionId: string;
    questionVersion: number;
    issueType: ReportIssueType;
    comment: string;
  }) => {
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
  };

  const handleResolveReport = async (reportId: string, note?: string) => {
    await questionReportRepo.markResolved(reportId, note);
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, resolved: true, resolvedAt: Date.now(), resolutionNote: note } : r
      )
    );
  };

  // Content Workspace Handlers
  const handleSaveQuestion = async (q: Question) => {
    await questionRepo.save(q);
    setAllQuestions((prev) => [q, ...prev.filter((item) => item.id !== q.id)]);
  };

  const handleDeleteQuestion = async (id: string) => {
    await questionRepo.delete(id);
    setAllQuestions((prev) => prev.filter((q) => q.id !== id));
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

  const dueCardsCount = getDueFlashcards(flashcards).length;

  return (
    <div className={`wardwit-app ${settings.quietMode ? 'quiet-mode' : ''}`}>
      {/* Top Navigation */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        hasActiveSession={Boolean(activeSession)}
        onResumeSession={() => activeSession && handleResumeSession(activeSession.id)}
        settings={settings}
        dueFlashcardsCount={dueCardsCount}
        dueReviewsCount={studyPlan.dueReviewsCount}
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
            dueReviewsCount={studyPlan.dueReviewsCount}
            dueFlashcardsCount={dueCardsCount}
            availableUnusedCount={studyPlan.availableUnusedCount}
            isPlannedStudyDay={studyPlan.isPlannedStudyDay}
            earnedAchievements={earnedAchievements}
            totalApprovedQuestionsCount={approvedQuestions.length}
            onStartNewSession={handleStartFromDashboard}
            onStartQuickSprint={handleStartQuickSprint}
            onStartDueReviewsSession={handleStartDueReviewsSession}
            onOpenFlashcards={() => setCurrentScreen('flashcards')}
            onOpenErrorNotebook={() => setCurrentScreen('error-notebook')}
            onResumeSession={handleResumeSession}
            onViewResults={handleViewResults}
            onOpenSettings={() => setCurrentScreen('settings')}
          />
        )}

        {currentScreen === 'create-session' && (
          <CreateSessionView
            allQuestions={approvedQuestions}
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
            onReportQuestion={handleReportQuestion}
            onAddToErrorNotebook={handleCreateErrorEntryFromPlayer}
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

        {currentScreen === 'error-notebook' && (
          <ErrorNotebookView
            entries={errorEntries}
            settings={settings}
            onSaveEntry={handleSaveErrorEntry}
            onDeleteEntry={handleDeleteErrorEntry}
            onCreateFlashcardFromEntry={handleCreateFlashcardFromEntry}
            onJumpToQuestionReview={(entry) => handleStartReviewSession([entry.questionId])}
          />
        )}

        {currentScreen === 'flashcards' && (
          <FlashcardsView
            flashcards={flashcards}
            settings={settings}
            onSaveCard={handleSaveFlashcard}
            onDeleteCard={handleDeleteFlashcard}
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
            onSaveQuestion={handleSaveQuestion}
            onDeleteQuestion={handleDeleteQuestion}
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
        onSkip={() => setShowOnboarding(false)}
        quietMode={settings.quietMode}
      />
    </div>
  );
}

export default App;
