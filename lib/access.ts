// Per-area visibility enforcement. Each public-facing area is independently
// 'public' or 'private'. The setting is admin-editable at runtime (stored in
// site_settings, key 'visibility', edited from /admin/visibility); config/
// family.ts → FAMILY.visibility is the default/fallback seed. A private area
// requires a signed-in user to view; a public one is open to anyone.
//
// Used two ways:
//   - requireAreaAccess(area) at the top of an area's layout — redirects a
//     logged-out visitor to sign-in when the area is private.
//   - isAreaPublic(area) on the home page, header, and sitemap to decide
//     which widgets/links to show to a logged-out visitor.
//
// Contributing, editing, and admin are gated separately (by session + role),
// independent of these read-visibility settings.
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { FAMILY } from '@/config/family';
import { supabaseAdmin } from '@/lib/supabase/server';

export type SiteArea = keyof typeof FAMILY.visibility; // 'recipes' | 'family' | 'contributors' | 'album'
export type AreaVisibility = 'public' | 'private';
export type VisibilityMap = Record<SiteArea, AreaVisibility>;

const AREAS = Object.keys(FAMILY.visibility) as SiteArea[];

/** The effective visibility for every area: the stored runtime setting merged
 *  over the config defaults. Memoized per request (React cache) so a single
 *  page render — header + page + area layout all ask — hits the DB once.
 *
 *  Fail-closed: any read error or malformed value falls back to the config
 *  default (currently all-private), so a settings glitch can over-restrict but
 *  never silently expose a private area. */
export const getVisibility = cache(async (): Promise<VisibilityMap> => {
  const defaults: VisibilityMap = { ...FAMILY.visibility };
  try {
    const { data, error } = await supabaseAdmin()
      .from('site_settings')
      .select('value')
      .eq('key', 'visibility')
      .maybeSingle();
    if (error || !data?.value || typeof data.value !== 'object') return defaults;

    const stored = data.value as Record<string, unknown>;
    const merged: VisibilityMap = { ...defaults };
    for (const area of AREAS) {
      const v = stored[area];
      if (v === 'public' || v === 'private') merged[area] = v;
    }
    return merged;
  } catch {
    return defaults;
  }
});

export async function isAreaPublic(area: SiteArea): Promise<boolean> {
  return (await getVisibility())[area] === 'public';
}

/** Redirect a logged-out visitor to sign-in when the area is private.
 *  No-op for public areas and for signed-in users. `next` is where to
 *  return after signing in (the area's landing path). */
export async function requireAreaAccess(area: SiteArea, next: string): Promise<void> {
  if (await isAreaPublic(area)) return;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
}
