/**
 * WardWit Branding Configuration
 * 
 * NOTE: "WardWit" is a replaceable internal project code name, 
 * not a claim of trademark or domain availability.
 * All brand text, mascot copy, and thematic tokens are centralized here.
 */

export interface BrandConfig {
  appName: string;
  codename: string;
  tagline: string;
  audienceDescription: string;
  mascotName: string;
  storageNotice: string;
  demoDisclaimer: string;
  collegeDisclaimer: string;
  quietModeNotice: string;
  humorQuotes: {
    welcome: string[];
    focus: string[];
    celebration: string[];
    encouragement: string[];
  };
  themeTokens: {
    warmIvory: string;
    darkInk: string;
    deepTeal: string;
    deepTealHover: string;
    coral: string;
    marigold: string;
    mint: string;
  };
}

export const BRAND: BrandConfig = {
  appName: 'WardWit',
  codename: 'WardWit',
  tagline: 'Playful medical study companion for USMLE Step 1',
  audienceDescription: 'Pakistani MBBS students preparing for USMLE Step 1',
  mascotName: 'Tyto',
  storageNotice: 'Saved on this browser (local IndexedDB). No cloud account required.',
  demoDisclaimer: 'Demo content — not for exam preparation. Demonstrates software functionality only.',
  collegeDisclaimer: 'College entry is personal profile data only, not a verified curriculum mapping or official affiliation.',
  quietModeNotice: 'Quiet Mode enabled: Playful mascot animations and sound cues are silenced.',
  humorQuotes: {
    welcome: [
      'Chai ready? Let’s tackle a high-yield block.',
      'Bismillah! Ready for a focused study sprint?',
      'One vignette at a time builds clinical intuition.',
      'Field notebook open, clinical reasoning engaged.',
    ],
    focus: [
      'Break it down into first principles.',
      'Look for the key clinical discriminator.',
      'Read the lead-in question carefully before jumping to options.',
      'Notice the patient clues before settling on an answer.',
    ],
    celebration: [
      'Well done! Sound clinical reasoning on this one.',
      'Distractor spotted and eliminated cleanly.',
      'Solid deduction on this high-yield concept.',
      'Great work! Every correct deduction builds exam stamina.',
    ],
    encouragement: [
      'Mistakes are data points, not verdicts. Review and retain.',
      'Step 1 mastery is built one concept at a time.',
      'Reviewing misconceptions is where the real score jump happens.',
      'Take a breath, review the pearl, and keep your momentum.',
    ],
  },
  themeTokens: {
    warmIvory: '#FDFBF7',
    darkInk: '#111827',
    deepTeal: '#0F766E',
    deepTealHover: '#115E59',
    coral: '#E11D48',
    marigold: '#F59E0B',
    mint: '#0D9488',
  },
};

