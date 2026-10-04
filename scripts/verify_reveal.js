import puppeteer from 'puppeteer-core';
import path from 'path';

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\d4rkw\\.gemini\\antigravity-ide\\brain\\9a69dc53-1e0c-416b-acf3-e6192eb27460';

async function runRevealCheck() {
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

    await page.click('#nav-cards-btn');
    await new Promise(r => setTimeout(r, 800));

    const revealBtn = await page.$('#review-reveal-answer-btn');
    if (revealBtn) {
      console.log('Clicking #review-reveal-answer-btn...');
      await revealBtn.click();
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(artifactDir, 'cards_review_question_revealed.png') });
      console.log('Saved cards_review_question_revealed.png');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

runRevealCheck();
