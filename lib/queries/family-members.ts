import { supabaseAdmin } from '@/lib/supabase/server';

export type FamilyMember = {
  id: string;
  name: string;
  nickname:        string | null;
  birth_name:      string | null;
  deceased:        boolean;
  contributor_slug: string | null;
  notes:           string | null;
  sort_order:      number;
};

export async function fetchFamilyMembersForLine(familyLineSlug: string): Promise<FamilyMember[]> {
  const db = supabaseAdmin();
  const { data: line } = await db
    .from('family_lines')
    .select('id')
    .eq('slug', familyLineSlug)
    .maybeSingle();
  if (!line) return [];
  const { data } = await db
    .from('family_members')
    .select('id, name, nickname, birth_name, deceased, contributor_slug, notes, sort_order')
    .eq('family_line_id', line.id)
    .order('sort_order');
  return (data ?? []) as FamilyMember[];
}

// Map of family-line slug → ordered list of formatted member names. Used by
// the /family-lines index cards.
export async function fetchMemberNamesByLine(): Promise<Record<string, string[]>> {
  const db = supabaseAdmin();
  const [{ data: lines }, { data: members }] = await Promise.all([
    db.from('family_lines').select('id, slug'),
    db.from('family_members').select('family_line_id, name, sort_order').order('sort_order'),
  ]);
  const slugById = new Map((lines ?? []).map((l) => [l.id, l.slug]));
  const out: Record<string, string[]> = {};
  for (const m of members ?? []) {
    const slug = slugById.get(m.family_line_id);
    if (!slug) continue;
    (out[slug] ??= []).push(m.name);
  }
  return out;
}
