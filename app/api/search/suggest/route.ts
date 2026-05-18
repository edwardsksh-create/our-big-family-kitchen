import { NextResponse } from 'next/server';
import { fetchAllFederatedRecipes } from '@/lib/queries/federated';
import { fetchRecentPublishedRecipes } from '@/lib/queries/recipes';
import { toSearchableItems, nativeRecipeToSearchableItem, rank } from '@/lib/search';

export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  // Native published recipes are indexed alongside federated ones. We cap
  // native fetches generously (200) because the autocomplete budget is only
  // 8 results — anything beyond 200 native recipes is far future.
  const [federated, native] = await Promise.all([
    fetchAllFederatedRecipes(),
    fetchRecentPublishedRecipes(200),
  ]);
  const items = [
    ...toSearchableItems(federated),
    ...native.map(nativeRecipeToSearchableItem),
  ];
  const results = rank(items, q, 8).map((r) => ({
    id:          r.id,
    title:       r.title,
    contributor: r.contributor,
    sectionSlug: r.sectionSlug,
    href:        r.href,
    external:    r.external,
  }));
  return NextResponse.json(
    { results },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
