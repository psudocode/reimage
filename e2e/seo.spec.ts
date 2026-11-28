import { expect, test } from '@playwright/test';

test('landing page has SEO metadata', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/reimage/i);
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /no uploads/i);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    /reimage\.awdi\.my\.id/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(ld ?? '')['@type']).toBe('WebApplication');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('robots.txt and sitemap.xml are served', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap:');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('<urlset');
});
