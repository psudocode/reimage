import { expect, test } from '@playwright/test';
import { addSampleImage } from './helpers.ts';

test('add an image, apply Compress, get a download link', async ({ page }) => {
  await page.goto('/');
  await addSampleImage(page);
  await page.getByRole('button', { name: /apply/i }).first().click();
  const link = page.getByRole('link', { name: /download/i }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(link).toHaveAttribute('download', /sample/);
});

test('switching language to Indonesian updates the UI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ID' }).click();
  await expect(
    page.getByText(/tidak ada upload|tanpa upload|Jatuhkan|Tarik/i).first(),
  ).toBeVisible();
});
