'use server';

import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ContributorOption } from '@/lib/recipes/form-options';
import { FAMILY } from '@/config/family';

export type CreateStubInput = {
  name:                  string;
  familyLineId:          string;
  secondaryFamilyLineId?: string;
  email?:                string;
};

export type CreateStubResult =
  | { ok: true; contributor: ContributorOption }
  | { ok: false; error: string };

export async function createContributorStub(
  input: CreateStubInput,
): Promise<CreateStubResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'unauthorized' };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'name_too_short' };
  if (name.length > 120) return { ok: false, error: 'name_too_long' };
  if (!input.familyLineId) return { ok: false, error: 'family_line_required' };

  const db = supabaseAdmin();

  // Only admins and contributors can create stubs.
  const { data: actor } = await db
    .from('contributors')
    .select('id, role')
    .ilike('email', session.user.email)
    .maybeSingle();
  if (!actor) return { ok: false, error: 'unauthorized' };
  if (actor.role !== 'admin' && actor.role !== 'contributor') {
    return { ok: false, error: 'unauthorized' };
  }

  const email = (input.email ?? '').trim().toLowerCase();

  // contributors.email is NOT NULL UNIQUE — for stubs without a real email,
  // we synthesize a placeholder that's unique per name.
  const finalEmail = email
    || `stub+${slugForEmail(name)}-${Date.now()}${FAMILY.stubEmailSuffix}`;

  // Check for collision on real email.
  if (email) {
    const { data: existing } = await db
      .from('contributors')
      .select('id, name, email, role')
      .ilike('email', email)
      .maybeSingle();
    if (existing) {
      return { ok: false, error: 'email_taken' };
    }
  }

  const { data: inserted, error: insErr } = await db
    .from('contributors')
    .insert({
      email:         finalEmail,
      name,
      role:          'viewer',
      joined_at:     null,
      invited_at:    null,
      invited_by_id: actor.id,
    })
    .select('id, email')
    .single();
  if (insErr || !inserted) {
    console.error('create-stub insert failed', insErr);
    return { ok: false, error: 'db_insert_failed' };
  }

  const links: { contributor_id: string; family_line_id: string; rank: 'primary' | 'secondary' }[] = [
    { contributor_id: inserted.id, family_line_id: input.familyLineId, rank: 'primary' },
  ];
  if (input.secondaryFamilyLineId && input.secondaryFamilyLineId !== input.familyLineId) {
    links.push({
      contributor_id: inserted.id,
      family_line_id: input.secondaryFamilyLineId,
      rank:           'secondary',
    });
  }
  const { error: linkErr } = await db.from('contributor_family_lines').insert(links);
  if (linkErr) {
    console.error('create-stub family-line link failed', linkErr);
  }

  return {
    ok: true,
    contributor: {
      id:                     inserted.id,
      email:                  inserted.email,
      display:                name,
      primary_family_line_id: input.familyLineId,
    },
  };
}

function slugForEmail(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'contributor';
}
