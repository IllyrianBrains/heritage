import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.waitForSelector('.place-card', { timeout: 15000 });
await page.waitForTimeout(1500);
const dialogClose = await page.$('#project-intro .preview-close, #project-intro button, dialog#project-intro [type="button"]');
if (dialogClose) await dialogClose.click().catch(() => {});
await page.evaluate(() => document.getElementById('project-intro')?.close?.());
await page.waitForTimeout(300);

await page.screenshot({ path: '/tmp/claude-1000/-home-pomodoro-Desktop-flamingo-heritage/223b62be-23ba-4347-9dc4-9eb91c937f1e/scratchpad/cards.png' });

const firstCard = await page.$('.card-open');
if (firstCard) {
  await firstCard.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/claude-1000/-home-pomodoro-Desktop-flamingo-heritage/223b62be-23ba-4347-9dc4-9eb91c937f1e/scratchpad/selected.png' });
}

const cardOpenStyles = await page.evaluate(() => {
  const el = document.querySelector('.card-open');
  if (!el) return null;
  const s = getComputedStyle(el);
  return { display: s.display, border: s.border, background: s.backgroundColor, padding: s.padding, width: s.width };
});
const pressedCardStyles = await page.evaluate(() => {
  const article = document.querySelector('.place-card:has(.card-open[aria-pressed="true"])');
  if (!article) return 'NO MATCH';
  const s = getComputedStyle(article);
  return { border: s.borderColor, background: s.backgroundColor };
});

console.log('cardOpenStyles', JSON.stringify(cardOpenStyles));
console.log('pressedCardStyles', JSON.stringify(pressedCardStyles));
console.log('console errors', JSON.stringify(errors, null, 2));

// find a card with a photo to check the image-source link layout
const photoCardHandle = await page.evaluateHandle(() => {
  const cards = [...document.querySelectorAll('.place-card')];
  return cards.find((c) => c.querySelector('.card-image-link')) || null;
});
if (photoCardHandle) {
  const el = photoCardHandle.asElement();
  if (el) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await el.screenshot({ path: '/tmp/claude-1000/-home-pomodoro-Desktop-flamingo-heritage/223b62be-23ba-4347-9dc4-9eb91c937f1e/scratchpad/photo_card.png' });
  }
}

// open notes editor to check legend + category swatches
await page.click('#open-notes');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/claude-1000/-home-pomodoro-Desktop-flamingo-heritage/223b62be-23ba-4347-9dc4-9eb91c937f1e/scratchpad/notes_editor.png' });

// open the scope/legend filter popover to check note-legend rendering
await page.click('#close-notes-editor').catch(() => {});
await page.click('#scope-filter summary');
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/claude-1000/-home-pomodoro-Desktop-flamingo-heritage/223b62be-23ba-4347-9dc4-9eb91c937f1e/scratchpad/legend_popover.png' });

await browser.close();
