'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export type HeroToggleResult = { ok: true; heroEligible: boolean } | { ok: false; error: string };

/** Admin-only: opt a photo in or out of the PUBLIC home-page hero rotation.
 *  Explicit per-photo consent is the privacy boundary — the album is
 *  sign-in-only, the home page is not. */
export async function setHeroEligible(photoId: string, eligible: boolean): Promise<HeroToggleResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return { ok: false, error: 'not_authorized' };
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('family_photos')
    .update({ hero_eligible: eligible })
    .eq('id', photoId);
  if (error) {
    console.error('setHeroEligible failed:', error);
    return { ok: false, error: 'update_failed' };
  }

  revalidatePath('/');
  revalidatePath('/album');
  return { ok: true, heroEligible: eligible };
}
