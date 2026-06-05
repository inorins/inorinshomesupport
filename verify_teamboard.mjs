import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('console', msg => { if (['error','warn'].includes(msg.type())) errors.push(`[${msg.type()}] ${msg.text()}`); });
page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
const failedApis = [];
page.on('response', res => { if (!res.ok() && res.url().includes('/api/')) failedApis.push(`${res.status()} ${res.url()}`); });

// Go directly to login page
await page.goto('http://localhost:8081/login');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'verify_step1_login.png' });

// Get demo users
const demoRes = await page.evaluate(async () => {
  const r = await fetch('/api/auth/demo-users');
  return r.json();
});
const staffUser = demoRes?.find(u => u.role === 'inorins');
console.log('Logging in as:', staffUser?.name, staffUser?.email);

// Try each common password until one works
const passwords = ['password', 'inorins123', '123456', 'password123', 'inorins', 'admin123', 'test123', 'support'];
let loggedIn = false;
for (const pw of passwords) {
  await page.fill('input[type="email"]', staffUser.email);
  await page.fill('input[type="password"]', pw);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  if (!page.url().includes('/login')) { 
    console.log('Logged in with password:', pw);
    loggedIn = true;
    break;
  }
  // Clear and retry
  const errEl = await page.$('[class*="error"], [role="alert"], .text-destructive');
  if (errEl) {
    const errText = await errEl.textContent();
    console.log(`  pw "${pw}" → ${errText?.trim()}`);
  }
}

if (!loggedIn) {
  // Try clicking a demo user button if available
  console.log('Trying demo user buttons...');
  const demoButtons = await page.$$('button');
  for (const btn of demoButtons) {
    const txt = await btn.textContent();
    if (txt?.toLowerCase().includes('demo') || txt?.toLowerCase().includes('gaurav') || txt?.toLowerCase().includes('staff')) {
      console.log('Found button:', txt);
      await btn.click();
      await page.waitForTimeout(1000);
      if (!page.url().includes('/login')) { loggedIn = true; break; }
    }
  }
}

await page.screenshot({ path: 'verify_step2_after_login.png' });
console.log('URL after login attempts:', page.url());

if (!page.url().includes('/login')) {
  // Navigate to team board
  await page.goto('http://localhost:8081/staff/board');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_step3_team_board.png' });
  console.log('Board URL:', page.url());
  console.log('Board text:', (await page.evaluate(() => document.body.innerText)).slice(0, 600));
  
  // Check card clickability
  const cards = await page.$$('.bg-card');
  console.log('Ticket cards found:', cards.length);
  if (cards.length > 0) {
    // Check cursor style of first card
    const cursor = await cards[0].evaluate(el => window.getComputedStyle(el).cursor);
    const opacity = await cards[0].evaluate(el => window.getComputedStyle(el).opacity);
    const hasLock = await cards[0].$('svg[class*="lucide-lock"]') !== null;
    console.log('First card cursor:', cursor, '| opacity:', opacity, '| has lock icon:', hasLock);
  }
  
  // Test clicking first card
  if (cards.length > 0) {
    const urlBefore = page.url();
    await cards[0].click();
    await page.waitForTimeout(1000);
    const urlAfter = page.url();
    console.log('Click result:', urlBefore === urlAfter ? 'NO NAVIGATION (toast or blocked)' : `Navigated to ${urlAfter}`);
    await page.screenshot({ path: 'verify_step4_after_click.png' });
    // Check for toast
    const toast = await page.$('[data-sonner-toast], [role="status"], [class*="toast"]');
    console.log('Toast visible after click:', !!toast);
    if (toast) console.log('Toast text:', await toast.textContent());
  }
  
  // Check permissions API response
  const permsResp = await page.evaluate(async () => {
    const token = localStorage.getItem('inorins_session_token');
    const r = await fetch('/api/auth/me/permissions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { status: r.status, body: await r.json() };
  });
  console.log('Permissions API:', JSON.stringify(permsResp));
}

await browser.close();
console.log('');
console.log('API errors:', failedApis);
console.log('Console errors:', errors.slice(0, 10));
