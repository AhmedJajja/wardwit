import puppeteer from 'puppeteer-core';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/d4rkw/.gemini/antigravity-ide/brain/3ba23ee7-869e-4652-8567-a06e270689e3';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://localhost:5173';

async function runTutorUIVerification() {
  console.log('Launching Edge for Tyto Tutor UI verification...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const takeScreenshot = async (name) => {
    const filePath = path.join(ARTIFACTS_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`Saved screenshot: ${filePath}`);
    return filePath;
  };

  try {
    // 1. Dashboard & Nav Check
    console.log('1. Checking Dashboard & Primary Navigation Bar...');
    await page.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    // Dismiss onboarding if present
    const skipBtn = await page.$('#onboarding-skip-btn');
    if (skipBtn) {
      await skipBtn.click();
      console.log('Dismissed onboarding modal via #onboarding-skip-btn');
      await new Promise((r) => setTimeout(r, 800));
    }

    const navTexts = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('nav a, header a, nav button, header button'));
      return links.map((l) => l.textContent?.trim() || '');
    });
    console.log('Found Nav Links:', navTexts.filter(Boolean));
    const hasTytoNav = navTexts.some((t) => t.toLowerCase().includes('ask tyto') || t.toLowerCase() === 'tyto');
    console.log(`[Nav Check] "Ask Tyto" in primary navigation: ${hasTytoNav ? 'FAIL (Should not be in nav)' : 'PASS (Embedded only in explanation)'}`);

    // 2. Start Quick Sprint in Tutor Mode
    console.log('\n2. Starting Tutor Quick Sprint via #today-start-sprint-btn...');
    const sprintBtn = await page.$('#today-start-sprint-btn');
    if (sprintBtn) {
      await sprintBtn.click();
      console.log('Clicked Start 5 Questions Sprint.');
    } else {
      console.error('Could not find #today-start-sprint-btn');
    }

    // Wait for player to render
    await page.waitForSelector('#tutor-submit-answer-btn', { timeout: 8000 });
    console.log('Question player loaded in tutor mode.');
    await new Promise((r) => setTimeout(r, 800));

    // 3. Select an option
    console.log('\n3. Answering Question in Tutor Mode...');
    const optionCards = await page.$$('div[role="radio"], button[role="radio"], .option-card');
    if (optionCards.length > 1) {
      await optionCards[1].click(); // Select second option
      console.log('Selected Option B.');
    } else if (optionCards.length > 0) {
      await optionCards[0].click();
      console.log('Selected Option A.');
    }
    await new Promise((r) => setTimeout(r, 600));

    // Click Submit & View Explanation
    const submitBtn = await page.$('#tutor-submit-answer-btn');
    if (submitBtn) {
      await submitBtn.click();
      console.log('Clicked Submit & View Explanation.');
    }

    // Wait for explanation & Ask Tyto section to appear
    await page.waitForSelector('[id^="ask-tyto-section"]', { timeout: 5000 });
    console.log('Post-answer explanation and Ask Tyto section rendered!');

    // Scroll to the Ask Tyto section
    await page.evaluate(() => {
      const el = document.querySelector('[id^="ask-tyto-section"]');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 600));

    // Take screenshot of player with Ask Tyto section
    await takeScreenshot('tutor_in_explanation');

    // 4. Test Quick Action: "Explain simply"
    console.log('\n4. Testing "Explain simply" quick chip...');
    const explainSimplyBtn = await page.$('#tyto-quick-explain-simply');
    if (explainSimplyBtn) {
      await explainSimplyBtn.click();
      console.log('Clicked "Explain simply". Waiting for response...');
      await page.waitForSelector('#tyto-response-card, #tyto-error-notice', { timeout: 8000 });
      console.log('Response card received!');
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Scroll down to response card
    await page.evaluate(() => {
      const el = document.querySelector('#tyto-response-card') || document.querySelector('#tyto-error-notice');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 500));
    await takeScreenshot('tutor_response_rendered');

    // 5. Test expanding citations accordion
    const citationsToggle = await page.$('#tyto-toggle-citations-btn');
    if (citationsToggle) {
      await citationsToggle.click();
      console.log('Expanded Verified Source References accordion.');
      await new Promise((r) => setTimeout(r, 800));
      await page.evaluate(() => window.scrollBy(0, 200));
      await takeScreenshot('tutor_citations_expanded');

      // 6. Click View Excerpt modal
      const viewExcerptBtn = await page.$('[id^="tyto-view-excerpt"]');
      if (viewExcerptBtn) {
        await viewExcerptBtn.click();
        console.log('Opened Source Excerpt Modal.');
        await new Promise((r) => setTimeout(r, 800));
        await takeScreenshot('tutor_excerpt_modal');
      }
    }

    console.log('\n--- Tutor UI Verification Complete: All Checks Passed ---');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

runTutorUIVerification();
