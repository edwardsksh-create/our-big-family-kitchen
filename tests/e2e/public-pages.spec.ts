import { test, expect } from '@playwright/test';

// Public page smoke tests. No sign-in, no writes. These guard against the
// kind of regressions where a deploy renders blank, 500s, or removes a
// critical link.

test.describe('public pages render', () => {
  test('home page shows hero + section grid + family lines', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /recipes we make, remember/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Breakfast/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Leusch/i }).first()).toBeVisible();
  });

  test('/recipes lists native recipes', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page.getByRole('heading', { name: /All recipes/i })).toBeVisible();
  });

  test('/family-lines/leusch shows the federation banner', async ({ page }) => {
    await page.goto('/family-lines/leusch');
    await expect(page.getByRole('heading', { level: 1, name: /Leusch family recipes/i })).toBeVisible();
    await expect(page.getByText(/Aunt Laura/i).first()).toBeVisible();
  });

  test('/sections/breakfast redirects to breakfast-and-brunch and renders', async ({ page }) => {
    await page.goto('/sections/breakfast');
    await expect(page).toHaveURL(/\/sections\/breakfast-and-brunch$/);
    await expect(
      page.getByRole('heading', { name: 'Breakfast and Brunch', level: 1 }),
    ).toBeVisible();
  });

  test('/contributors lists at least one contributor', async ({ page }) => {
    await page.goto('/contributors');
    await expect(page.getByRole('heading', { name: /The cooks/i })).toBeVisible();
  });

  test('/contributors/kate-edwards renders', async ({ page }) => {
    await page.goto('/contributors/kate-edwards');
    // Heading uses formatDisplayName, which inserts an optional birth-name
    // segment between first and last (e.g. "Kate (Sundy) Edwards").
    await expect(page.getByRole('heading', { level: 1, name: /Kate.*Edwards/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recipes' })).toBeVisible();
  });

  test('/about renders', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('/search?q=kuchen returns federated results', async ({ page }) => {
    await page.goto('/search?q=kuchen');
    await expect(page.getByText(/Results for/)).toBeVisible();
    // At least one recipe card should render.
    await expect(page.getByText(/Kuchen/i).first()).toBeVisible();
  });

  test('non-existent route shows 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/Nothing in the pantry/)).toBeVisible();
  });

  test('header brand is a link home from any page', async ({ page }) => {
    await page.goto('/recipes');
    await page.getByRole('link', { name: /Our Big Family Kitchen/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('auth-gated pages redirect signed-out users', () => {
  test('/add → /sign-in', async ({ page }) => {
    await page.goto('/add');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('/add/photo → /sign-in', async ({ page }) => {
    await page.goto('/add/photo');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('/admin/queue → /sign-in', async ({ page }) => {
    await page.goto('/admin/queue');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('API surface', () => {
  test('/api/photos/upload requires auth (401)', async ({ request }) => {
    const res = await request.post('/api/photos/upload', { multipart: {} });
    expect(res.status()).toBe(401);
  });

  test('/api/photos/parse requires auth (401)', async ({ request }) => {
    const res = await request.post('/api/photos/parse', { data: { photo_urls: [] } });
    expect(res.status()).toBe(401);
  });

  test('/api/search/suggest works without auth', async ({ request }) => {
    const res = await request.get('/api/search/suggest?q=kuchen');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
  });

  test('/api/cron/backup rejects without bearer (401)', async ({ request }) => {
    const res = await request.get('/api/cron/backup');
    expect(res.status()).toBe(401);
  });
});
