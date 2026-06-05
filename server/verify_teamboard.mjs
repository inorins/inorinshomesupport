import { chromium } from 'playwright';

const SLOK_TOKEN = 'eyJpZCI6NSwicm9sZSI6Imlub3JpbnMiLCJiYW5rRG9tYWluIjpudWxsLCJiYW5rTmFtZSI6bnVsbH0.uLNo2k4IDpM3c7d1BYr2CfyTPwA9jNrDKKUX9Tfa0-c';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://localhost:8081');
await page.evaluate((tok) => {
  localStorage.setItem('inorins_session_token', tok);
  localStorage.setItem('inorins_user_id', '5');
}, SLOK_TOKEN);

await page.goto('http://localhost:8081/staff/board');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

// Confirm user loaded
const loggedInUser = await page.evaluate(async () => {
  const tok = localStorage.getItem('inorins_session_token');
  const uid = localStorage.getItem('inorins_user_id');
  const r = await fetch(`/api/auth/users/${uid}`, { headers: { Authorization: `Bearer ${tok}` }});
  const u = await r.json();
  return { name: u.name, id: u.id };
});
console.log('Logged in as:', loggedInUser);

// Test: Click TKT-2411 specifically (Slok's own resolved ticket)
console.log('\n--- Test: Click own ticket (TKT-2411) ---');
const tkt2411 = await page.$('.bg-card:has-text("TKT-2411")');
if (tkt2411) {
  const props = await tkt2411.evaluate(el => ({
    cursor: window.getComputedStyle(el).cursor,
    opacity: window.getComputedStyle(el).opacity,
    locked: el.className.includes('cursor-not-allowed'),
    text: el.innerText.replace(/\n/g,' ').slice(0,80),
  }));
  console.log('TKT-2411:', props);
  const urlBefore = page.url();
  await tkt2411.click();
  await page.waitForTimeout(1500);
  console.log('Navigated:', page.url() !== urlBefore, '→', page.url());
} else {
  console.log('TKT-2411 card not found!');
}

// Test: Click TKT-2405 (Open, Sujan's — canViewOthersOpen=true)
await page.goto('http://localhost:8081/staff/board');
await page.waitForTimeout(2000);
console.log('\n--- Test: Click open ticket (TKT-2405, Sujan\'s, viewable because canViewOthersOpen=true) ---');
const tkt2405 = await page.$('.bg-card:has-text("TKT-2405")');
if (tkt2405) {
  const urlBefore = page.url();
  await tkt2405.click();
  await page.waitForTimeout(1500);
  console.log('Navigated:', page.url() !== urlBefore, '→', page.url());
}

// Test: Click TKT-2414 (In Progress, Sujan's — locked for Slok)
await page.goto('http://localhost:8081/staff/board');
await page.waitForTimeout(2000);
console.log('\n--- Test: Click locked ticket (TKT-2414, In Progress, others) ---');
const tkt2414 = await page.$('.bg-card:has-text("TKT-2414")');
if (tkt2414) {
  const locked = await tkt2414.evaluate(el => el.className.includes('cursor-not-allowed'));
  console.log('Is locked:', locked);
  await tkt2414.click();
  await page.waitForTimeout(1500);
  console.log('URL unchanged:', page.url().includes('/staff/board'));
  const toast = await page.$('li[class*="toast"], [data-sonner-toast]');
  if (toast) console.log('Toast:', await toast.evaluate(el => el.innerText?.trim().slice(0,60)));
}

await browser.close();
