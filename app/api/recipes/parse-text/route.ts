import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseRecipeFromText } from '@/lib/recipe-parser';
import { resolveParseActor, reserveAiParse, releaseAiParse } from '@/lib/recipes/ai-usage';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const actor = await resolveParseActor(session.user.email);
  if (!actor) {
    return NextResponse.json({ error: 'not_a_contributor' }, { status: 403 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const text = (body.text ?? '').trim();
  if (text.length < 20) {
    return NextResponse.json({ error: 'too_short' }, { status: 400 });
  }
  if (text.length > 30_000) {
    return NextResponse.json({ error: 'too_long' }, { status: 413 });
  }

  // Reserve an AI slot before calling the model (text parse always uses AI).
  const reservation = await reserveAiParse(actor);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: 'ai_daily_limit', limit: reservation.limit },
      { status: 429 },
    );
  }

  try {
    const recipe = await parseRecipeFromText(text);
    return NextResponse.json({ recipe });
  } catch (err) {
    await releaseAiParse(actor.contributorId); // model error — refund the slot
    console.error('parse-text failed', err);
    return NextResponse.json({ error: 'parse_failed' }, { status: 502 });
  }
}
