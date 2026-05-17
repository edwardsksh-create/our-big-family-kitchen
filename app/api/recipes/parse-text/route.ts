import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseRecipeFromText } from '@/lib/recipe-parser';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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

  try {
    const recipe = await parseRecipeFromText(text);
    return NextResponse.json({ recipe });
  } catch (err) {
    console.error('parse-text failed', err);
    return NextResponse.json({ error: 'parse_failed' }, { status: 502 });
  }
}
