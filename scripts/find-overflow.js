import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://127.0.0.1:5173';

async function findOverflow() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.goto(`${BASE_URL}/#/today`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  const overflowingElements = await page.evaluate(() => {
    const docWidth = window.innerWidth;
    const elements = document.querySelectorAll('*');
    const culprits = [];

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 1) {
        culprits.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          outerHtmlPrefix: el.outerHTML.slice(0, 100),
        });
      }
    });

    return culprits;
  });

  console.log('Overflowing elements at 360px:', JSON.stringify(overflowingElements, null, 2));
  await browser.close();
}

findOverflow();
