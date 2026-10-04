import puppeteer from 'puppeteer-core';
import path from 'path';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\d4rkw\\.gemini\\antigravity-ide\\brain\\9a69dc53-1e0c-416b-acf3-e6192eb27460';

async function runVerification() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });

    const skipBtn = await page.$('#onboarding-skip-btn');
    if (skipBtn) {
      await skipBtn.click();
      await new Promise(r => setTimeout(r, 600));
    }

    // Launch practice block
    await page.click('#nav-practice-btn');
    await new Promise(r => setTimeout(r, 800));

    const startBlockBtn = await page.$('#practice-launch-btn');
    if (startBlockBtn) {
      await startBlockBtn.click();
      await new Promise(r => setTimeout(r, 1000));

      await page.waitForSelector('#option-A', { timeout: 5000 });
      await page.click('#option-A');
      await new Promise(r => setTimeout(r, 300));

      await page.click('#tutor-submit-answer-btn');
      await new Promise(r => setTimeout(r, 800));

      const playerSaveBtn = await page.$('#player-save-to-review-btn');
      if (playerSaveBtn) {
        await playerSaveBtn.click();
        await new Promise(r => setTimeout(r, 600));
      }

      // Navigate to Cards
      await page.click('#nav-cards-btn');
      await new Promise(r => setTimeout(r, 800));

      // Click correct reveal ID: #review-reveal-answer-btn
      const revealQBtn = await page.$('#review-reveal-answer-btn');
      if (revealQBtn) {
        console.log('Clicking #review-reveal-answer-btn...');
        await revealQBtn.click();
        await new Promise(r => setTimeout(r, 800));
        await page.screenshot({ path: path.join(artifactDir, 'cards_review_question_revealed.png') });
        console.log('Saved cards_review_question_revealed.png');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
