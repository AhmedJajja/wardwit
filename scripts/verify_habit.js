import puppeteer from 'puppeteer-core';
import path from 'path';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\d4rkw\\.gemini\\antigravity-ide\\brain\\3ba23ee7-869e-4652-8567-a06e270689e3';

async function runHabitVerification() {
  console.log('Launching Chrome for Daily Habit verification...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'networkidle0', timeout: 15000 });

    // Handle onboarding if open
    const skipBtn = await page.$('#onboarding-skip-btn');
    if (skipBtn) {
      console.log('Dismissing onboarding modal...');
      await skipBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }

    // 1. Verify Daily Habit Widget on Dashboard
    const habitWidget = await page.$('#daily-habit-widget');
    if (!habitWidget) {
      throw new Error('#daily-habit-widget not found on Dashboard!');
    }
    console.log('PASS: #daily-habit-widget is present on Dashboard.');

    const streakText = await page.$eval('#habit-current-streak-text', el => el.textContent.trim());
    console.log('Habit streak text:', streakText);

    const initialActionsCount = await page.$eval('#habit-today-actions-count', el => el.textContent.trim());
    console.log('Initial today actions count:', initialActionsCount);

    // 2. Test Help policy button toggle
    const helpBtn = await page.$('#habit-help-toggle-btn');
    if (helpBtn) {
      await helpBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const helpBox = await page.$('#habit-policy-help-box');
      if (helpBox) {
        const helpText = await page.evaluate(el => el.textContent, helpBox);
        console.log('PASS: Policy help box expanded successfully with policy text.');
        expectTrue(helpText.includes('Asia/Karachi'), 'Help text mentions Asia/Karachi timezone');
        expectTrue(helpText.includes('5 distinct questions'), 'Help text mentions 5 distinct questions target');
      } else {
        throw new Error('Policy help box did not expand!');
      }
    }

    await page.screenshot({ path: path.join(artifactDir, 'habit_dashboard_initial.png') });
    console.log('Saved screenshot: habit_dashboard_initial.png');

    // 3. Test starting quick sprint and submitting tutor answer
    const startSprintBtn = await page.$('#today-start-sprint-btn');
    if (startSprintBtn) {
      console.log('Clicking #today-start-sprint-btn to launch sprint...');
      await startSprintBtn.click();
      await new Promise(r => setTimeout(r, 1200));

      // Select an option
      const optionA = await page.waitForSelector('#option-A', { timeout: 5000 });
      if (optionA) {
        await optionA.click();
        await new Promise(r => setTimeout(r, 400));

        // Submit answer in tutor mode
        const submitBtn = await page.waitForSelector('#tutor-submit-answer-btn', { timeout: 3000 });
        if (submitBtn) {
          console.log('Submitting tutor answer...');
          await submitBtn.click();
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      await page.screenshot({ path: path.join(artifactDir, 'habit_tutor_submitted.png') });
      console.log('Saved screenshot: habit_tutor_submitted.png');

      // Return to Dashboard using player exit button
      await page.click('#player-exit-btn');
      await new Promise(r => setTimeout(r, 1000));

      const updatedActionsCount = await page.$eval('#habit-today-actions-count', el => el.textContent.trim());
      console.log('Updated today actions count on Dashboard:', updatedActionsCount);
      expectTrue(updatedActionsCount.startsWith('1 / 5'), 'Actions count updated to 1 / 5');

      await page.screenshot({ path: path.join(artifactDir, 'habit_dashboard_updated.png') });
      console.log('Saved screenshot: habit_dashboard_updated.png');
    }

    console.log('ALL BROWSER HABIT VERIFICATIONS SUCCEEDED!');
  } catch (err) {
    console.error('Browser verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

function expectTrue(cond, desc) {
  if (!cond) {
    throw new Error(`Assertion failed: ${desc}`);
  }
  console.log(`PASS: ${desc}`);
}

runHabitVerification();
