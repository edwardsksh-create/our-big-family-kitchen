import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseRecipeFromPhotoUrls } from '@/lib/photos/intake';

export const maxDuration = 90;
export const dynamic     = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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

  try {
    const result = await parseRecipeFromPhotoUrls({ photoUrls: urls });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('photo parse failed', err);
    return NextResponse.json(
      { error: 'parse_failed', message: (err as Error).message },
      { status: 502 },
    );
  }
}
