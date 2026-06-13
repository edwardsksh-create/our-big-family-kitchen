import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseRecipeFromPhotoUrls } from '@/lib/photos/intake';
import { contributorIdForEmail, reserveAiParse, releaseAiParse } from '@/lib/recipes/ai-usage';

export const maxDuration = 90;
export const dynamic     = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const contributorId = await contributorIdForEmail(session.user.email);
  if (!contributorId) {
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
  // vision API to fetch. Refusing arbitrary URLs stops this endpoint from being
  // used as a fetch proxy.
  const allowedPrefix =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-photos/`;
  if (!urls.every((u) => u.startsWith(allowedPrefix))) {
    return NextResponse.json({ error: 'bad_photo_url' }, { status: 400 });
  }

  // Vision parsing always spends AI — reserve a slot first.
  const reservation = await reserveAiParse(contributorId);
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
    await releaseAiParse(contributorId); // model error — refund the slot
    console.error('photo parse failed', err);
    return NextResponse.json(
      { error: 'parse_failed', message: (err as Error).message },
      { status: 502 },
    );
  }
}
