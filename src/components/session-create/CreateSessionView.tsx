import React, { useState, useMemo } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { TytoMascot } from '../mascot/TytoMascot';
import { filterQuestionsForSession, type QuestionHistoryStats } from '../../domain/eligibility';
import type { Question, SessionFilterCriteria, SessionMode, QuestionPool, UserSettings } from '../../domain/types';
import {
  Clock,
  BookOpen,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { BRAND } from '../../config/brand.config';

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

  // Form state — simple defaults
  const [mode, setMode] = useState<SessionMode>('tutor');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedContentKind, setSelectedContentKind] = useState<'all' | 'educational' | 'demo'>('all');

  // Advanced filters — collapsed by default
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<QuestionPool>(initialPool);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number>(10);

  // Select microcopy once on mount
  const tytoQuote = useMemo(() => {
    const quotes = BRAND.humorQuotes.focus;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, []);

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
      contentKind: selectedContentKind,
    };
  }, [selectedSystems, selectedDisciplines, selectedPool, questionCount, mode, durationMinutes, selectedContentKind]);

  const eligibility = useMemo(() => {
    return filterQuestionsForSession(allQuestions, historyStats, criteria);
  }, [allQuestions, historyStats, criteria]);

  // Count active advanced filters
  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (selectedPool !== 'all') count++;
    if (selectedSystems.length > 0) count += selectedSystems.length;
    if (selectedDisciplines.length > 0) count += selectedDisciplines.length;
    if (mode === 'timed' && durationMinutes !== 10) count++;
    return count;
  }, [selectedPool, selectedSystems, selectedDisciplines, mode, durationMinutes]);

  const toggleSystem = (sys: string) => {
    setSelectedSystems((prev) =>
      prev.includes(sys) ? prev.filter((s) => s !== sys) : [...prev, sys]
    );
  };

  const toggleDiscipline = (disc: string) => {
    setSelectedDisciplines((prev) =>
      prev.includes(disc) ? prev.filter((d) => d !== disc) : [...prev, disc]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (eligibility.actualCount === 0) return;
    onLaunchSession(criteria);
  };

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Header with Tyto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span className="badge badge-teal" style={{ marginBottom: '6px' }}>
            Custom Practice Block
          </span>
          <h1 style={{ fontSize: '1.9rem', letterSpacing: '-0.02em', color: 'var(--text-ink)' }}>
            Practice Mode
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px' }}>
            Configure your question sprint. Simple defaults with optional taxonomy and pool filters.
          </p>
        </div>

        <TytoMascot
          state="thinking"
          size={105}
          speechBubble={tytoQuote}
          speechPosition="left"
          quietMode={settings.quietMode}
        />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. PRIMARY CONFIGURATION: Mode & Count */}
        <div className="card-notebook" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {/* Mode Selector */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', marginBottom: '8px', color: 'var(--text-ink)' }}>
                Study Mode
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMode('tutor')}
                  className={`btn btn-sm ${mode === 'tutor' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '12px 14px', minHeight: '48px', justifyContent: 'center' }}
                  id="practice-mode-tutor-btn"
                >
                  <BookOpen size={16} />
                  <span>Tutor Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('timed')}
                  className={`btn btn-sm ${mode === 'timed' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '12px 14px', minHeight: '48px', justifyContent: 'center' }}
                  id="practice-mode-timed-btn"
                >
                  <Clock size={16} />
                  <span>Timed Exam</span>
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {mode === 'tutor'
                  ? 'Immediate explanations and rationale after each question.'
                  : 'Strict countdown clock. Score and feedback presented after finishing the block.'}
              </div>
            </div>

            {/* Question Count Presets */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', marginBottom: '8px', color: 'var(--text-ink)' }}>
                Number of Questions
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    className={`btn btn-sm ${questionCount === num ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, minHeight: '48px', fontWeight: 700 }}
                    id={`practice-count-${num}-btn`}
                  >
                    {num} Qs
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Quick 5-10 question blocks are recommended for focused recall.
              </div>
            </div>
          </div>
        </div>

        {/* 2. CONTENT BANK SEPARATION */}
        <div className="card-notebook" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-ink)' }}>
              Content Bank Source
            </label>
            <span className="badge badge-teal">{selectedContentKind === 'all' ? 'All Items' : selectedContentKind}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              {
                id: 'all',
                title: 'All Approved Questions',
                count: allQuestions.length,
                desc: 'Combined pool of educational and demo items',
              },
              {
                id: 'educational',
                title: 'Educational Bank',
                count: allQuestions.filter((q) => q.contentKind === 'educational').length,
                desc: 'Peer-reviewed Step 1 medical questions',
              },
              {
                id: 'demo',
                title: 'Demonstration Bank',
                count: allQuestions.filter((q) => q.contentKind === 'demo').length,
                desc: 'Nonclinical biostatistics & heuristics vignettes',
              },
            ].map((bank) => {
              const isSelected = selectedContentKind === bank.id;
              return (
                <div
                  key={bank.id}
                  onClick={() => setSelectedContentKind(bank.id as any)}
                  className={`card-notebook card-notebook-interactive ${isSelected ? 'option-selected' : ''}`}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--primary-teal-subtle)' : 'var(--bg-surface)',
                    border: `1.5px solid ${isSelected ? 'var(--primary-teal)' : 'var(--border-subtle)'}`,
                  }}
                  id={`practice-bank-${bank.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-ink)' }}>
                      {bank.title}
                    </span>
                    <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                      {bank.count}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {bank.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. COLLAPSED ADVANCED CONFIGURATION (Accordion / Disclosure) */}
        <div className="card-notebook" style={{ overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%',
              padding: '16px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-surface-alt)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: 'var(--text-ink)',
            }}
            id="practice-toggle-advanced-btn"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={17} style={{ color: 'var(--primary-teal)' }} />
              <span>Advanced Filters & Taxonomy</span>
              {activeAdvancedCount > 0 && (
                <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>
                  {activeAdvancedCount} active
                </span>
              )}
            </div>
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showAdvanced && (
            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Question Pool */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                  Question Pool Filter
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { id: 'all', label: 'All Pool' },
                    { id: 'unused', label: 'Unused Questions Only' },
                    { id: 'incorrect', label: 'Past Incorrects' },
                    { id: 'flagged', label: 'Flagged by You' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPool(p.id as any)}
                      className={`btn btn-sm ${selectedPool === p.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.82rem' }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Organ Systems */}
              {availableSystems.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                    Filter by System ({selectedSystems.length > 0 ? `${selectedSystems.length} selected` : 'All Systems'})
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {availableSystems.map((sys) => {
                      const isChecked = selectedSystems.includes(sys);
                      return (
                        <button
                          key={sys}
                          type="button"
                          onClick={() => toggleSystem(sys)}
                          className={`btn btn-sm ${isChecked ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        >
                          {isChecked && <Check size={12} />}
                          <span>{sys}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Disciplines */}
              {availableDisciplines.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                    Filter by Discipline ({selectedDisciplines.length > 0 ? `${selectedDisciplines.length} selected` : 'All Disciplines'})
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {availableDisciplines.map((disc) => {
                      const isChecked = selectedDisciplines.includes(disc);
                      return (
                        <button
                          key={disc}
                          type="button"
                          onClick={() => toggleDiscipline(disc)}
                          className={`btn btn-sm ${isChecked ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        >
                          {isChecked && <Check size={12} />}
                          <span>{disc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timed duration slider */}
              {mode === 'timed' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    Block Duration: {durationMinutes} Minutes (~{(durationMinutes * 60 / questionCount).toFixed(0)}s per question)
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={60}
                    step={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: 'var(--primary-teal)' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. LAUNCH SUMMARY & CTA BAR */}
        <div
          className="card-notebook"
          style={{
            padding: '20px 24px',
            backgroundColor: '#FFFFFF',
            border: '2px solid var(--primary-teal)',
            boxShadow: '0 8px 25px -4px rgba(15, 118, 110, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-teal">
                {eligibility.actualCount} Available Questions
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {mode === 'tutor' ? 'Tutor Mode' : `Timed (${durationMinutes}m)`}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {eligibility.actualCount === 0
                ? 'No questions match the current filter criteria. Broaden your filters.'
                : `Block will contain ${eligibility.actualCount} questions selected without in-session repeats.`}
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
              className="btn btn-primary btn-lg"
              id="practice-launch-btn"
              style={{ minWidth: '180px' }}
            >
              <Play size={18} fill="currentColor" />
              <span>Start Practice ({eligibility.actualCount})</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateSessionView;
