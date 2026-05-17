import { NextResponse } from 'next/server';
import { fetchAllFederatedRecipes } from '@/lib/queries/federated';
import { toSearchableItems, rank } from '@/lib/search';

export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  const recipes = await fetchAllFederatedRecipes();
  const items = toSearchableItems(recipes);
  const results = rank(items, q, 8).map((r) => ({
    id:           r.id,
    title:        r.title,
    contributor:  r.contributor,
    sectionSlug:  r.sectionSlug,
    href:         r.href,
    external:     r.external,
  }));
  return NextResponse.json(
    { results },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
