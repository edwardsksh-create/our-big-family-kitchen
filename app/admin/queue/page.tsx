import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const metadata = { title: 'Admin queue' };
export const dynamic   = 'force-dynamic';

const FLAG_TAG_SLUGS = new Set([
  'needs-instructions',
  'low-confidence',
  'multi-recipe',
  'possible-duplicate',
]);
const BULK_TAG_SLUGS = new Set(['bulk-import']);

type SortKey = 'newest' | 'confidence' | 'multi';
const VALID_SORTS: SortKey[] = ['newest', 'confidence', 'multi'];

function parseSort(raw: string | undefined): SortKey {
  return raw && (VALID_SORTS as string[]).includes(raw) ? (raw as SortKey) : 'newest';
}

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/queue');
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16 text-center">
        <p className="label mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-ink">Admins only.</h1>
        <p className="mt-2 text-ink-soft">This page is just for Kate.</p>
      </div>
    );
  }

  const sort = parseSort(searchParams.sort);
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

  type Row = {
    id: string;
    title: string;
    slug: string | null;
    created_at: string;
    contributor: { name: string | null; email: string } | null;
    section:     { name: string } | null;
    tags:        { tag: { slug: string; name: string } | null }[];
  };
  const rows = (data ?? []) as unknown as Row[];

  // In-JS sort. The default 'newest' shows newest first (DB query is unordered
  // — we sort here to keep all sort variants in one place).
  const rowsWithTags = rows.map((r) => {
    const slugs = r.tags.map((t) => t.tag?.slug).filter(Boolean) as string[];
    return {
      ...r,
      tagSlugs: slugs,
      isLowConf:    slugs.includes('low-confidence'),
      isMulti:      slugs.includes('multi-recipe'),
      isDup:        slugs.includes('possible-duplicate'),
    };
  });

  function sortRows<T extends typeof rowsWithTags[number]>(arr: T[]): T[] {
    const newestFirst = (a: T, b: T) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    switch (sort) {
      case 'confidence': {
        return [...arr].sort((a, b) => {
          const a1 = a.isLowConf ? 0 : 1;
          const b1 = b.isLowConf ? 0 : 1;
          if (a1 !== b1) return a1 - b1;
          return newestFirst(a, b);
        });
      }
      case 'multi': {
        return [...arr].sort((a, b) => {
          const a1 = a.isMulti ? 0 : 1;
          const b1 = b.isMulti ? 0 : 1;
          if (a1 !== b1) return a1 - b1;
          return newestFirst(a, b);
        });
      }
      case 'newest':
      default:
        return [...arr].sort(newestFirst);
    }
  }

  const sortedRows = sortRows(rowsWithTags);

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'newest',     label: 'Newest first' },
    { value: 'confidence', label: 'Confidence: lowest first' },
    { value: 'multi',      label: 'Multi-recipe candidates' },
  ];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Admin</p>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-serif text-4xl text-ink md:text-5xl">Review queue</h1>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="sort" className="label">Sort</label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-rule bg-paper px-3 py-1.5 font-sans text-sm text-ink shadow-sm"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-rule px-3 py-1.5 font-sans text-sm text-ink-soft hover:text-ink"
          >
            Apply
          </button>
        </form>
      </div>
      <p className="mt-3 max-w-prose text-ink-soft">
        Recipes contributors have submitted for review. Open one to review and publish.
      </p>

      {sortedRows.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">Queue is empty.</p>
          <p className="mt-2 text-sm text-ink-soft">Nothing waiting on you right now.</p>
        </div>
      ) : (
        <table className="mt-10 w-full text-left">
          <thead>
            <tr className="label border-b border-rule">
              <th className="py-3">Title</th>
              <th className="py-3">Contributor</th>
              <th className="py-3">Section</th>
              <th className="py-3">Flags</th>
              <th className="py-3">Submitted</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const tagSlugs = r.tagSlugs;
              const flags = tagSlugs.filter((s) => FLAG_TAG_SLUGS.has(s));
              const isBulk = tagSlugs.some((s) => BULK_TAG_SLUGS.has(s));
              return (
                <tr key={r.id} className="border-b border-rule">
                  <td className="py-3 font-serif text-ink">
                    {r.title}
                    {isBulk && (
                      <span className="ml-2 align-middle rounded-full bg-card-mauve px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-paper">
                        bulk
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-ink-soft">
                    {r.contributor?.name ?? r.contributor?.email ?? '—'}
                  </td>
                  <td className="py-3 text-ink-soft">{r.section?.name ?? '—'}</td>
                  <td className="py-3">
                    {flags.length === 0 ? (
                      <span className="text-ink-soft">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {flags.map((slug) => (
                          <span
                            key={slug}
                            className="rounded-full bg-card-burgundy px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-paper"
                          >
                            {slug.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-ink-soft">
                    {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </td>
                  <td className="py-3 space-x-4">
                    <Link
                      href={`/admin/queue/${r.id}/review`}
                      className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
                    >
                      Review
                    </Link>
                    {r.slug && (
                      <Link
                        href={`/recipes/${r.slug}`}
                        className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-primary"
                      >
                        Preview
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
