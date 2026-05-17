import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const metadata = { title: 'Admin queue' };
export const dynamic   = 'force-dynamic';

export default async function AdminQueuePage() {
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

  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select(`
      id, title, slug, created_at,
      contributor:contributors!recipes_contributor_id_fkey ( name, email ),
      section:sections!recipes_section_id_fkey ( name )
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  type Row = {
    id: string;
    title: string;
    slug: string | null;
    created_at: string;
    contributor: { name: string | null; email: string } | null;
    section:     { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">Review queue</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Recipes contributors have submitted for review. Open one to review and publish.
      </p>

      {rows.length === 0 ? (
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
              <th className="py-3">Submitted</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-rule">
                <td className="py-3 font-serif text-ink">{r.title}</td>
                <td className="py-3 text-ink-soft">
                  {r.contributor?.name ?? r.contributor?.email ?? '—'}
                </td>
                <td className="py-3 text-ink-soft">{r.section?.name ?? '—'}</td>
                <td className="py-3 text-ink-soft">
                  {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                </td>
                <td className="py-3">
                  {r.slug ? (
                    <Link href={`/recipes/${r.slug}`} className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary">
                      View
                    </Link>
                  ) : (
                    <span className="text-ink-soft">No slug</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
