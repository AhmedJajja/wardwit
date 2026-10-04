import React, { useState, useMemo } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { TytoMascot } from '../mascot/TytoMascot';
import { EducationalDiagram } from '../common/EducationalDiagram';
import { createFlashcard } from '../../domain/flashcardReview';
import {
  buildUnifiedReviewQueue,
  type UnifiedReviewItem,
} from '../../domain/unifiedReview';
import type {
  Flashcard,
  ReviewQueueItem,
  Question,
  DiscoverCard,
  UserSettings,
  SaveToReviewResult,
} from '../../domain/types';
import {
  RotateCcw,
  RotateCw,
  PlusCircle,
  Search,
  Eye,
  Check,
  CheckCircle2,
  XCircle,
  BookOpen,
  Bookmark,
  CheckCheck,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FlashcardsViewProps {
  flashcards: Flashcard[];
  reviewQueue: ReviewQueueItem[];
  questions: Question[];
  discoverCards: DiscoverCard[];
  settings: UserSettings;
  onSaveCard: (card: Flashcard) => Promise<void>;
  onDeleteCard?: (id: string) => Promise<void>;
  onSaveDiscoverCardToReview: (discoverCard: DiscoverCard) => Promise<SaveToReviewResult>;
  onRateReviewItem: (item: UnifiedReviewItem, rating: 'again' | 'hard' | 'remembered') => Promise<void>;
  onRetryQuestion?: (questionId: string) => void;
  onStartDueReviewsSession?: () => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  flashcards,
  reviewQueue,
  questions,
  discoverCards,
  settings,
  onSaveCard,
  onDeleteCard: _onDeleteCard,
  onSaveDiscoverCardToReview,
  onRateReviewItem,
  onRetryQuestion,
  onStartDueReviewsSession: _onStartDueReviewsSession,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'discover'>('review');

  // Review Queue state
  const [currentReviewIdx, setCurrentReviewIdx] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  // Discover state
  const [discoverIndex, setDiscoverIndex] = useState<number>(0);
  const [isDiscoverRevealed, setIsDiscoverRevealed] = useState<boolean>(false);
  const [discoverSystemFilter, setDiscoverSystemFilter] = useState<string>('all');
  const [discoverKindFilter, setDiscoverKindFilter] = useState<'all' | 'educational' | 'demo'>('all');
  const [discoverSearch, setDiscoverSearch] = useState<string>('');
  const [discoverNotice, setDiscoverNotice] = useState<{ id: string; result: SaveToReviewResult } | null>(null);
  const [isBatchCompleted, setIsBatchCompleted] = useState<boolean>(false);

  // Edit personal card modal
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editFront, setEditFront] = useState<string>('');
  const [editBack, setEditBack] = useState<string>('');

  // Create personal card modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFront, setNewFront] = useState<string>('');
  const [newBack, setNewBack] = useState<string>('');
  const [newTopic, setNewTopic] = useState<string>('');
  const [createReverseCard, setCreateReverseCard] = useState<boolean>(false);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Build unified, de-duplicated due review queue
  const now = Date.now();
  const dueItems = useMemo(() => {
    return buildUnifiedReviewQueue(flashcards, reviewQueue, questions, now);
  }, [flashcards, reviewQueue, questions, now]);

  const currentItem = dueItems[currentReviewIdx];

  // Filter approved Discover cards
  const filteredDiscoverCards = useMemo(() => {
    return discoverCards.filter((card) => {
      // Must be approved in the real study pool
      if (card.editorialStatus !== 'approved') return false;
      if (discoverKindFilter !== 'all' && card.contentKind !== discoverKindFilter) {
        return false;
      }
      if (discoverSystemFilter !== 'all' && card.curriculumMapping.system !== discoverSystemFilter) {
        return false;
      }
      if (discoverSearch.trim()) {
        const query = discoverSearch.toLowerCase();
        return (
          card.revealedConcept.toLowerCase().includes(query) ||
          card.curiosityPrompt.toLowerCase().includes(query) ||
          card.conciseExplanation.toLowerCase().includes(query) ||
          card.curriculumMapping.topic.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [discoverCards, discoverKindFilter, discoverSystemFilter, discoverSearch]);

  const currentDiscoverCard = filteredDiscoverCards[discoverIndex];

  // Discover Systems
  const discoverSystems = useMemo(() => {
    const set = new Set<string>();
    discoverCards.forEach((c) => {
      if (c.editorialStatus === 'approved') set.add(c.curriculumMapping.system);
    });
    return Array.from(set);
  }, [discoverCards]);

  // Handle rating a review item
  const handleRate = async (rating: 'again' | 'hard' | 'remembered') => {
    if (!currentItem) return;
    await onRateReviewItem(currentItem, rating);
    setIsRevealed(false);
    if (currentReviewIdx >= dueItems.length - 1) {
      setCurrentReviewIdx(0);
    }
  };

  // Handle Discover Save to Review
  const handleSaveDiscover = async (card: DiscoverCard) => {
    try {
      const res = await onSaveDiscoverCardToReview(card);
      setDiscoverNotice({ id: card.id, result: res });
      setTimeout(() => setDiscoverNotice(null), 4000);
    } catch (err: any) {
      setDiscoverNotice({
        id: card.id,
        result: { status: 'error', message: err.message || 'Storage error' },
      });
    }
  };

  // Create personal card submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    setCreateError(null);
    setIsSavingCard(true);
    try {
      const topic = newTopic.trim() || 'General Recall';
      const card = createFlashcard(newFront.trim(), newBack.trim(), 'personal', { topic });
      await onSaveCard(card);

      if (createReverseCard) {
        const revCard = createFlashcard(newBack.trim(), newFront.trim(), 'personal', {
          topic: `${topic} (Reversed)`,
        });
        await onSaveCard(revCard);
      }

      setNewFront('');
      setNewBack('');
      setNewTopic('');
      setCreateReverseCard(false);
      setShowCreateModal(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to save card.');
    } finally {
      setIsSavingCard(false);
    }
  };

  // Edit card submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard || !editFront.trim() || !editBack.trim()) return;

    const updated: Flashcard = {
      ...editingCard,
      front: editFront.trim(),
      back: editBack.trim(),
      updatedAt: Date.now(),
    };
    await onSaveCard(updated);
    setEditingCard(null);
  };

  return (
    <div className="container cards-container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Primary Cards Tabs Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--border-subtle)',
          marginBottom: '24px',
          paddingBottom: '12px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setActiveTab('review');
              setIsRevealed(false);
            }}
            className={`btn btn-sm ${activeTab === 'review' ? 'btn-primary' : 'btn-secondary'}`}
            id="cards-tab-review"
            style={{ minHeight: '38px', borderRadius: 'var(--radius-full)' }}
          >
            <RotateCcw size={16} />
            <span>Review</span>
            {dueItems.length > 0 && (
              <span
                className="badge badge-coral"
                style={{ fontSize: '0.68rem', padding: '1px 6px', marginLeft: '4px' }}
              >
                {dueItems.length} Due
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('discover');
              setIsDiscoverRevealed(false);
            }}
            className={`btn btn-sm ${activeTab === 'discover' ? 'btn-primary' : 'btn-secondary'}`}
            id="cards-tab-discover"
            style={{ minHeight: '38px', borderRadius: 'var(--radius-full)' }}
          >
            <BookOpen size={16} />
            <span>Discover</span>
            <span
              className="badge badge-teal"
              style={{ fontSize: '0.68rem', padding: '1px 6px', marginLeft: '4px' }}
            >
              {filteredDiscoverCards.length}
            </span>
          </button>
        </div>

        {/* Create Personal Card Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-secondary btn-sm"
          id="cards-create-new-btn"
        >
          <PlusCircle size={15} />
          <span>New Personal Card</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION A: REVIEW QUEUE                                  */}
      {/* ======================================================== */}
      {activeTab === 'review' && (
        <div>
          {dueItems.length === 0 ? (
            /* Honest Empty State for Review */
            <div
              className="card-notebook"
              style={{
                padding: '44px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)',
                maxWidth: '620px',
                margin: '32px auto',
              }}
            >
              <TytoMascot state="resting" size={130} quietMode={settings.quietMode} />
              <h2 style={{ fontSize: '1.4rem', marginTop: '16px', color: 'var(--text-ink)' }}>
                Review Queue is Clear!
              </h2>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.92rem',
                  maxWidth: '460px',
                  margin: '8px auto 20px',
                  lineHeight: 1.5,
                }}
              >
                All due question reviews and cards are up to date. You can explore new clinical
                concepts in the <strong>Discover</strong> tab or start a practice sprint.
              </p>
              <button
                onClick={() => {
                  setActiveTab('discover');
                  setIsDiscoverRevealed(false);
                }}
                className="btn btn-primary"
                id="empty-review-explore-btn"
              >
                <BookOpen size={16} />
                <span>Explore Discover Concepts</span>
              </button>
            </div>
          ) : currentItem ? (
            /* Active Due Review Card Interface */
            <div style={{ maxWidth: '780px', margin: '0 auto' }}>
              {/* Review Queue Progress & Quick Retry Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-teal">
                    Card {currentReviewIdx + 1} of {dueItems.length}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    • {currentItem.topic}
                  </span>
                </div>

                {/* Question Retry Option */}
                {currentItem.itemType === 'question' && currentItem.sourceQuestionId && onRetryQuestion && (
                  <button
                    onClick={() => onRetryQuestion(currentItem.sourceQuestionId!)}
                    className="btn btn-secondary btn-sm"
                    title="Retry this question in the active player"
                    id="review-retry-question-btn"
                  >
                    <RotateCw size={14} />
                    <span>Retry Question</span>
                  </button>
                )}
              </div>

              {/* Card Container */}
              <div
                className="card-notebook"
                style={{
                  padding: '28px',
                  backgroundColor: '#FFFFFF',
                  boxShadow: 'var(--card-shadow)',
                  border: '1px solid rgba(15, 118, 110, 0.16)',
                }}
              >
                {/* 1. QUESTION-DERIVED CARD */}
                {currentItem.itemType === 'question' && currentItem.questionSnapshot && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      <span className="badge badge-teal">Question Vignette</span>
                      {currentItem.confidence && (
                        <span className="badge badge-gold">
                          Previous Confidence: {currentItem.confidence}
                        </span>
                      )}
                      {currentItem.sourceKind === 'demo' && (
                        <span className="badge badge-mint">Demo Item</span>
                      )}
                    </div>

                    {/* Vignette Text */}
                    <div style={{ fontSize: '1.02rem', lineHeight: 1.65, color: 'var(--text-ink)', marginBottom: '20px', whiteSpace: 'pre-line' }}>
                      {currentItem.questionSnapshot.vignette}
                    </div>

                    {/* Vignette Diagram (if exists) */}
                    {(currentItem.questionSnapshot.questionMedia || currentItem.questionSnapshot.imageMetadata) && (
                      <EducationalDiagram
                        media={
                          currentItem.questionSnapshot.questionMedia || {
                            url: currentItem.questionSnapshot.imageMetadata?.url,
                            alt: currentItem.questionSnapshot.imageMetadata?.alt || 'Scenario diagram',
                            caption: currentItem.questionSnapshot.imageMetadata?.caption,
                            provenance: currentItem.questionSnapshot.imageMetadata?.provenance
                              ? { source: currentItem.questionSnapshot.imageMetadata.provenance }
                              : undefined,
                          }
                        }
                        mode="vignette"
                      />
                    )}

                    {/* Options (Unrevealed: options are listed, but correct answer is HIDDEN) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}>
                      {currentItem.questionSnapshot.options.map((opt) => {
                        const isUserChoice = currentItem.submittedOptionId === opt.id;
                        const isCorrectOption = currentItem.questionSnapshot?.correctOptionId === opt.id;

                        let bg = 'var(--bg-canvas)';
                        let border = '1px solid var(--border-subtle)';
                        if (isRevealed) {
                          if (isCorrectOption) {
                            bg = '#F0FDF4';
                            border = '1.5px solid var(--mint)';
                          } else if (isUserChoice) {
                            bg = '#FFF1F2';
                            border = '1.5px solid var(--coral)';
                          }
                        }

                        return (
                          <div
                            key={opt.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: bg,
                              border,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.92rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <strong style={{ color: 'var(--primary-teal)' }}>{opt.id}.</strong>
                              <span>{opt.text}</span>
                            </div>

                            {isRevealed && (
                              <div>
                                {isCorrectOption && (
                                  <span style={{ color: 'var(--mint)', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={16} />
                                    <span>Correct</span>
                                  </span>
                                )}
                                {!isCorrectOption && isUserChoice && (
                                  <span style={{ color: 'var(--coral)', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <XCircle size={16} />
                                    <span>Your Choice</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* REVEAL CONTROL (Does NOT mark mastery) */}
                    {!isRevealed ? (
                      <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <button
                          type="button"
                          onClick={() => setIsRevealed(true)}
                          className="btn btn-primary"
                          id="review-reveal-answer-btn"
                          style={{ minWidth: '220px' }}
                        >
                          <Eye size={17} />
                          <span>Reveal Answer & Explanation</span>
                        </button>
                      </div>
                    ) : (
                      /* Revealed Comprehensive Educational Rationale */
                      <div
                        style={{
                          marginTop: '24px',
                          paddingTop: '20px',
                          borderTop: '2px dashed var(--border-subtle)',
                        }}
                      >
                        <div style={{ marginBottom: '16px' }}>
                          <span className="badge badge-teal" style={{ marginBottom: '6px' }}>
                            Authored Educational Rationale
                          </span>
                          <p style={{ fontSize: '0.96rem', lineHeight: 1.6, color: 'var(--text-ink)' }}>
                            {currentItem.questionSnapshot.explanation}
                          </p>
                        </div>

                        {/* High Yield Key Takeaway */}
                        <div
                          style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--teal-50)',
                            border: '1px solid rgba(15, 118, 110, 0.25)',
                            borderRadius: 'var(--radius-sm)',
                            marginBottom: '16px',
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-teal)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Check size={14} />
                            <span>Key High-Yield Takeaway</span>
                          </div>
                          <div style={{ fontSize: '0.92rem', color: 'var(--text-ink)', fontWeight: 600 }}>
                            {currentItem.questionSnapshot.keyTakeaway}
                          </div>
                        </div>

                        {/* Explanation Media (revealed only now!) */}
                        {currentItem.questionSnapshot.explanationMedia && (
                          <EducationalDiagram
                            media={currentItem.questionSnapshot.explanationMedia}
                            mode="explanation"
                            isRevealed={true}
                          />
                        )}

                        {/* References */}
                        {currentItem.questionSnapshot.references && currentItem.questionSnapshot.references.length > 0 && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                            <strong>References: </strong>
                            {currentItem.questionSnapshot.references.join('; ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. PERSONAL FLASHCARD */}
                {currentItem.itemType === 'personal' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span className="badge badge-teal">Personal Note</span>
                      <button
                        type="button"
                        onClick={() => {
                          const fc = flashcards.find((f) => f.id === currentItem.flashcardId);
                          if (fc) {
                            setEditingCard(fc);
                            setEditFront(fc.front);
                            setEditBack(fc.back);
                          }
                        }}
                        className="btn btn-sm btn-outline"
                        style={{ minHeight: '28px', padding: '2px 8px' }}
                      >
                        <Edit2 size={13} />
                        <span>Edit Card</span>
                      </button>
                    </div>

                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-ink)', marginBottom: '24px', lineHeight: 1.6 }}>
                      {currentItem.front}
                    </div>

                    {!isRevealed ? (
                      <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <button
                          type="button"
                          onClick={() => setIsRevealed(true)}
                          className="btn btn-primary"
                          id="review-reveal-personal-btn"
                          style={{ minWidth: '200px' }}
                        >
                          <Eye size={16} />
                          <span>Reveal Answer</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: '20px',
                          paddingTop: '18px',
                          borderTop: '2px dashed var(--border-subtle)',
                          fontSize: '1rem',
                          lineHeight: 1.6,
                          color: 'var(--text-ink)',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {currentItem.back}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. DISCOVER-DERIVED CARD */}
                {currentItem.itemType === 'discover' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <span className="badge badge-teal">Discover Concept</span>
                      <span className="badge badge-mint">{currentItem.topic}</span>
                    </div>

                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-ink)', marginBottom: '20px', lineHeight: 1.5 }}>
                      {currentItem.curiosityPrompt}
                    </div>

                    {!isRevealed ? (
                      <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <button
                          type="button"
                          onClick={() => setIsRevealed(true)}
                          className="btn btn-primary"
                          id="review-reveal-discover-btn"
                          style={{ minWidth: '200px' }}
                        >
                          <Eye size={16} />
                          <span>Reveal Principle</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: '20px',
                          paddingTop: '18px',
                          borderTop: '2px dashed var(--border-subtle)',
                        }}
                      >
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--primary-teal)' }}>
                          {currentItem.revealedConcept}
                        </h3>
                        <p style={{ fontSize: '0.96rem', lineHeight: 1.6, color: 'var(--text-ink)', marginBottom: '14px' }}>
                          {currentItem.conciseExplanation}
                        </p>
                        {currentItem.whyItMatters && (
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: 'var(--bg-canvas)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.88rem',
                              marginBottom: '14px',
                            }}
                          >
                            <strong>Clinical Importance: </strong>
                            {currentItem.whyItMatters}
                          </div>
                        )}
                        {currentItem.diagram && (
                          <EducationalDiagram media={currentItem.diagram} mode="vignette" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating Controls (Plain labels: Again, Hard, Remembered) */}
                {isRevealed && (
                  <div
                    style={{
                      marginTop: '28px',
                      paddingTop: '18px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      How well did you recall this concept?
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleRate('again')}
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#FFF1F2',
                          color: '#BE123C',
                          border: '1px solid #FDA4AF',
                        }}
                        id="rate-again-btn"
                      >
                        <span>Again (1d)</span>
                      </button>

                      <button
                        onClick={() => handleRate('hard')}
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          border: '1px solid #FCD34D',
                        }}
                        id="rate-hard-btn"
                      >
                        <span>Hard</span>
                      </button>

                      <button
                        onClick={() => handleRate('remembered')}
                        className="btn btn-sm btn-primary"
                        id="rate-remembered-btn"
                      >
                        <span>Remembered</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Prev / Next Queue Jumper */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                }}
              >
                <button
                  onClick={() => {
                    setIsRevealed(false);
                    setCurrentReviewIdx(Math.max(0, currentReviewIdx - 1));
                  }}
                  disabled={currentReviewIdx === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ opacity: currentReviewIdx === 0 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => {
                    setIsRevealed(false);
                    setCurrentReviewIdx(Math.min(dueItems.length - 1, currentReviewIdx + 1));
                  }}
                  disabled={currentReviewIdx >= dueItems.length - 1}
                  className="btn btn-secondary btn-sm"
                  style={{ opacity: currentReviewIdx >= dueItems.length - 1 ? 0.4 : 1 }}
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION B: DISCOVER CONCEPTS                             */}
      {/* ======================================================== */}
      {activeTab === 'discover' && (
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          {/* Section Description */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--text-ink)', marginBottom: '4px' }}>
              Discover High-Yield Concepts
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Author-curated clinical principles mapped to syllabus topics. Formulate your prediction
              before revealing the rationale.
            </p>
          </div>

          {/* System Filters & Search */}
          <div style={{ marginBottom: '20px' }}>
            {/* Content Kind Filters */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setDiscoverKindFilter('all');
                  setDiscoverIndex(0);
                  setIsDiscoverRevealed(false);
                  setIsBatchCompleted(false);
                }}
                className={`btn btn-sm ${discoverKindFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '3px 10px', minHeight: '28px' }}
                id="discover-filter-all"
              >
                All Content
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscoverKindFilter('educational');
                  setDiscoverIndex(0);
                  setIsDiscoverRevealed(false);
                  setIsBatchCompleted(false);
                }}
                className={`btn btn-sm ${discoverKindFilter === 'educational' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '3px 10px', minHeight: '28px' }}
                id="discover-filter-educational"
              >
                Educational Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscoverKindFilter('demo');
                  setDiscoverIndex(0);
                  setIsDiscoverRevealed(false);
                  setIsBatchCompleted(false);
                }}
                className={`btn btn-sm ${discoverKindFilter === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '3px 10px', minHeight: '28px' }}
                id="discover-filter-demo"
              >
                Demo Fixtures
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setDiscoverSystemFilter('all');
                    setDiscoverIndex(0);
                    setIsDiscoverRevealed(false);
                    setIsBatchCompleted(false);
                  }}
                  className={`btn btn-sm ${discoverSystemFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '4px 12px', minHeight: '32px' }}
                >
                  All Systems
                </button>
                {discoverSystems.map((sys) => (
                  <button
                    key={sys}
                    onClick={() => {
                      setDiscoverSystemFilter(sys);
                      setDiscoverIndex(0);
                      setIsDiscoverRevealed(false);
                      setIsBatchCompleted(false);
                    }}
                    className={`btn btn-sm ${discoverSystemFilter === sys ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '4px 12px', minHeight: '32px' }}
                  >
                    {sys}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '220px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  value={discoverSearch}
                  onChange={(e) => {
                    setDiscoverSearch(e.target.value);
                    setDiscoverIndex(0);
                    setIsDiscoverRevealed(false);
                    setIsBatchCompleted(false);
                  }}
                  placeholder="Search concepts..."
                  className="input-field"
                  style={{ paddingLeft: '32px', fontSize: '0.85rem', height: '36px' }}
                />
              </div>
            </div>
          </div>

          {/* Empty State for Filtered Syllabus */}
          {filteredDiscoverCards.length === 0 ? (
            <div
              className="card-notebook"
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)',
                border: '1px dashed var(--border-subtle)',
              }}
              id="discover-empty-state"
            >
              <TytoMascot state="thinking" size={100} quietMode={settings.quietMode} />
              <h3 style={{ fontSize: '1.2rem', marginTop: '14px', color: 'var(--text-ink)' }}>
                No Approved Concepts in This Area
              </h3>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  maxWidth: '440px',
                  margin: '8px auto 0',
                  lineHeight: 1.5,
                }}
              >
                Medical knowledge authoring will be supplied by verified clinical educators. Empty
                syllabus areas remain honest and are not populated with AI-generated medical claims.
              </p>
            </div>
          ) : isBatchCompleted ? (
            /* Clear Finite Batch Finish State */
            <div
              className="card-notebook"
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)',
                border: '2px solid var(--primary-teal)',
                boxShadow: 'var(--card-shadow)',
              }}
              id="discover-batch-completed-card"
            >
              <TytoMascot state="celebrating" size={110} quietMode={settings.quietMode} />
              <h3 style={{ fontSize: '1.35rem', marginTop: '16px', color: 'var(--text-ink)' }}>
                Batch Complete! ({filteredDiscoverCards.length} Concepts Explored)
              </h3>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  maxWidth: '460px',
                  margin: '8px auto 20px',
                  lineHeight: 1.5,
                }}
              >
                You've reached the end of this finite study batch. Remember that browsing Discover
                does not count as completed recall—saved items will appear in your Review Queue for active testing.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchCompleted(false);
                    setDiscoverIndex(0);
                    setIsDiscoverRevealed(false);
                  }}
                  className="btn btn-secondary"
                  id="discover-restart-batch-btn"
                >
                  <RotateCcw size={15} />
                  <span>Restart Batch</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('review');
                    setIsRevealed(false);
                  }}
                  className="btn btn-primary"
                  id="discover-go-to-review-btn"
                >
                  <RotateCw size={15} />
                  <span>Go to Review Queue</span>
                </button>
              </div>
            </div>
          ) : currentDiscoverCard ? (
            /* Finite Batch Discover Card */
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <span className="badge badge-teal">
                  Concept {discoverIndex + 1} of {filteredDiscoverCards.length}
                </span>

                {currentDiscoverCard.contentKind === 'demo' && (
                  <span className="badge badge-mint">Educational Demo Fixture</span>
                )}
              </div>

              {/* Card Container */}
              <div
                className="card-notebook"
                style={{
                  padding: '30px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(15, 118, 110, 0.16)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                {/* Curriculum & Tags */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span className="badge badge-teal">
                    {currentDiscoverCard.curriculumMapping.system}
                  </span>
                  <span className="badge badge-mint">
                    {currentDiscoverCard.curriculumMapping.topic}
                  </span>
                </div>

                {/* Curiosity / Prediction Prompt */}
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-ink)', lineHeight: 1.5, marginBottom: '24px' }}>
                  {currentDiscoverCard.curiosityPrompt}
                </div>

                {/* Tap to Reveal Principle */}
                {!isDiscoverRevealed ? (
                  <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                      type="button"
                      onClick={() => setIsDiscoverRevealed(true)}
                      className="btn btn-primary btn-lg"
                      id="discover-reveal-concept-btn"
                      style={{ minWidth: '220px' }}
                    >
                      <Eye size={18} />
                      <span>Reveal Principle</span>
                    </button>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      (Browsing Discover does not count as completed recall)
                    </div>
                  </div>
                ) : (
                  /* Revealed Principle Details */
                  <div
                    style={{
                      marginTop: '20px',
                      paddingTop: '20px',
                      borderTop: '2px dashed var(--border-subtle)',
                    }}
                  >
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--primary-teal)', marginBottom: '10px' }}>
                      {currentDiscoverCard.revealedConcept}
                    </h3>

                    <p style={{ fontSize: '0.98rem', lineHeight: 1.65, color: 'var(--text-ink)', marginBottom: '16px' }}>
                      {currentDiscoverCard.conciseExplanation}
                    </p>

                    {/* Why It Matters */}
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-canvas)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: '16px',
                      }}
                    >
                      <strong style={{ color: 'var(--text-ink)' }}>Why it matters for Step 1: </strong>
                      <span style={{ color: 'var(--text-ink)', fontSize: '0.92rem' }}>
                        {currentDiscoverCard.whyItMatters}
                      </span>
                    </div>

                    {/* Relevant Diagram (if attached) */}
                    {currentDiscoverCard.diagram && (
                      <EducationalDiagram media={currentDiscoverCard.diagram} mode="vignette" />
                    )}

                    {/* Source Citation */}
                    {currentDiscoverCard.sourceReference && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
                        Citation: {currentDiscoverCard.sourceReference.source}{' '}
                        {currentDiscoverCard.sourceReference.edition ? `(${currentDiscoverCard.sourceReference.edition})` : ''}{' '}
                        {currentDiscoverCard.sourceReference.page ? `• ${currentDiscoverCard.sourceReference.page}` : ''}
                      </div>
                    )}

                    {/* Actions: Save to Review */}
                    <div
                      style={{
                        marginTop: '24px',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div>
                        {discoverNotice && discoverNotice.id === currentDiscoverCard.id && (
                          <span
                            className={`badge ${
                              discoverNotice.result.status === 'saved'
                                ? 'badge-teal'
                                : discoverNotice.result.status === 'already_saved'
                                ? 'badge-gold'
                                : 'badge-coral'
                            }`}
                            style={{ fontSize: '0.8rem' }}
                          >
                            {discoverNotice.result.status === 'saved' ? <CheckCheck size={13} /> : null}
                            <span>{discoverNotice.result.message}</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveDiscover(currentDiscoverCard)}
                        className="btn btn-secondary btn-sm"
                        id="discover-save-to-review-btn"
                      >
                        <Bookmark size={15} />
                        <span>Save to Review</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Finite Batch Navigator */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                }}
              >
                <button
                  onClick={() => {
                    setIsDiscoverRevealed(false);
                    setDiscoverIndex(Math.max(0, discoverIndex - 1));
                  }}
                  disabled={discoverIndex === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ opacity: discoverIndex === 0 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous Concept</span>
                </button>

                {discoverIndex < filteredDiscoverCards.length - 1 ? (
                  <button
                    onClick={() => {
                      setIsDiscoverRevealed(false);
                      setDiscoverIndex(discoverIndex + 1);
                    }}
                    className="btn btn-secondary btn-sm"
                    id="discover-next-btn"
                  >
                    <span>Next Concept</span>
                    <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsBatchCompleted(true)}
                    className="btn btn-primary btn-sm"
                    id="discover-finish-batch-btn"
                  >
                    <CheckCircle2 size={15} />
                    <span>Finish Batch ({filteredDiscoverCards.length} Concepts)</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT PERSONAL CARD                                */}
      {/* ======================================================== */}
      {editingCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Personal Flashcard"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card-notebook"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '24px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '14px', color: 'var(--text-ink)' }}>
              Edit Personal Card
            </h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Front (Prompt)
                </label>
                <textarea
                  value={editFront}
                  onChange={(e) => setEditFront(e.target.value)}
                  className="input-field"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Back (Explanation)
                </label>
                <textarea
                  value={editBack}
                  onChange={(e) => setEditBack(e.target.value)}
                  className="input-field"
                  rows={4}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREATE NEW PERSONAL CARD                          */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create New Personal Flashcard"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card-notebook"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', marginBottom: '6px', color: 'var(--text-ink)' }}>
              Create Personal Flashcard
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Author your own high-yield recall prompt. Saved cards enter your personal review queue.
            </p>

            {createError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 'var(--radius-sm)',
                  color: '#991B1B',
                  fontSize: '0.82rem',
                  marginBottom: '12px',
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Topic Tag
                </label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Renal Pharmacology"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Front (Question / Prompt)
                </label>
                <textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="e.g. Mechanism of action of Loop Diuretics?"
                  className="input-field"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Back (Answer / Clinical Key)
                </label>
                <textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="e.g. Inhibits Na+/K+/2Cl- symporter in thick ascending limb of loop of Henle."
                  className="input-field"
                  rows={4}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="create-reverse-card-check"
                  checked={createReverseCard}
                  onChange={(e) => setCreateReverseCard(e.target.checked)}
                />
                <label htmlFor="create-reverse-card-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Also generate reversed card (Back as prompt)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCard}
                  className="btn btn-primary btn-sm"
                  id="submit-create-card-btn"
                >
                  {isSavingCard ? 'Saving...' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
