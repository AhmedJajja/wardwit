/**
 * Demonstration Discover Concept Cards
 * 
 * IMPORTANT CONTENT HONESTY NOTICE:
 * These Discover concept cards are demonstration items designed to exercise the software,
 * test prediction-reveal mechanics, curriculum mapping, and review saving.
 * They DO NOT contain clinical advice, real patient data, or official USMLE exam content.
 * All items are distinctly labeled with contentKind: 'demo'.
 */

import type { DiscoverCard } from '../domain/types';

export const DEMO_DISCOVER_CARDS: DiscoverCard[] = [
  {
    id: 'disc-demo-001',
    version: 1,
    contentKind: 'demo',
    editorialStatus: 'approved',
    curiosityPrompt: 'When shifting a screening test cut-off threshold downward, why do false positives inevitably rise alongside sensitivity?',
    revealedConcept: 'Biomarker Cut-off Shift & The ROC Trade-Off',
    conciseExplanation: 'Lowering the threshold criterion broadens the criterion for a "positive" result. More diseased subjects fall above the bar (higher sensitivity), but more healthy individuals in the overlapping distribution tail also cross the threshold, inflating false positives and lowering specificity.',
    whyItMatters: 'Essential for USMLE Step 1 biostatistics: adjusting diagnostic thresholds moves along the Receiver Operating Characteristic (ROC) curve rather than shifting the curve itself.',
    curriculumMapping: {
      system: 'Demo - Biostatistics & Trial Design',
      discipline: 'Demo - Epidemiology',
      topic: 'Sensitivity & Specificity Trade-offs',
      syllabusRef: 'Basic Sciences Biostatistics & Screening Methodology (Demonstration Syllabus)',
    },
    sourceReference: {
      source: 'Gordis Epidemiology (Educational Reference)',
      edition: '6th Edition',
      page: 'p. 94',
    },
    tags: ['Biostatistics', 'Screening', 'Sensitivity', 'Specificity', 'Demo'],
    reviewer: {
      name: 'Faculty Reviewer (Demo)',
      role: 'Biostatistics Educator',
    },
    createdAt: 1727400000000,
    updatedAt: 1727400000000,
  },
  {
    id: 'disc-demo-002',
    version: 1,
    contentKind: 'demo',
    editorialStatus: 'approved',
    curiosityPrompt: 'Why does an Intention-to-Treat (ITT) analysis include non-compliant dropouts even if they took zero doses of the study drug?',
    revealedConcept: 'Intention-to-Treat (ITT) Preserves Randomization',
    conciseExplanation: 'ITT analyzes every subject according to their randomly assigned group regardless of adherence or dropout. Excluding non-compliant patients introduces attrition bias because reasons for stopping (side effects, severity) are rarely random.',
    whyItMatters: 'Protects the integrity of baseline randomization and reflects real-world clinical effectiveness rather than idealized per-protocol efficacy.',
    curriculumMapping: {
      system: 'Demo - Biostatistics & Trial Design',
      discipline: 'Demo - Clinical Trials',
      topic: 'Intention-to-Treat (ITT) Analysis',
      syllabusRef: 'Clinical Trial Methodology & Bias Mitigation (Demonstration Syllabus)',
    },
    sourceReference: {
      source: 'Fletcher Clinical Epidemiology (Educational Reference)',
      edition: '5th Edition',
      page: 'p. 142',
    },
    tags: ['Clinical Trials', 'ITT', 'Attrition Bias', 'Demo'],
    reviewer: {
      name: 'Faculty Reviewer (Demo)',
      role: 'Trial Design Educator',
    },
    createdAt: 1727400000000,
    updatedAt: 1727400000000,
  },
  {
    id: 'disc-demo-003',
    version: 1,
    contentKind: 'demo',
    editorialStatus: 'approved',
    curiosityPrompt: 'How does an acute increase in arteriolar afterload alter the ventricular end-systolic pressure-volume relationship?',
    revealedConcept: 'Ventricular Afterload & End-Systolic Volume',
    conciseExplanation: 'When afterload rises, the ventricle must generate higher pressure to open the aortic valve and sustains higher resistance throughout ejection. Ejection velocity slows and ends sooner, leaving a larger residual volume in the chamber (increased end-systolic volume, decreased stroke volume).',
    whyItMatters: 'Key high-yield cardiovascular physiology concept tested via PV-loop morphology shifts on Step 1.',
    diagram: {
      url: '/assets/tyto-doctor.png',
      alt: 'Stylized demonstration diagram illustrating ventricular afterload mechanics',
      caption: 'Demonstration physiological principle: increased afterload shifts end-systolic volume rightward.',
      fallbackExplanation: 'Increased afterload increases end-systolic volume and decreases stroke volume along the intact end-systolic elastance slope.',
      provenance: {
        source: 'Cardiovascular Physiology Principles (Demonstration)',
        edition: '1st Edition',
        printedPage: 'p. 78',
        pdfPageIndex: 85,
        licenseOrPermission: 'Created for WardWit demonstration purposes',
        editorialStatus: 'approved',
        reviewedBy: 'Physiology Review Board',
      },
    },
    curriculumMapping: {
      system: 'Cardiovascular (Demo)',
      discipline: 'Physiology (Demo)',
      topic: 'Cardiac Output Logic',
      syllabusRef: 'Hemodynamics & Myocardial Mechanics (Demonstration Syllabus)',
    },
    sourceReference: {
      source: 'Costanzo Physiology (Educational Reference)',
      edition: '6th Edition',
      page: 'p. 130',
    },
    tags: ['Cardiovascular', 'Physiology', 'PV Loops', 'Afterload', 'Demo'],
    reviewer: {
      name: 'Faculty Reviewer (Demo)',
      role: 'Cardiovascular Educator',
    },
    createdAt: 1727400000000,
    updatedAt: 1727400000000,
  },
];
