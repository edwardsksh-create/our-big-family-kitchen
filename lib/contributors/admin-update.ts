'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

export type AdminContributorPatch = {
  id:                    string;
  name:                  string;
  email:                 string;
  bio:                   string;
  role:                  'admin' | 'contributor' | 'viewer';
  /** Trusted-contributor flag: when true, this person's submissions publish
   *  directly. Admin is always effectively trusted regardless of this flag. */
  can_publish:           boolean;
  /** Photo-editor flag: may fix caption/year/place in the album lightbox. */
  can_edit_photos:       boolean;
  primary_family_line_id?: string;
  secondary_family_line_id?: string;
};

export type AdminContributorOutcome =
  | { ok: true; slug: string }
  | { ok: false; error: string };

const STUB_EMAIL_DOMAIN = '@ourbigfamilykitchen.local';

export async function updateContributorAsAdmin(
  patch: AdminContributorPatch,
): Promise<AdminContributorOutcome> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'unauthorized' };

  const db = supabaseAdmin();
  const { data: actor } = await db
    .from('contributors')
    .select('role')
    .ilike('email', session.user.email)
    .maybeSingle();
  if (!actor || actor.role !== 'admin') {
    return { ok: false, error: 'admin_only' };
  }

  const name = patch.name.trim();
  if (name.length < 2) return { ok: false, error: 'name_too_short' };

  let email = patch.email.trim().toLowerCase();
  if (!email) {
    // Empty email becomes a synthetic stub address so the NOT NULL UNIQUE
    // constraint is satisfied without colliding with a real address.
    email = `stub+${slugify(name)}-${Date.now()}${STUB_EMAIL_DOMAIN}`;
  }

  // If the email changed, refuse to collide with an existing contributor.
  const { data: existingWithEmail } = await db
    .from('contributors')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existingWithEmail && existingWithEmail.id !== patch.id) {
    return { ok: false, error: 'email_taken' };
  }

  // Update the contributors row.
  const { error: updErr } = await db
    .from('contributors')
    .update({
      name,
      email,
      bio:         patch.bio.trim() || null,
      role:        patch.role,
      can_publish: !!patch.can_publish,
      can_edit_photos: !!patch.can_edit_photos,
    })
    .eq('id', patch.id);
  if (updErr) {
    console.error('admin contributor update failed:', updErr);
    return { ok: false, error: 'db_update_failed' };
  }

  // Replace the contributor_family_lines rows wholesale (clean slate is
  // simpler than computing a delta, and the table is tiny).
  await db.from('contributor_family_lines').delete().eq('contributor_id', patch.id);
  const links: { contributor_id: string; family_line_id: string; rank: 'primary' | 'secondary' }[] = [];
  if (patch.primary_family_line_id) {
    links.push({
      contributor_id: patch.id,
      family_line_id: patch.primary_family_line_id,
      rank:           'primary',
    });
  }
  if (
    patch.secondary_family_line_id &&
    patch.secondary_family_line_id !== patch.primary_family_line_id
  ) {
    links.push({
      contributor_id: patch.id,
      family_line_id: patch.secondary_family_line_id,
      rank:           'secondary',
    });
  }
  if (links.length > 0) {
    const { error: cflErr } = await db.from('contributor_family_lines').insert(links);
    if (cflErr) {
      console.error('admin contributor cfl rewrite failed:', cflErr);
      return { ok: false, error: 'family_line_link_failed' };
    }
  }

  const newSlug = slugify(name);

  revalidatePath('/contributors');
  revalidatePath(`/contributors/${newSlug}`);
  revalidatePath('/admin/contributors');

  return { ok: true, slug: newSlug };
}
