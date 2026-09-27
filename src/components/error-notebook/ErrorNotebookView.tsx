import React, { useState } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { ClipMascot } from '../mascot/ClipMascot';
import type { ErrorNotebookEntry, ErrorCause, UserSettings } from '../../domain/types';
import {
  FileText,
  Search,
  Filter,
  Trash2,
  Edit3,
  Layers,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ErrorNotebookViewProps {
  entries: ErrorNotebookEntry[];
  settings: UserSettings;
  onSaveEntry: (entry: ErrorNotebookEntry) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onCreateFlashcardFromEntry: (front: string, back: string, topic: string) => void;
  onJumpToQuestionReview: (entry: ErrorNotebookEntry) => void;
}

const ERROR_CAUSES: { id: ErrorCause; label: string; badgeClass: string }[] = [
  { id: 'knowledge_gap', label: 'Knowledge Gap', badgeClass: 'badge-coral' },
  { id: 'reasoning_mistake', label: 'Reasoning Mistake', badgeClass: 'badge-demo' },
  { id: 'misread_question', label: 'Misread Question', badgeClass: 'badge-teal' },
  { id: 'time_pressure', label: 'Time Pressure', badgeClass: 'badge-demo' },
  { id: 'other', label: 'Other Cause', badgeClass: 'badge-mint' },
];

export const ErrorNotebookView: React.FC<ErrorNotebookViewProps> = ({
  entries,
  settings,
  onSaveEntry,
  onDeleteEntry,
  onCreateFlashcardFromEntry,
  onJumpToQuestionReview,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCause, setSelectedCause] = useState<string>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ErrorNotebookEntry | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    if (selectedCause !== 'all' && entry.cause !== selectedCause) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const topic = entry.questionSnapshot?.topic?.toLowerCase() || '';
      const notes = entry.studentNotes?.toLowerCase() || '';
      const takeaway = entry.personalTakeaway?.toLowerCase() || '';
      const vignette = entry.questionSnapshot?.vignette?.toLowerCase() || '';
      if (!topic.includes(q) && !notes.includes(q) && !takeaway.includes(q) && !vignette.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    await onSaveEntry({
      ...editingEntry,
      updatedAt: Date.now(),
    });
    setEditingEntry(null);
    setNotification('Entry updated successfully.');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleMakeFlashcard = (entry: ErrorNotebookEntry) => {
    const front = `High-Yield Concept: ${entry.questionSnapshot.topic}\n\nWhat was the key reasoning principle?`;
    const back = entry.personalTakeaway || entry.questionSnapshot.keyTakeaway || entry.studentNotes;
    onCreateFlashcardFromEntry(front, back, entry.questionSnapshot.topic);
    setNotification('Flashcard created from takeaway!');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '16px', marginBottom: '24px' }}>
        <div>
          <span className="badge badge-coral" style={{ marginBottom: '4px' }}>Metacognitive Journal</span>
          <h1 style={{ fontSize: '1.85rem' }}>Error Notebook</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Document why questions were missed. Causes and takeaways are student-selected, not automated diagnoses.
          </p>
        </div>

        <ClipMascot
          pose="focus"
          size={95}
          speechBubble={settings.quietMode ? undefined : 'Every error analyzed is a mark earned on exam day!'}
          quietMode={settings.quietMode}
        />
      </div>

      {notification && (
        <div
          className="card-notebook"
          style={{
            padding: '12px 18px',
            marginBottom: '18px',
            backgroundColor: 'var(--mint-light)',
            borderColor: 'var(--mint)',
            color: 'var(--text-ink)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={18} style={{ color: 'var(--mint)' }} />
          <span>{notification}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div
        className="card-notebook"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 260px' }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, topics, or takeaways..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-ink)',
              fontSize: '0.9rem',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-ink)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Cause:</span>
          <select
            value={selectedCause}
            onChange={(e) => setSelectedCause(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-ink)',
              fontSize: '0.88rem',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-ink)',
            }}
          >
            <option value="all">All Causes ({entries.length})</option>
            {ERROR_CAUSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
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
              pose="welcome"
              size={90}
              speechBubble={settings.quietMode ? undefined : 'No error entries match. Clean slate!'}
              quietMode={settings.quietMode}
            />
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>No Error Entries Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto' }}>
            When you miss questions or want to record personal reasoning reflections, log them here from the question player or review screen.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredEntries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            const causeMeta = ERROR_CAUSES.find((c) => c.id === entry.cause) || ERROR_CAUSES[4];
            const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={entry.id}
                className="card-notebook"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '2px solid var(--border-ink)',
                  overflow: 'hidden',
                }}
              >
                {/* Entry Header */}
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    backgroundColor: 'var(--bg-surface)',
                    borderBottom: isExpanded ? '1px solid var(--border-ink)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        border: '2px solid var(--border-ink)',
                        backgroundColor: 'var(--coral-light)',
                        color: 'var(--coral)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileText size={18} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`badge ${causeMeta.badgeClass}`}>{causeMeta.label}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{dateStr}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-ink)' }}>
                        {entry.questionSnapshot.topic}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {entry.questionSnapshot.system} • {entry.questionSnapshot.discipline}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => handleMakeFlashcard(entry)}
                      className="btn btn-secondary btn-sm"
                      title="Convert takeaway to personal flashcard"
                    >
                      <Layers size={14} />
                      <span>Make Flashcard</span>
                    </button>

                    <button
                      onClick={() => setEditingEntry(entry)}
                      className="btn btn-secondary btn-sm"
                      title="Edit note"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => onDeleteEntry(entry.id)}
                      className="btn btn-sm btn-outline"
                      style={{ color: 'var(--coral)', borderColor: 'var(--coral)', padding: '6px 8px' }}
                      title="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>

                    <button
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Question'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Main Takeaway & Student Notes */}
                <div style={{ padding: '16px 20px', backgroundColor: 'var(--bg-canvas)' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--primary-teal)', display: 'block', marginBottom: '4px' }}>
                      Personal High-Yield Takeaway:
                    </strong>
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--mint-light)',
                        border: '1.5px solid var(--mint)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        color: 'var(--text-ink)',
                      }}
                    >
                      {entry.personalTakeaway || 'No personal takeaway recorded yet.'}
                    </div>
                  </div>

                  {entry.studentNotes && (
                    <div>
                      <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Student Reflection / Gap Analysis:
                      </strong>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-ink)', lineHeight: 1.5 }}>
                        {entry.studentNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Expanded Question Snapshot View */}
                {isExpanded && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--border-ink)', backgroundColor: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="badge badge-demo">Question Snapshot (v{entry.questionSnapshot.version})</span>
                      <button
                        onClick={() => onJumpToQuestionReview(entry)}
                        className="btn btn-sm btn-outline"
                      >
                        <ExternalLink size={13} />
                        <span>Launch Review Session</span>
                      </button>
                    </div>

                    <p style={{ fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '16px', whiteSpace: 'pre-line' }}>
                      {entry.questionSnapshot.vignette}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                      {entry.questionSnapshot.options.map((opt) => {
                        const isCorrect = opt.id === entry.questionSnapshot.correctOptionId;
                        const isChosen = opt.id === entry.selectedOptionId;

                        return (
                          <div
                            key={opt.id}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              border: isCorrect
                                ? '2px solid var(--mint)'
                                : isChosen
                                ? '2px solid var(--coral)'
                                : '1px solid var(--border-ink)',
                              backgroundColor: isCorrect
                                ? 'var(--mint-light)'
                                : isChosen
                                ? 'var(--coral-light)'
                                : 'var(--bg-canvas)',
                              fontSize: '0.85rem',
                            }}
                          >
                            <strong>{opt.id}: </strong>
                            <span>{opt.text}</span>
                            {isCorrect && <span style={{ color: 'var(--mint)', fontWeight: 700, marginLeft: '8px' }}>✓ Correct Key</span>}
                            {isChosen && !isCorrect && <span style={{ color: 'var(--coral)', fontWeight: 700, marginLeft: '8px' }}>✗ Your Choice</span>}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <strong>Full Explanation: </strong>
                      {entry.questionSnapshot.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-entry-title"
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
              maxWidth: '560px',
              padding: '24px',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <h3 id="edit-entry-title" style={{ fontSize: '1.25rem', marginBottom: '14px' }}>
              Edit Error Reflection
            </h3>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Self-Identified Cause of Error
                </label>
                <select
                  value={editingEntry.cause}
                  onChange={(e) => setEditingEntry({ ...editingEntry, cause: e.target.value as ErrorCause })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.9rem',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                >
                  {ERROR_CAUSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Personal High-Yield Takeaway
                </label>
                <textarea
                  rows={3}
                  value={editingEntry.personalTakeaway}
                  onChange={(e) => setEditingEntry({ ...editingEntry, personalTakeaway: e.target.value })}
                  placeholder="One sentence rule for your future self..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
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
                  Notes / Detailed Reasoning
                </label>
                <textarea
                  rows={4}
                  value={editingEntry.studentNotes}
                  onChange={(e) => setEditingEntry({ ...editingEntry, studentNotes: e.target.value })}
                  placeholder="What distractor tricked you? What clue did you misread?"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
