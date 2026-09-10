const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // Fill in form
  await page.fill('input[type="email"]', 'iamak.262003@gmail.com');
  await page.fill('input[type="password"]', '123456');

  // Find what element is at the center of the Sign In button
  const button = await page.locator('button[type="submit"]');
  const box = await button.boundingBox();
  
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  
  // Evaluate what element is at those coordinates
  const elementAtPoint = await page.evaluate(({x, y}) => {
      const el = document.elementFromPoint(x, y);
      return {
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          html: el.outerHTML
      };
  }, { x: centerX, y: centerY });
  
  console.log("Element at button coordinates:", elementAtPoint);
  
  // Try to click the button
  try {
      await button.click({ timeout: 2000 });
      console.log("Button clicked successfully via Playwright");
  } catch (e) {
      console.log("Failed to click button:", e.message);
  }

  // Wait a bit to see if navigation or loading happens
  await page.waitForTimeout(1000);
  
  const currentUrl = page.url();
  console.log("Current URL after click:", currentUrl);
  
  const html = await page.content();
  if (html.includes('Signing in')) {
      console.log("UI says 'Signing in...'");
  }
  if (html.includes('Login successful')) {
      console.log("UI says 'Login successful!'");
  }
  
  await browser.close();
})();
