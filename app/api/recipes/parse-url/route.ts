import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchRecipeFromUrl } from '@/lib/recipe-from-url';
import { checkFetchTarget } from '@/lib/url-safety';
import { contributorIdForEmail, reserveAiParse, releaseAiParse } from '@/lib/recipes/ai-usage';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const contributorId = await contributorIdForEmail(session.user.email);
  if (!contributorId) {
    return NextResponse.json({ error: 'not_a_contributor' }, { status: 403 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const raw = (body.url ?? '').trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'bad_url' }, { status: 400 });
  }

  // SSRF guard: refuse to fetch private / loopback / link-local / metadata
  // addresses. Resolves the hostname and checks every returned IP.
  const safety = await checkFetchTarget(url.toString());
  if (!safety.ok) {
    if (safety.reason === 'private_address') {
      console.error(JSON.stringify({ event: 'url_fetch_blocked', url: url.toString() }));
      return NextResponse.json({ error: 'blocked_address' }, { status: 422 });
    }
    return NextResponse.json({ error: safety.reason }, { status: 400 });
  }

  // Reserve a slot before fetching. A URL only spends AI when it falls back
  // to the model (JSON-LD parsing is free), so the slot is refunded below
  // whenever the AI fallback wasn't what produced the result.
  const reservation = await reserveAiParse(contributorId);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: 'ai_daily_limit', limit: reservation.limit },
      { status: 429 },
    );
  }

  const result = await fetchRecipeFromUrl(url.toString());
  if (!result.ok) {
    await releaseAiParse(contributorId); // no recipe produced — refund
    // Structured log so we can spot which sites are commonly failing.
    console.error(JSON.stringify({
      event:  'url_fetch_failed',
      url:    url.toString(),
      reason: result.reason,
      status: result.status,
    }));
    return NextResponse.json(
      { error: result.reason, status: result.status },
      // Always 200 — client uses the JSON body to decide what to render.
      { status: 200 },
    );
  }

  // JSON-LD parsing used no AI — only the ai-fallback path actually spent a
  // model call, so refund the slot otherwise.
  if (result.via !== 'ai-fallback') {
    await releaseAiParse(contributorId);
  }

  return NextResponse.json({
    ok:        true,
    recipe:    result.recipe,
    via:       result.via,
    sourceUrl: result.sourceUrl,
  });
}
