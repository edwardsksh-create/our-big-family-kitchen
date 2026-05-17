import { supabaseAdmin } from '@/lib/supabase/server';

export type ContributorOption = {
  id: string;
  display: string;
  email: string;
  primary_family_line_id: string | null;
};

export type FamilyLineOption  = { id: string; slug: string; name: string };
export type SectionOption     = { id: string; slug: string; name: string };
export type TagOption         = { slug: string; name: string };

export type FormOptions = {
  contributors:  ContributorOption[];
  familyLines:   FamilyLineOption[];
  sections:      SectionOption[];
  tags:          TagOption[];
  currentContributor: ContributorOption | null;
};

export async function fetchFormOptions(currentEmail?: string | null): Promise<FormOptions> {
  const db = supabaseAdmin();
  const [contribRes, flRes, secRes, tagRes, cflRes] = await Promise.all([
    // Include viewers — stubs are valid attribution targets even though they can't sign in.
    db.from('contributors').select('id, email, name').order('name'),
    db.from('family_lines').select('id, slug, name').order('sort_order'),
    db.from('sections').select('id, slug, name').order('sort_order'),
    db.from('tags').select('slug, name').order('name'),
    db.from('contributor_family_lines').select('contributor_id, family_line_id, rank'),
  ]);

  // Primary line lookup keyed by rank='primary' only.
  const primaryFamilyByContributor = new Map<string, string>();
  for (const row of cflRes.data ?? []) {
    if (row.rank === 'primary') {
      primaryFamilyByContributor.set(row.contributor_id, row.family_line_id);
    }
  }

  const contributors: ContributorOption[] = (contribRes.data ?? []).map((c) => ({
    id:                     c.id,
    email:                  c.email,
    display:                c.name || c.email.split('@')[0],
    primary_family_line_id: primaryFamilyByContributor.get(c.id) ?? null,
  }));

  const currentContributor =
    contributors.find((c) => c.email.toLowerCase() === (currentEmail ?? '').toLowerCase()) ?? null;

  return {
    contributors,
    familyLines: flRes.data ?? [],
    sections:    secRes.data ?? [],
    tags:        tagRes.data ?? [],
    currentContributor,
  };
}
