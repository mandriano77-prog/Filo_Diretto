// @ts-check
const { test, expect } = require('@playwright/test');

const baseURL = process.env.E2E_BASE_URL || '';
const email = process.env.E2E_LOGIN_EMAIL || '';
const password = process.env.E2E_LOGIN_PASSWORD || '';
const brandId = process.env.E2E_BRAND_ID || '';

test.describe('A2W Contatti', () => {
  test.skip(!baseURL || !email || !password || !brandId, 'Set E2E_BASE_URL, E2E_LOGIN_EMAIL, E2E_LOGIN_PASSWORD, E2E_BRAND_ID');

  test('Aggiungi contatto apre la modale', async ({ page }) => {
    await page.goto(`${baseURL}/dashboard/?brand_id=${encodeURIComponent(brandId)}`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /accedi/i }).click();
    await page.waitForURL(/\/dashboard\//);

    await page.locator('.nav-item[data-section-id="leads"]').click();
    await page.getByRole('button', { name: 'Aggiungi contatto' }).click();

    await expect(page.getByRole('dialog', { name: /aggiungi contatto/i })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\//);
    await expect(page).not.toHaveURL(/\/landing\/new/);
  });
});
