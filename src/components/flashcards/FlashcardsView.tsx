import React, { useState } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { ClipMascot } from '../mascot/ClipMascot';
import { reviewFlashcard, createFlashcard, getDueFlashcards } from '../../domain/flashcardReview';
import type { Flashcard, CardRating, UserSettings } from '../../domain/types';
import {
  Layers,
  RotateCw,
  PlusCircle,
  Trash2,
  Search,
} from 'lucide-react';

interface FlashcardsViewProps {
  flashcards: Flashcard[];
  settings: UserSettings;
  onSaveCard: (card: Flashcard) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  flashcards,
  settings,
  onSaveCard,
  onDeleteCard,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'library'>('review');
  const [currentDueIndex, setCurrentDueIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New card form state
  const [newFront, setNewFront] = useState<string>('');
  const [newBack, setNewBack] = useState<string>('');
  const [newTopic, setNewTopic] = useState<string>('');

  const now = Date.now();
  const dueCards = getDueFlashcards(flashcards, now);
  const currentCard = dueCards[currentDueIndex];

  // Handle rating due card
  const handleRateCard = async (rating: CardRating) => {
    if (!currentCard) return;

    const updated = reviewFlashcard(currentCard, rating, now);
    await onSaveCard(updated);

    setIsFlipped(false);
    if (currentDueIndex >= dueCards.length - 1) {
      setCurrentDueIndex(0);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const card = createFlashcard(newFront, newBack, 'personal', {
      topic: newTopic.trim() || 'General Recall',
    });
    await onSaveCard(card);

    setNewFront('');
    setNewBack('');
    setNewTopic('');
    setShowCreateModal(false);
  };

  const filteredLibrary = flashcards.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.front.toLowerCase().includes(q) ||
      c.back.toLowerCase().includes(q) ||
      (c.topic && c.topic.toLowerCase().includes(q))
    );
  });

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '16px', marginBottom: '20px' }}>
        <div>
          <span className="badge badge-mint" style={{ marginBottom: '4px' }}>Active Recall System</span>
          <h1 style={{ fontSize: '1.85rem' }}>Field Flashcards</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            High-yield active recall with simple Leitner spaced repetition intervals.
          </p>
        </div>

        <ClipMascot
          pose="focus"
          size={95}
          speechBubble={settings.quietMode ? undefined : 'Retrieve before you flip! That is where the synapses lock.'}
          quietMode={settings.quietMode}
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setActiveTab('review');
              setIsFlipped(false);
            }}
            className={`btn btn-sm ${activeTab === 'review' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <RotateCw size={14} />
            <span>Due for Review ({dueCards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`btn btn-sm ${activeTab === 'library' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Layers size={14} />
            <span>Card Library ({flashcards.length})</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm"
          id="flashcards-create-btn"
        >
          <PlusCircle size={15} />
          <span>New Flashcard</span>
        </button>
      </div>

      {/* TAB 1: REVIEW DUE CARDS */}
      {activeTab === 'review' && (
        <div>
          {dueCards.length === 0 ? (
            /* All caught up state */
            <div
              className="card-notebook"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-canvas)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <ClipMascot
                  pose="celebration"
                  size={110}
                  speechBubble={settings.quietMode ? undefined : 'Sabash! All due flashcards reviewed!'}
                  quietMode={settings.quietMode}
                />
              </div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Zero Cards Due Right Now</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 20px' }}>
                Your recall queue is clear. Create cards from your Error Notebook takeaways or add new cards below.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                <PlusCircle size={16} />
                <span>Create Flashcard</span>
              </button>
            </div>
          ) : (
            /* Active Flip Card */
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Card {currentDueIndex + 1} of {dueCards.length} due
                </span>
                <span className="badge badge-teal">{currentCard.topic || 'General Recall'}</span>
              </div>

              {/* Card Container */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="card-notebook card-notebook-interactive"
                style={{
                  minHeight: '260px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: isFlipped ? 'var(--bg-surface)' : 'var(--bg-canvas)',
                  border: '2.5px solid var(--border-ink)',
                  boxShadow: 'var(--shadow-offset-hover)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setIsFlipped(!isFlipped)}
                aria-label="Flashcard. Click or press space to flip."
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-surface-alt)', paddingBottom: '8px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-light)' }}>
                    {isFlipped ? 'Back (Answer / Takeaway)' : 'Front (Prompt)'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    (Click to flip)
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    lineHeight: 1.6,
                    color: 'var(--text-ink)',
                    textAlign: 'center',
                    margin: 'auto 0',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {isFlipped ? currentCard.back : currentCard.front}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', textAlign: 'center', paddingTop: '10px' }}>
                  Current repetition stage: <strong>{currentCard.repetitions}</strong> ({currentCard.intervalDays}d interval)
                </div>
              </div>

              {/* Rating Controls (Shown after flip) */}
              <div style={{ marginTop: '20px' }}>
                {isFlipped ? (
                  <div>
                    <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>
                      How well did you recall this concept?
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <button
                        onClick={() => handleRateCard('again')}
                        className="btn btn-secondary"
                        style={{ borderColor: 'var(--coral)', color: 'var(--coral)', flexDirection: 'column', padding: '10px' }}
                      >
                        <span style={{ fontWeight: 700 }}>Again</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>1 day</span>
                      </button>

                      <button
                        onClick={() => handleRateCard('difficult')}
                        className="btn btn-secondary"
                        style={{ borderColor: 'var(--marigold)', color: 'var(--marigold)', flexDirection: 'column', padding: '10px' }}
                      >
                        <span style={{ fontWeight: 700 }}>Difficult</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>~{Math.max(1, Math.round(currentCard.intervalDays * 1.3))}d</span>
                      </button>

                      <button
                        onClick={() => handleRateCard('remembered')}
                        className="btn btn-primary"
                        style={{ flexDirection: 'column', padding: '10px' }}
                      >
                        <span style={{ fontWeight: 700 }}>Remembered</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                          ~{currentCard.repetitions === 0 ? '1' : currentCard.repetitions === 1 ? '3' : Math.round(currentCard.intervalDays * 2.4)}d
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsFlipped(true)}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '12px' }}
                  >
                    <span>Show Answer</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CARD LIBRARY */}
      {activeTab === 'library' && (
        <div>
          {/* Search bar */}
          <div
            className="card-notebook"
            style={{
              padding: '12px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flashcards library..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '0.9rem',
                backgroundColor: 'transparent',
                color: 'var(--text-ink)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredLibrary.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                No flashcards in library matching search.
              </div>
            ) : (
              filteredLibrary.map((c) => {
                const nextDueDateStr = new Date(c.dueAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                const isDue = c.dueAt <= now;

                return (
                  <div
                    key={c.id}
                    className="card-notebook"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: '1 1 340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="badge badge-mint">{c.topic || 'Recall'}</span>
                        <span className="badge badge-demo">{c.cardKind}</span>
                        {isDue && <span className="badge badge-coral">Due Now</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>
                        {c.front}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {c.back}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <div>Stage: <strong>{c.repetitions}</strong> ({c.intervalDays}d)</div>
                        <div>Next Due: <strong>{nextDueDateStr}</strong></div>
                      </div>

                      <button
                        onClick={() => onDeleteCard(c.id)}
                        className="btn btn-sm btn-outline"
                        style={{ color: 'var(--coral)', borderColor: 'var(--coral)', padding: '6px' }}
                        title="Delete card"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CREATE FLASHCARD MODAL */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-flashcard-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(21, 26, 30, 0.75)',
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
              maxWidth: '520px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <h3 id="create-flashcard-title" style={{ fontSize: '1.3rem', marginBottom: '14px' }}>
              Create Personal Flashcard
            </h3>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Topic / Subheading
                </label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Acid-Base Logic, Sensitivity Cutoffs"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.9rem',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Card Front (Question / Clinical Cue)
                </label>
                <textarea
                  rows={3}
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="What is the expected PaCO2 compensation in metabolic acidosis according to Winter's formula?"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Card Back (Concise Answer / Key Principle)
                </label>
                <textarea
                  rows={3}
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Expected PaCO2 = (1.5 × [HCO3-]) + 8 ± 2. Keep answers concise for rapid recall."
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Flashcard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
