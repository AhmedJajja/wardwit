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
  tagline: 'Playful field notebook for USMLE Step 1 practice',
  audienceDescription: 'Pakistani MBBS students preparing for USMLE Step 1',
  mascotName: 'Clip',
  storageNotice: 'Saved on this browser (local IndexedDB). No cloud account required.',
  demoDisclaimer: 'Demo content — not for exam preparation. Demonstrates software functionality only.',
  collegeDisclaimer: 'College entry is personal profile data only, not a verified curriculum mapping or official affiliation.',
  quietModeNotice: 'Quiet Mode enabled: Playful mascot quips and celebration animations are silenced.',
  humorQuotes: {
    welcome: [
      'Chai acquired. Next question?',
      'Bismillah! Ready for a high-yield study sprint?',
      'Your future self approves of this study session.',
      'Field notebook open, clinical brain activated.',
    ],
    focus: [
      'One concept less mysterious.',
      'Break it into first principles.',
      'Read the last sentence of the vignette first — classic exam craft.',
      'Notice the clues before jumping to conclusions.',
    ],
    celebration: [
      'Shaabash! Nailed the reasoning.',
      'Distractor eliminated with surgical precision.',
      'That concept is officially in your long-term memory.',
      'High-yield win! Give yourself a quick fist bump.',
    ],
    encouragement: [
      'Mistakes are data points, not verdicts. Review and conquer.',
      'Deep breath. Harrison’s was written one sentence at a time too.',
      'Reviewing incorrects is where the real score jump happens.',
      'Sip some water, reset, and tackle the next one.',
    ],
  },
  themeTokens: {
    warmIvory: '#FAF7F0',
    darkInk: '#1E252B',
    deepTeal: '#145355',
    deepTealHover: '#0D383A',
    coral: '#E06A55',
    marigold: '#F4A259',
    mint: '#48A9A6',
  },
};
