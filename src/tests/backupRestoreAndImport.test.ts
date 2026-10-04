import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportLocalBackup,
  importLocalBackup,
  dryRunImportQuestions,
  clearAllLocalData,
  dailyActivityRepo,
  questionRepo,
} from '../persistence/indexedDbRepo';
import { DEMO_QUESTIONS } from '../config/demoQuestions';
import type { Question, DailyActivityRecord } from '../domain/types';

describe('Backup, Restore and Import Hardening', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('exports all persisted activity history (>90 records) and round-trips them completely', async () => {
    // Populate 120 daily activity records
    const records: DailyActivityRecord[] = [];
    for (let i = 1; i <= 120; i++) {
      const month = String(Math.floor(i / 28) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      const dateStr = `2025-${month}-${day}`;
      const rec = await dailyActivityRepo.recordActivity(dateStr, 5, 4, true);
      records.push(rec);
    }

    const allStoredBefore = await dailyActivityRepo.getAll();
    expect(allStoredBefore.length).toBe(120);

    // Export backup
    const backupJson = await exportLocalBackup();
    const parsed = JSON.parse(backupJson);

    // Must export all 120 records, not just 90!
    expect(parsed.dailyActivity).toHaveLength(120);

    // Clear database completely
    await clearAllLocalData();
    const cleared = await dailyActivityRepo.getAll();
    expect(cleared.length).toBe(0);

    // Restore backup
    const importRes = await importLocalBackup(backupJson);
    expect(importRes.success).toBe(true);

    // Verify all 120 records were restored
    const restored = await dailyActivityRepo.getAll();
    expect(restored.length).toBe(120);
  });

  it('leaves the prior database intact when backup restore fails validation or transaction', async () => {
    // Seed an initial question in the database
    const initialQ = DEMO_QUESTIONS[0];
    await questionRepo.save(initialQ);

    const questionsBefore = await questionRepo.getAll();
    expect(questionsBefore.some((q) => q.id === initialQ.id)).toBe(true);

    // Attempt to import a malformed backup with missing required structure
    const malformedBackup = JSON.stringify({
      version: 2,
      app: 'WardWit',
      questions: [{ id: 'corrupt-1' }], // Missing options/vignette or invalid session structure
      sessions: 'not-an-array', // Invalid!
    });

    const result = await importLocalBackup(malformedBackup);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/missing required|Validation failed/);

    // Prior database must remain intact!
    const questionsAfter = await questionRepo.getAll();
    expect(questionsAfter.length).toBe(questionsBefore.length);
    expect(questionsAfter[0].id).toBe(initialQ.id);
  });

  it('handles null JSON, null records, invalid option arrays, and duplicate IDs with clean readable errors', () => {
    // 1. null JSON
    const nullRes = dryRunImportQuestions(null as any, []);
    expect(nullRes.success).toBe(false);
    expect(nullRes.error).toContain('empty or not a valid JSON string');

    // 2. string "null"
    const jsonNullRes = dryRunImportQuestions('null', []);
    expect(jsonNullRes.success).toBe(false);
    expect(jsonNullRes.error).toContain('Invalid format');

    // 3. Array with null records
    const arrayWithNull = JSON.stringify([null, { id: 'valid-q-1' }]);
    const nullRowRes = dryRunImportQuestions(arrayWithNull, []);
    expect(nullRowRes.success).toBe(true);
    expect(nullRowRes.summary?.rowResults[0].isValid).toBe(false);
    expect(nullRowRes.summary?.rowResults[0].errors[0]).toContain('null or not a valid JSON object');

    // 4. Invalid option arrays (missing or < 2 options)
    const invalidOptionsJson = JSON.stringify([
      {
        id: 'opt-err-1',
        vignette: 'Sample clinical scenario test prompt with sufficient length.',
        options: 'not-an-array',
      },
      {
        id: 'opt-err-2',
        vignette: 'Sample clinical scenario test prompt with sufficient length.',
        options: [{ id: 'A', text: 'Single option only' }],
      },
    ]);
    const optRes = dryRunImportQuestions(invalidOptionsJson, []);
    expect(optRes.success).toBe(true);
    expect(optRes.summary?.rowResults[0].errors.some((e) => e.includes('options must be an array'))).toBe(true);
    expect(optRes.summary?.rowResults[1].errors.some((e) => e.includes('at least 2 options'))).toBe(true);

    // 5. Duplicate IDs in import file
    const dupesJson = JSON.stringify([
      {
        id: 'dup-id-100',
        vignette: 'Sample clinical scenario test prompt with sufficient length.',
        options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
      },
      {
        id: 'dup-id-100', // duplicate!
        vignette: 'Another clinical scenario test prompt with sufficient length.',
        options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
      },
    ]);
    const dupeRes = dryRunImportQuestions(dupesJson, []);
    expect(dupeRes.success).toBe(true);
    expect(dupeRes.summary?.duplicatesInFile).toContain('dup-id-100');
    expect(dupeRes.summary?.rowResults[1].errors.some((e) => e.includes('Duplicate Question ID'))).toBe(true);
  });

  it('preserves supported imageMetadata during question import and backup export', async () => {
    const questionWithMedia = {
      id: 'media-q-1',
      version: 1,
      editorialStatus: 'approved',
      contentKind: 'educational',
      vignette: 'A 60-year-old male with chest pain presents. Coronary angiogram is shown.',
      system: 'Cardiovascular',
      discipline: 'Pathology',
      topic: 'Coronary Artery Disease',
      learningObjective: 'Identify LAD occlusion on angiography.',
      options: [
        { id: 'A', text: 'Left Anterior Descending' },
        { id: 'B', text: 'Right Coronary Artery' },
      ],
      correctOptionId: 'A',
      explanation: 'Angiogram reveals critical stenosis in proximal LAD.',
      optionExplanations: { A: 'Correct', B: 'Incorrect' },
      keyTakeaway: 'LAD supplies the anterior wall and septum.',
      reviewer: { name: 'Dr. Expert' },
      imageMetadata: {
        url: 'https://example.com/images/lad-angiogram.png',
        alt: 'Coronary angiogram of LAD',
        caption: 'LAO cranial view displaying LAD vessel',
        provenance: 'Department of Cardiology Archive',
      },
    };

    const dryRun = dryRunImportQuestions(JSON.stringify([questionWithMedia]), []);
    expect(dryRun.success).toBe(true);
    expect(dryRun.summary?.validCount).toBe(1);

    const cleanQ = dryRun.summary?.cleanQuestions[0];
    expect(cleanQ?.imageMetadata).toBeDefined();
    expect(cleanQ?.imageMetadata?.url).toBe('https://example.com/images/lad-angiogram.png');
    expect(cleanQ?.imageMetadata?.alt).toBe('Coronary angiogram of LAD');
    expect(cleanQ?.imageMetadata?.caption).toBe('LAO cranial view displaying LAD vessel');
    expect(cleanQ?.imageMetadata?.provenance).toBe('Department of Cardiology Archive');

    // Save into repo and verify round-trip via exportLocalBackup
    await questionRepo.save(cleanQ!);
    const backupJson = await exportLocalBackup();
    const backupObj = JSON.parse(backupJson);

    const exportedQ = backupObj.questions.find((q: Question) => q.id === 'media-q-1');
    expect(exportedQ).toBeDefined();
    expect(exportedQ.imageMetadata).toEqual(cleanQ?.imageMetadata);
  });
});
