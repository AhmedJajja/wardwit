import React, { useState, useMemo } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { ClipMascot } from '../mascot/ClipMascot';
import { filterQuestionsForSession, type QuestionHistoryStats } from '../../domain/eligibility';
import type { Question, SessionFilterCriteria, SessionMode, QuestionPool, UserSettings } from '../../domain/types';
import { Filter, Layers, Clock, BookOpen, AlertCircle, Play, Check } from 'lucide-react';

interface CreateSessionViewProps {
  allQuestions: Question[];
  historyStats: QuestionHistoryStats;
  settings: UserSettings;
  initialPool?: QuestionPool;
  onLaunchSession: (criteria: SessionFilterCriteria) => void;
  onCancel: () => void;
}

export const CreateSessionView: React.FC<CreateSessionViewProps> = ({
  allQuestions,
  historyStats,
  settings,
  initialPool = 'all',
  onLaunchSession,
  onCancel,
}) => {
  // Extract unique taxonomies from all available questions
  const availableSystems = useMemo(() => {
    return Array.from(new Set(allQuestions.map((q) => q.system))).sort();
  }, [allQuestions]);

  const availableDisciplines = useMemo(() => {
    return Array.from(new Set(allQuestions.map((q) => q.discipline))).sort();
  }, [allQuestions]);

  // Form state
  const [selectedPool, setSelectedPool] = useState<QuestionPool>(initialPool);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [mode, setMode] = useState<SessionMode>('tutor');
  const [durationMinutes, setDurationMinutes] = useState<number>(10);

  // Compute live match count based on chosen filters
  const criteria: SessionFilterCriteria = useMemo(() => {
    return {
      systems: selectedSystems,
      disciplines: selectedDisciplines,
      topics: [],
      pool: selectedPool,
      count: questionCount,
      mode,
      durationMinutes: mode === 'timed' ? durationMinutes : undefined,
    };
  }, [selectedSystems, selectedDisciplines, selectedPool, questionCount, mode, durationMinutes]);

  const eligibility = useMemo(() => {
    return filterQuestionsForSession(allQuestions, historyStats, criteria);
  }, [allQuestions, historyStats, criteria]);

  // Toggle taxonomy helper
  const toggleSystem = (sys: string) => {
    if (selectedSystems.includes(sys)) {
      setSelectedSystems(selectedSystems.filter((s) => s !== sys));
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  };

  const toggleDiscipline = (disc: string) => {
    if (selectedDisciplines.includes(disc)) {
      setSelectedDisciplines(selectedDisciplines.filter((d) => d !== disc));
    } else {
      setSelectedDisciplines([...selectedDisciplines, disc]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (eligibility.actualCount === 0) return;
    onLaunchSession(criteria);
  };

  return (
    <div className="container" style={{ paddingBottom: '48px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-teal" style={{ marginBottom: '4px' }}>Session Configurator</span>
          <h1 style={{ fontSize: '1.8rem' }}>Create Practice Session</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Configure question pool, dummy systems, and block duration. Questions are drawn honestly without repetition.
          </p>
        </div>

        <ClipMascot
          pose="focus"
          size={95}
          speechBubble={settings.quietMode ? undefined : 'Precision practice. Select your question parameters!'}
          quietMode={settings.quietMode}
        />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* 1. Question Pool Selection */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Layers size={20} style={{ color: 'var(--primary-teal)' }} />
            <h2 style={{ fontSize: '1.15rem' }}>1. Question Pool Status</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            {[
              { id: 'all', title: 'All Questions', desc: `${allQuestions.length} total demo bank` },
              {
                id: 'unused',
                title: 'Unused Questions',
                desc: `${allQuestions.length - historyStats.answeredQuestionIds.size} untouched`,
              },
              {
                id: 'incorrect',
                title: 'Incorrect Questions',
                desc: `${historyStats.incorrectQuestionIds.size} need review`,
              },
              {
                id: 'flagged',
                title: 'Flagged Questions',
                desc: `${historyStats.flaggedQuestionIds.size} bookmarked`,
              },
            ].map((p) => {
              const isSelected = selectedPool === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPool(p.id as QuestionPool)}
                  className={`card-notebook card-notebook-interactive`}
                  style={{
                    padding: '14px',
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--primary-teal)' : 'var(--border-ink)',
                    backgroundColor: isSelected ? 'var(--primary-teal-subtle)' : 'var(--bg-surface)',
                    borderWidth: isSelected ? '2.5px' : '2px',
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedPool(p.id as QuestionPool)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.title}</div>
                    {isSelected && <Check size={16} style={{ color: 'var(--primary-teal)' }} />}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Taxonomy Filters (Systems & Disciplines) */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Filter size={20} style={{ color: 'var(--primary-teal)' }} />
            <h2 style={{ fontSize: '1.15rem' }}>2. Demonstration Taxonomy Filters</h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Taxonomies are marked (Demo) to maintain honest medical boundaries. Leave unselected to include all.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Systems */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Systems ({selectedSystems.length || 'All'})</span>
                {selectedSystems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSystems([])}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableSystems.map((sys) => {
                  const isChecked = selectedSystems.includes(sys);
                  return (
                    <label
                      key={sys}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isChecked ? 'var(--primary-teal-subtle)' : 'var(--bg-canvas)',
                        border: '1px solid var(--border-ink)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSystem(sys)}
                        style={{ accentColor: 'var(--primary-teal)' }}
                      />
                      <span>{sys}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Disciplines */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Disciplines ({selectedDisciplines.length || 'All'})</span>
                {selectedDisciplines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDisciplines([])}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableDisciplines.map((disc) => {
                  const isChecked = selectedDisciplines.includes(disc);
                  return (
                    <label
                      key={disc}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isChecked ? 'var(--primary-teal-subtle)' : 'var(--bg-canvas)',
                        border: '1px solid var(--border-ink)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDiscipline(disc)}
                        style={{ accentColor: 'var(--primary-teal)' }}
                      />
                      <span>{disc}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Session Mode & Question Count */}
        <div className="card-notebook" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <BookOpen size={20} style={{ color: 'var(--primary-teal)' }} />
            <h2 style={{ fontSize: '1.15rem' }}>3. Practice Mode & Size</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* Mode: Tutor vs Timed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>Mode</label>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div
                  onClick={() => setMode('tutor')}
                  className="card-notebook card-notebook-interactive"
                  style={{
                    flex: 1,
                    padding: '12px',
                    cursor: 'pointer',
                    borderColor: mode === 'tutor' ? 'var(--primary-teal)' : 'var(--border-ink)',
                    backgroundColor: mode === 'tutor' ? 'var(--primary-teal-subtle)' : 'var(--bg-surface)',
                  }}
                  role="radio"
                  aria-checked={mode === 'tutor'}
                  tabIndex={0}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '4px' }}>Tutor Mode</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Immediate feedback and explanations after submitting each question.
                  </div>
                </div>

                <div
                  onClick={() => setMode('timed')}
                  className="card-notebook card-notebook-interactive"
                  style={{
                    flex: 1,
                    padding: '12px',
                    cursor: 'pointer',
                    borderColor: mode === 'timed' ? 'var(--coral)' : 'var(--border-ink)',
                    backgroundColor: mode === 'timed' ? 'var(--coral-light)' : 'var(--bg-surface)',
                  }}
                  role="radio"
                  aria-checked={mode === 'timed'}
                  tabIndex={0}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '4px' }}>Timed Mode</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Countdown timer active. Feedback disclosed only after block submission.
                  </div>
                </div>
              </div>
            </div>

            {/* Question Count Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="q-count-input" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Target Question Count: {questionCount}
                </label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Max available: {eligibility.totalMatchingFilters}
                </span>
              </div>
              <input
                id="q-count-input"
                type="range"
                min="1"
                max={Math.max(1, Math.min(12, allQuestions.length))}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-teal)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>1 question</span>
                <span>5 questions</span>
                <span>{Math.max(1, Math.min(12, allQuestions.length))} questions</span>
              </div>
            </div>

            {/* Timed Mode Duration Config */}
            {mode === 'timed' && (
              <div>
                <label htmlFor="duration-input" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                  <Clock size={16} />
                  <span>Block Duration: {durationMinutes} minutes</span>
                </label>
                <input
                  id="duration-input"
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--coral)', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>
                  (~{Math.round((durationMinutes * 60) / Math.max(1, questionCount))} seconds per question)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Matching Summary & Honest Disclaimers */}
        <div
          className="card-notebook"
          style={{
            padding: '16px 20px',
            backgroundColor: eligibility.actualCount > 0 ? 'var(--mint-light)' : 'var(--coral-light)',
            borderColor: eligibility.actualCount > 0 ? 'var(--mint)' : 'var(--coral)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {eligibility.actualCount > 0 ? (
              <Check size={22} style={{ color: 'var(--mint)' }} />
            ) : (
              <AlertCircle size={22} style={{ color: 'var(--coral)' }} />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-ink)' }}>
                {eligibility.actualCount} Question{eligibility.actualCount === 1 ? '' : 's'} Ready to Launch
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {eligibility.message || `${eligibility.totalMatchingFilters} matching questions found in the ${selectedPool} pool.`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={eligibility.actualCount === 0}
              className="btn btn-primary"
              id="create-session-launch-btn"
              style={{
                opacity: eligibility.actualCount === 0 ? 0.5 : 1,
                cursor: eligibility.actualCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>Launch Session ({eligibility.actualCount})</span>
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          * Practice block for software demonstration only. Not an official USMLE simulation.
        </div>
      </form>
    </div>
  );
};
