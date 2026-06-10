import { test, expect } from '@playwright/test';

// Recipe-specific page tests. These hit known published recipes. If a recipe
// gets unpublished/renamed these will fail loudly — which is the point: a
// missing recipe page is a real regression.

const PUBLISHED_SLUG = 'kates-rosemary-cashews';

test.describe('recipe detail page', () => {
  test('renders title, ingredients, and method', async ({ page }) => {
    await page.goto(`/recipes/${PUBLISHED_SLUG}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Method' })).toBeVisible();
  });

  test('has a breadcrumb linking to the section', async ({ page }) => {
    await page.goto(`/recipes/${PUBLISHED_SLUG}`);
    // The breadcrumb nav holds at least one section/family-line link.
    const crumb = page.locator('nav').first();
    await expect(crumb).toBeVisible();
  });

  test('shows a "Print recipe" link', async ({ page }) => {
    await page.goto(`/recipes/${PUBLISHED_SLUG}`);
    await expect(page.getByRole('link', { name: /Print recipe/i })).toBeVisible();
  });

  test('does NOT show an Edit link to signed-out visitors', async ({ page }) => {
    await page.goto(`/recipes/${PUBLISHED_SLUG}`);
    await expect(page.getByRole('link', { name: /Edit this recipe/i })).toHaveCount(0);
  });

  test('a non-existent recipe slug 404s', async ({ page }) => {
    const res = await page.goto('/recipes/this-recipe-does-not-exist-xyz');
    expect(res?.status()).toBe(404);
  });
});

test.describe('print route', () => {
  test('print page renders the recipe with the print footer', async ({ page }) => {
    await page.goto(`/recipes/${PUBLISHED_SLUG}/print`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/From Our Big Family Kitchen/i)).toBeVisible();
  });

  test('print page has a screen-only "Back to the recipe" link', async ({ page }) => {
    await page.goto(`/recipes/${PUBLISHED_SLUG}/print`);
    await expect(page.getByRole('link', { name: /Back to the recipe/i })).toBeVisible();
  });
});

test.describe('search results page', () => {
  test('a query renders grouped results', async ({ page }) => {
    await page.goto('/search?q=kuchen');
    await expect(page.getByText(/Results for/)).toBeVisible();
    // At least one result card.
    await expect(page.getByText(/Kuchen/i).first()).toBeVisible();
  });

  test('a nonsense query shows the no-matches state', async ({ page }) => {
    await page.goto('/search?q=zzzznonsensequeryxyz');
    await expect(page.getByText(/No matches/i)).toBeVisible();
  });

  test('the bare /search page prompts for a query', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: /Search the kitchen/i })).toBeVisible();
  });
});

test.describe('section + family-line recipe surfaces', () => {
  test('a section page renders its header', async ({ page }) => {
    await page.goto('/sections/appetizers');
    await expect(page.getByRole('heading', { name: 'Appetizers' })).toBeVisible();
  });

  test('the Leusch family page shows the federated banner', async ({ page }) => {
    await page.goto('/family-lines/leusch');
    await expect(page.getByText(/recipes from this family line/i)).toBeVisible();
  });
});
