import React, { useState } from 'react';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import {
  validateQuestionForApproval,
  dryRunImportQuestions,
  atomicImportQuestions,
  sanitizeText,
} from '../../persistence/indexedDbRepo';
import { DEMO_QUESTIONS } from '../../config/demoQuestions';
import type {
  Question,
  EditorialStatus,
  AuthorDifficulty,
  QuestionReport,
  UserSettings,
} from '../../domain/types';
import {
  BookOpen,
  PlusCircle,
  Archive,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  Inbox,
  Check,
  Edit,
  Copy,
} from 'lucide-react';

interface ContentWorkspaceViewProps {
  questions: Question[];
  reports: QuestionReport[];
  settings: UserSettings;
  onSaveQuestion: (question: Question) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onResolveReport: (reportId: string, note?: string) => Promise<void>;
  onReloadBank: () => Promise<void>;
}

export const ContentWorkspaceView: React.FC<ContentWorkspaceViewProps> = ({
  questions,
  reports,
  settings: _settings,
  onSaveQuestion,
  onDeleteQuestion: _onDeleteQuestion,
  onResolveReport,
  onReloadBank,
}) => {
  const [activeTab, setActiveTab] = useState<'bank' | 'import_export' | 'inbox'>('bank');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ text: string; isError?: boolean } | null>(null);

  // Dry run modal state
  const [dryRunData, setDryRunData] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (statusFilter !== 'all' && q.editorialStatus !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        q.id.toLowerCase().includes(query) ||
        q.topic.toLowerCase().includes(query) ||
        q.system.toLowerCase().includes(query) ||
        (q.conceptId && q.conceptId.toLowerCase().includes(query)) ||
        q.vignette.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const unresolvedReports = reports.filter((r) => !r.resolved);

  // Initialize new question in editor
  const handleStartCreateQuestion = () => {
    setValidationErrors([]);
    setEditingQuestion({
      id: `q-custom-${Date.now().toString().slice(-6)}`,
      version: 1,
      contentKind: 'educational',
      editorialStatus: 'draft',
      exam: 'USMLE Step 1 (Demo Taxonomy)',
      system: 'Cardiovascular (Demo)',
      discipline: 'Physiology (Demo)',
      topic: '',
      conceptId: '',
      learningObjective: '',
      vignette: '',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      correctOptionId: 'A',
      explanation: '',
      optionExplanations: {},
      keyTakeaway: '',
      authorDifficulty: 'Medium',
      reviewer: { name: null, role: null },
      references: [],
      sourceReference: { source: '', edition: '', page: '' },
    });
  };

  // Save question handler
  const handleSaveQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    // Validate if attempting to mark 'approved'
    if (editingQuestion.editorialStatus === 'approved') {
      const val = validateQuestionForApproval(editingQuestion);
      if (!val.isValid) {
        setValidationErrors(val.errors);
        return;
      }
    }

    setValidationErrors([]);

    const toSave: Question = {
      id: sanitizeText(editingQuestion.id) || `q-${Date.now()}`,
      version: (editingQuestion.version || 1),
      contentKind: editingQuestion.contentKind || 'educational',
      editorialStatus: editingQuestion.editorialStatus || 'draft',
      exam: sanitizeText(editingQuestion.exam) || 'USMLE Step 1 (Demo Taxonomy)',
      system: sanitizeText(editingQuestion.system) || 'General (Demo)',
      discipline: sanitizeText(editingQuestion.discipline) || 'General (Demo)',
      topic: sanitizeText(editingQuestion.topic) || 'Untitled Item',
      conceptId: editingQuestion.conceptId ? sanitizeText(editingQuestion.conceptId) : undefined,
      learningObjective: sanitizeText(editingQuestion.learningObjective) || '',
      vignette: sanitizeText(editingQuestion.vignette) || '',
      options: (editingQuestion.options || []).map((o) => ({
        id: sanitizeText(o.id),
        text: sanitizeText(o.text),
      })),
      correctOptionId: sanitizeText(editingQuestion.correctOptionId) || 'A',
      explanation: sanitizeText(editingQuestion.explanation) || '',
      optionExplanations: editingQuestion.optionExplanations || {},
      keyTakeaway: sanitizeText(editingQuestion.keyTakeaway) || '',
      authorDifficulty: editingQuestion.authorDifficulty,
      reviewer: {
        name: editingQuestion.reviewer?.name ? sanitizeText(editingQuestion.reviewer.name) : null,
        role: editingQuestion.reviewer?.role ? sanitizeText(editingQuestion.reviewer.role) : null,
      },
      reviewDate: editingQuestion.reviewDate ? sanitizeText(editingQuestion.reviewDate) : undefined,
      references: editingQuestion.references?.map(sanitizeText),
      sourceReference: editingQuestion.sourceReference,
      updatedAt: Date.now(),
    };

    await onSaveQuestion(toSave);
    setEditingQuestion(null);
    setNotification({ text: `Question ${toSave.id} saved successfully (${toSave.editorialStatus}).` });
    setTimeout(() => setNotification(null), 3000);
  };

  // Version a question (increment version, keep ID, set to draft)
  const handleVersionQuestion = (q: Question) => {
    setValidationErrors([]);
    setEditingQuestion({
      ...q,
      version: q.version + 1,
      editorialStatus: 'draft',
      updatedAt: Date.now(),
    });
  };

  // Archive question
  const handleArchiveQuestion = async (q: Question) => {
    const updated: Question = { ...q, editorialStatus: 'archived', updatedAt: Date.now() };
    await onSaveQuestion(updated);
    setNotification({ text: `Question ${q.id} archived. It will not leak into practice sessions.` });
    setTimeout(() => setNotification(null), 3000);
  };

  // Download Sample Demo Bank JSON
  const handleDownloadSampleDemoBank = () => {
    const json = JSON.stringify(DEMO_QUESTIONS, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wardwit-sample-demo-bank.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export full bank
  const handleExportBank = () => {
    const json = JSON.stringify(questions, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wardwit-full-question-bank-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Dry run import file handler
  const handleFileForDryRun = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = dryRunImportQuestions(text, questions);
      if (!res.success) {
        setNotification({ text: res.error || 'Failed to parse JSON file.', isError: true });
      } else {
        setDryRunData(res.summary);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Commit atomic import
  const handleCommitAtomicImport = async () => {
    if (!dryRunData || dryRunData.cleanQuestions.length === 0) return;
    setIsImporting(true);
    const res = await atomicImportQuestions(dryRunData.cleanQuestions);
    setIsImporting(false);

    if (res.success) {
      setDryRunData(null);
      await onReloadBank();
      setNotification({ text: res.message });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setNotification({ text: res.message, isError: true });
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '60px', paddingTop: '20px' }}>
      <DisclaimerBanner className="mb-4" />

      {/* Mandatory Scope Banner */}
      <div
        className="card-notebook"
        style={{
          marginTop: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--marigold-light)',
          borderColor: 'var(--marigold)',
          color: 'var(--text-ink)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <AlertTriangle size={24} style={{ color: 'var(--marigold)', flexShrink: 0 }} />
        <div>
          <strong>Local Content Workspace — browser-only; not a secured multi-user admin system.</strong>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            A selected approval status records the author's assertion; software does not verify medical competence. All items and edits reside strictly in your browser's IndexedDB.
          </div>
        </div>
      </div>

      {notification && (
        <div
          className="card-notebook"
          style={{
            marginTop: '14px',
            padding: '12px 18px',
            backgroundColor: notification.isError ? 'var(--coral-light)' : 'var(--mint-light)',
            borderColor: notification.isError ? 'var(--coral)' : 'var(--mint)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {notification.isError ? <AlertTriangle size={18} style={{ color: 'var(--coral)' }} /> : <CheckCircle size={18} style={{ color: 'var(--mint)' }} />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('bank')}
            className={`btn btn-sm ${activeTab === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <BookOpen size={14} />
            <span>Question Bank ({questions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('import_export')}
            className={`btn btn-sm ${activeTab === 'import_export' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Upload size={14} />
            <span>Import / Export & Dry-Run</span>
          </button>

          <button
            onClick={() => setActiveTab('inbox')}
            className={`btn btn-sm ${activeTab === 'inbox' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Inbox size={14} />
            <span>Student Reports Inbox ({unresolvedReports.length})</span>
          </button>
        </div>

        {activeTab === 'bank' && (
          <button
            onClick={handleStartCreateQuestion}
            className="btn btn-primary btn-sm"
          >
            <PlusCircle size={15} />
            <span>Create Question</span>
          </button>
        )}
      </div>

      {/* TAB 1: QUESTION BANK */}
      {activeTab === 'bank' && (
        <div>
          {/* Search & Filter */}
          <div
            className="card-notebook"
            style={{
              padding: '14px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 260px' }}>
              <Search size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, topic, concept, system, vignette..."
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--border-ink)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="all">All Statuses ({questions.length})</option>
                <option value="approved">Approved Only</option>
                <option value="draft">Drafts Only</option>
                <option value="in_review">In Review Only</option>
                <option value="archived">Archived Only</option>
              </select>
            </div>
          </div>

          {/* Questions Table */}
          <div className="card-notebook" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-ink)', backgroundColor: 'var(--bg-canvas)' }}>
                    <th style={{ padding: '12px 14px' }}>Item ID</th>
                    <th style={{ padding: '12px 14px' }}>Topic & System</th>
                    <th style={{ padding: '12px 14px' }}>Concept ID</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q) => {
                    let statusBadge = <span className="badge badge-mint">Approved</span>;
                    if (q.editorialStatus === 'draft') {
                      statusBadge = <span className="badge badge-demo">Draft</span>;
                    } else if (q.editorialStatus === 'in_review') {
                      statusBadge = <span className="badge badge-coral">In Review</span>;
                    } else if (q.editorialStatus === 'archived') {
                      statusBadge = <span className="badge" style={{ backgroundColor: '#CCC' }}>Archived</span>;
                    }

                    return (
                      <tr key={q.id} style={{ borderBottom: '1px solid var(--bg-surface-alt)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                          <code>{q.id}</code> (v{q.version})
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{q.topic}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {q.system} • {q.discipline}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {q.conceptId ? <code>{q.conceptId}</code> : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>{statusBadge}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setValidationErrors([]);
                                setEditingQuestion({ ...q });
                              }}
                              className="btn btn-sm btn-secondary"
                              title="Edit item"
                            >
                              <Edit size={13} />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handleVersionQuestion(q)}
                              className="btn btn-sm btn-outline"
                              title="Create next version as draft"
                            >
                              <Copy size={13} />
                              <span>v+1</span>
                            </button>

                            {q.editorialStatus !== 'archived' && (
                              <button
                                onClick={() => handleArchiveQuestion(q)}
                                className="btn btn-sm btn-outline"
                                style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
                                title="Archive item"
                              >
                                <Archive size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT / EXPORT & DRY RUN */}
      {activeTab === 'import_export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card-notebook" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>JSON Question Schema & Sample Bank</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Questions are exported and imported as structured JSON documents conforming to WardWit question schema.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button
                onClick={handleDownloadSampleDemoBank}
                className="btn btn-secondary"
                id="download-demo-bank-btn"
              >
                <Download size={16} />
                <span>Download Sample Demo Bank (.json)</span>
              </button>

              <button
                onClick={handleExportBank}
                className="btn btn-secondary"
                id="export-bank-btn"
              >
                <Download size={16} />
                <span>Export Entire Local Bank (.json)</span>
              </button>

              <button
                onClick={() => {
                  const report = dryRunImportQuestions(DEMO_QUESTIONS, questions);
                  setDryRunData(report);
                  setNotification({ text: `Dry-run preview generated for ${report.totalRows} sample demo questions.` });
                }}
                className="btn btn-secondary"
                id="dry-run-demo-btn"
              >
                <CheckCircle size={16} />
                <span>Preview Demo Bank Dry-Run</span>
              </button>

              <label className="btn btn-primary" style={{ cursor: 'pointer' }} id="upload-json-btn">
                <Upload size={16} />
                <span>Upload JSON for Dry-Run Preview</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileForDryRun}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* DRY RUN PREVIEW MODAL / PANEL */}
          {dryRunData && (
            <div className="card-notebook" style={{ padding: '24px', backgroundColor: 'var(--bg-canvas)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <span className="badge badge-teal" style={{ marginBottom: '4px' }}>Dry-Run Validation Report</span>
                  <h3 style={{ fontSize: '1.3rem' }}>Import Inspection Summary</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Review issues below before committing. No data has been saved to IndexedDB yet.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setDryRunData(null)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitAtomicImport}
                    disabled={isImporting || dryRunData.cleanQuestions.length === 0}
                    className="btn btn-primary btn-sm"
                  >
                    <Check size={14} />
                    <span>{isImporting ? 'Importing...' : `Import ${dryRunData.cleanQuestions.length} Valid Items`}</span>
                  </button>
                </div>
              </div>

              {/* Stats badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div className="badge badge-teal" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  Total Rows: {dryRunData.totalRows}
                </div>
                <div className="badge badge-mint" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  Valid: {dryRunData.validCount}
                </div>
                <div className="badge badge-coral" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  Invalid / Rejected: {dryRunData.invalidCount}
                </div>
                <div className="badge badge-demo" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  Updates: {dryRunData.proposedUpdates.length}
                </div>
                <div className="badge badge-teal" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  New Inserts: {dryRunData.proposedInserts.length}
                </div>
              </div>

              {/* Duplicate check */}
              {dryRunData.duplicatesInFile.length > 0 && (
                <div style={{ backgroundColor: 'var(--coral-light)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--coral)', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <strong>Duplicate IDs Detected in File:</strong> {dryRunData.duplicatesInFile.join(', ')}
                </div>
              )}

              {/* Rows List */}
              <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dryRunData.rowResults.map((row: any) => (
                  <div
                    key={row.rowNumber}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: row.isValid ? 'var(--bg-surface)' : 'var(--coral-light)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-ink)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <strong>Row {row.rowNumber} [<code>{row.id}</code>]: </strong>
                      <span>{row.topic}</span>
                      {row.isUpdate && <span className="badge badge-demo" style={{ marginLeft: '6px' }}>Update</span>}
                      {row.errors.length > 0 && (
                        <div style={{ color: 'var(--coral)', fontSize: '0.78rem', marginTop: '2px' }}>
                          Errors: {row.errors.join('; ')}
                        </div>
                      )}
                    </div>
                    <div>
                      {row.isValid ? (
                        <span style={{ color: 'var(--mint)', fontWeight: 700 }}>✓ Ready</span>
                      ) : (
                        <span style={{ color: 'var(--coral)', fontWeight: 700 }}>✗ Rejected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STUDENT REPORTS INBOX */}
      {activeTab === 'inbox' && (
        <div className="card-notebook" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem' }}>Local Student Reports Inbox</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Reports flagged by students during study sessions. These are stored locally in your browser.
              </p>
            </div>
            <span className="badge badge-coral">{unresolvedReports.length} Unresolved</span>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              No question reports logged yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map((rep) => {
                const targetQ = questions.find((q) => q.id === rep.questionId);
                return (
                  <div
                    key={rep.id}
                    className="card-notebook"
                    style={{
                      padding: '16px',
                      backgroundColor: rep.resolved ? 'var(--bg-canvas)' : 'var(--coral-light)',
                      border: `1.5px solid ${rep.resolved ? 'var(--border-ink)' : 'var(--coral)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span className="badge badge-demo" style={{ textTransform: 'uppercase' }}>
                          {rep.issueType.replace('_', ' ')}
                        </span>
                        <span style={{ marginLeft: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                          Question ID: <code>{rep.questionId}</code> (v{rep.questionVersion})
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(rep.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.88rem', margin: '8px 0', color: 'var(--text-ink)' }}>
                      <strong>Student Comment:</strong> {rep.comment || 'No comment provided.'}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      {targetQ && (
                        <button
                          onClick={() => {
                            setValidationErrors([]);
                            setEditingQuestion({ ...targetQ });
                            setActiveTab('bank');
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          <Edit size={13} />
                          <span>Open in Editor</span>
                        </button>
                      )}

                      {!rep.resolved && (
                        <button
                          onClick={() => onResolveReport(rep.id)}
                          className="btn btn-primary btn-sm"
                        >
                          <Check size={13} />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUESTION EDITOR MODAL */}
      {editingQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="question-editor-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(21, 26, 30, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="card-notebook"
            style={{
              width: '100%',
              maxWidth: '780px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 id="question-editor-title" style={{ fontSize: '1.4rem' }}>
                Question Editor: <code>{editingQuestion.id}</code> (v{editingQuestion.version})
              </h2>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>

            {/* Validation errors banner */}
            {validationErrors.length > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--coral-light)',
                  border: '2px solid var(--coral)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '0.85rem',
                }}
              >
                <strong style={{ color: 'var(--coral)', display: 'block', marginBottom: '4px' }}>
                  Cannot approve question due to validation errors:
                </strong>
                <ul style={{ paddingLeft: '20px' }}>
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSaveQuestionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Status & Taxonomy Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    Editorial Status
                  </label>
                  <select
                    value={editingQuestion.editorialStatus}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, editorialStatus: e.target.value as EditorialStatus })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    <option value="draft">Draft (Excluded from sessions)</option>
                    <option value="in_review">In Review (Excluded from sessions)</option>
                    <option value="approved">Approved (Active in question bank)</option>
                    <option value="archived">Archived (Excluded from sessions)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    Concept ID
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.conceptId || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, conceptId: e.target.value })}
                    placeholder="e.g. concept-sensitivity-cutoff"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    Topic
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.topic || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                    placeholder="Topic title..."
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>
              </div>

              {/* Taxonomy (System & Discipline) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    System (e.g. Cardiovascular)
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.system || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, system: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    Discipline (e.g. Physiology)
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.discipline || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, discipline: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    Author Difficulty (Not measured)
                  </label>
                  <select
                    value={editingQuestion.authorDifficulty || 'Medium'}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, authorDifficulty: e.target.value as AuthorDifficulty })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-ink)',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Learning Objective */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                  Learning Objective
                </label>
                <input
                  type="text"
                  value={editingQuestion.learningObjective || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, learningObjective: e.target.value })}
                  placeholder="Clinical learning objective..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.88rem',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              {/* Vignette */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                  Vignette / Scenario Prompt
                </label>
                <textarea
                  rows={5}
                  value={editingQuestion.vignette || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, vignette: e.target.value })}
                  placeholder="Clinical scenario and question prompt..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              {/* Options & Correct Key */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Answer Options & Correct Option Selection
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Correct Key:{' '}
                    <strong>{editingQuestion.correctOptionId}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(editingQuestion.options || []).map((opt, idx) => (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="correctOption"
                          checked={editingQuestion.correctOptionId === opt.id}
                          onChange={() => setEditingQuestion({ ...editingQuestion, correctOptionId: opt.id })}
                          style={{ accentColor: 'var(--mint)' }}
                        />
                        <span style={{ fontWeight: 700 }}>Option {opt.id}</span>
                      </label>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updatedOpts = [...(editingQuestion.options || [])];
                          updatedOpts[idx] = { ...opt, text: e.target.value };
                          setEditingQuestion({ ...editingQuestion, options: updatedOpts });
                        }}
                        placeholder={`Option ${opt.id} text...`}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1.5px solid var(--border-ink)',
                          fontSize: '0.88rem',
                          backgroundColor: 'var(--bg-canvas)',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation & Key Takeaway */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                  Comprehensive Explanation
                </label>
                <textarea
                  rows={4}
                  value={editingQuestion.explanation || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  placeholder="Detailed rationale for the correct answer..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                  Key High-Yield Takeaway
                </label>
                <input
                  type="text"
                  value={editingQuestion.keyTakeaway || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, keyTakeaway: e.target.value })}
                  placeholder="One sentence high-yield summary..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--border-ink)',
                    fontSize: '0.88rem',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
