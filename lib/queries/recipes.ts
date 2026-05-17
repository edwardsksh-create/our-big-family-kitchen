import { supabaseAdmin } from '@/lib/supabase/server';

export type NativeRecipeSummary = {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  contributor_name: string | null;
  section_slug:     string | null;
  section_name:     string | null;
  primary_family_line_slug: string | null;
};

type RawRow = {
  id: string;
  slug: string | null;
  title: string;
  published_at: string;
  contributor: { name: string | null; email: string } | null;
  section: { slug: string; name: string } | null;
  primary_family_line: { slug: string } | null;
};

function toSummary(row: RawRow): NativeRecipeSummary | null {
  if (!row.slug) return null;
  return {
    id:              row.id,
    slug:            row.slug,
    title:           row.title,
    published_at:    row.published_at,
    contributor_name: row.contributor?.name ?? row.contributor?.email.split('@')[0] ?? null,
    section_slug:     row.section?.slug ?? null,
    section_name:     row.section?.name ?? null,
    primary_family_line_slug: row.primary_family_line?.slug ?? null,
  };
}

export async function fetchRecentPublishedRecipes(limit = 6): Promise<NativeRecipeSummary[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as RawRow[]).map(toSummary).filter(Boolean) as NativeRecipeSummary[];
}

export async function fetchPublishedRecipesForSection(sectionSlug: string): Promise<NativeRecipeSummary[]> {
  const db = supabaseAdmin();
  const { data: section } = await db.from('sections').select('id').eq('slug', sectionSlug).maybeSingle();
  if (!section) return [];
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('status', 'published')
    .eq('section_id', section.id)
    .order('published_at', { ascending: false });
  return ((data ?? []) as unknown as RawRow[]).map(toSummary).filter(Boolean) as NativeRecipeSummary[];
}

export async function fetchPublishedRecipesForFamilyLine(familyLineSlug: string): Promise<NativeRecipeSummary[]> {
  const db = supabaseAdmin();
  const { data: fl } = await db.from('family_lines').select('id').eq('slug', familyLineSlug).maybeSingle();
  if (!fl) return [];
  const { data } = await db
    .from('recipes')
    .select(`
      id, slug, title, published_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( slug, name ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug )
    `)
    .eq('status', 'published')
    .or(`primary_family_line_id.eq.${fl.id},secondary_family_line_id.eq.${fl.id}`)
    .order('published_at', { ascending: false });
  return ((data ?? []) as unknown as RawRow[]).map(toSummary).filter(Boolean) as NativeRecipeSummary[];
}
