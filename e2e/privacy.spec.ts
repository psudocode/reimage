import { expect, test } from '@playwright/test';
import { addSampleImage } from './helpers.ts';

test('processing an image makes no network request', async ({ page }) => {
  // Let the app fully load first (assets, WASM chunks are same-origin, allowed).
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const origin = new URL(page.url()).origin;
  const requests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    requests.push(`${req.method()} ${url}`);
  });

  await addSampleImage(page);
  await page.getByRole('button', { name: /apply/i }).first().click();
  await expect(page.getByRole('link', { name: /download/i }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Same-origin static chunks (lazy codecs) are fine; nothing may leave the origin,
  // and nothing may be POSTed/PUT anywhere.
  const external = requests.filter((r) => !r.split(' ')[1].startsWith(origin));
  const writes = requests.filter((r) => /^(POST|PUT|PATCH) /.test(r));
  expect(external).toEqual([]);
  expect(writes).toEqual([]);
});
