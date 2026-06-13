'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { FAMILY } from '@/config/family';
import type { VisibilityMap, SiteArea } from '@/lib/access';

const AREAS = Object.keys(FAMILY.visibility) as SiteArea[];

export type SaveVisibilityResult = { ok: true } | { ok: false; error: string };

/** Persist the per-area visibility map. Admin-only. Writes the whole map as
 *  one site_settings row (key 'visibility'); lib/access.ts reads it back,
 *  merged over the config defaults. */
export async function saveVisibility(next: VisibilityMap): Promise<SaveVisibilityResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'unauthorized' };
  if (session.user.role !== 'admin') return { ok: false, error: 'admin_only' };

  // Never trust the client to hand us arbitrary keys/values — rebuild the
  // map from the known areas only, rejecting anything that isn't a valid
  // public/private literal.
  const clean: Record<SiteArea, string> = {} as Record<SiteArea, string>;
  for (const area of AREAS) {
    const v = next?.[area];
    if (v !== 'public' && v !== 'private') return { ok: false, error: 'bad_value' };
    clean[area] = v;
  }

  const { error } = await supabaseAdmin()
    .from('site_settings')
    .upsert(
      {
        key: 'visibility',
        value: clean,
        updated_at: new Date().toISOString(),
        updated_by: session.user.contributorId ?? null,
      },
      { onConflict: 'key' },
    );
  if (error) return { ok: false, error: 'db_write_failed' };

  // Visibility drives the header (on every page), the home page, the sitemap,
  // and each area's gate layout. Clear the whole tree so the change is live
  // immediately rather than on the next natural revalidation.
  revalidatePath('/', 'layout');
  return { ok: true };
}
