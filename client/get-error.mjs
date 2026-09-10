import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  try {
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle0' });
  } catch(e) {
    console.log("Goto Error:", e.message);
  }
  
  await browser.close();
  console.log("Done.");
})();
