import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/auth/supabase-token';
import { parseRecipeFromPhotoUrls } from '@/lib/photos/intake';
import { resolveParseActor, reserveAiParse, releaseAiParse } from '@/lib/recipes/ai-usage';

export const maxDuration = 90;
export const dynamic     = 'force-dynamic';

// POST /api/v1/photos/parse   — the native headline feature (recipe-card scan).
//
// The /api/v1 twin of /api/photos/parse: identical pipeline (same parser, same
// per-contributor AI cap), only the auth differs — a Supabase bearer token from
// the mobile bridge instead of a NextAuth cookie. Keeping the authoritative
// parse server-side means mobile results match web exactly, and the Anthropic
// key + prompts + limits never leave the server.
export async function POST(req: Request) {
  const bearer = await actorFromRequest(req);
  if (!bearer) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Resolve the contributor from the token's email — same record the web path
  // resolves from the session, so the AI cap and ownership are identical.
  const actor = await resolveParseActor(bearer.email);
  if (!actor) {
    return NextResponse.json({ error: 'not_a_contributor' }, { status: 403 });
  }

  let body: { photo_urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const urls = (body.photo_urls ?? []).filter((u): u is string => typeof u === 'string');
  if (urls.length === 0) {
    return NextResponse.json({ error: 'no_photos' }, { status: 400 });
  }
  if (urls.length > 5) {
    return NextResponse.json({ error: 'too_many' }, { status: 400 });
  }

  // Only accept photos we ourselves stored — these URLs get handed to Claude's
  // vision API to fetch. Refusing arbitrary URLs stops this being a fetch proxy.
  const allowedPrefix =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-photos/`;
  if (!urls.every((u) => u.startsWith(allowedPrefix))) {
    return NextResponse.json({ error: 'bad_photo_url' }, { status: 400 });
  }

  const reservation = await reserveAiParse(actor);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: 'ai_daily_limit', limit: reservation.limit },
      { status: 429 },
    );
  }

  try {
    const result = await parseRecipeFromPhotoUrls({ photoUrls: urls });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await releaseAiParse(actor.contributorId); // model error — refund the slot
    console.error('v1 photo parse failed', err);
    return NextResponse.json(
      { error: 'parse_failed', message: (err as Error).message },
      { status: 502 },
    );
  }
}
