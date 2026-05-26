// Shared sort + "next-pending" logic for the admin review flow.
// The queue page renders a sorted list; the review page uses the same
// sort to know what the "next" recipe is so Approve/Reject can advance.

import { supabaseAdmin } from '@/lib/supabase/server';

export type QueueSort = 'newest' | 'confidence';
export const VALID_SORTS: QueueSort[] = ['newest', 'confidence'];

export function parseSort(raw: string | undefined | null): QueueSort {
  return raw && (VALID_SORTS as string[]).includes(raw) ? (raw as QueueSort) : 'newest';
}

export type QueueRow = {
  id: string;
  title: string;
  slug: string | null;
  created_at: string;
  contributor: { name: string | null; email: string } | null;
  section:     { name: string } | null;
  tags:        { tag: { slug: string; name: string } | null }[];
};

export type QueueRowWithFlags = QueueRow & {
  tagSlugs: string[];
  isLowConf: boolean;
  isDup:     boolean;
};

export function annotate(rows: QueueRow[]): QueueRowWithFlags[] {
  return rows.map((r) => {
    const slugs = r.tags.map((t) => t.tag?.slug).filter(Boolean) as string[];
    return {
      ...r,
      tagSlugs: slugs,
      isLowConf: slugs.includes('low-confidence'),
      isDup:     slugs.includes('possible-duplicate'),
    };
  });
}

export function sortQueue<T extends QueueRowWithFlags>(arr: T[], sort: QueueSort): T[] {
  const newestFirst = (a: T, b: T) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  switch (sort) {
    case 'confidence':
      return [...arr].sort((a, b) => {
        const a1 = a.isLowConf ? 0 : 1;
        const b1 = b.isLowConf ? 0 : 1;
        if (a1 !== b1) return a1 - b1;
        return newestFirst(a, b);
      });
    case 'newest':
    default:
      return [...arr].sort(newestFirst);
  }
}

export async function fetchPendingQueue(): Promise<QueueRowWithFlags[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, title, slug, created_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( name ),
      tags:recipe_tags ( tag:tags!recipe_tags_tag_id_fkey ( slug, name ) )
    `)
    .eq('status', 'pending_review');
  return annotate((data ?? []) as unknown as QueueRow[]);
}

/**
 * Position and next-id for a given recipe in the current sort. Returns
 * nextId=null when there's no recipe after this one (end of queue).
 * Returns pos=null when the recipe isn't in the pending list (e.g. the
 * reviewer landed on an out-of-band URL or the recipe was already reviewed).
 */
export function locateInQueue(
  rows: QueueRowWithFlags[],
  sort: QueueSort,
  currentId: string,
): { pos: number | null; total: number; nextId: string | null } {
  const sorted = sortQueue(rows, sort);
  const total = sorted.length;
  const idx = sorted.findIndex((r) => r.id === currentId);
  if (idx === -1) return { pos: null, total, nextId: sorted[0]?.id ?? null };
  const nextId = sorted[idx + 1]?.id ?? null;
  return { pos: idx + 1, total, nextId };
}
