import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchRecipeFromUrl } from '@/lib/recipe-from-url';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return NextResponse.json({ error: 'bad_protocol' }, { status: 400 });
  }

  const result = await fetchRecipeFromUrl(url.toString());
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, message: result.message, status: result.status },
      { status: result.reason === 'fetch_failed' ? 502 : 422 },
    );
  }
  return NextResponse.json({
    recipe:    result.recipe,
    via:       result.via,
    sourceUrl: result.sourceUrl,
  });
}
