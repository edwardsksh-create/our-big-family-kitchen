import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchAllContributors } from '@/lib/queries/contributors';

export const metadata = { title: 'Admin · Contributors' };
export const dynamic  = 'force-dynamic';

export default async function AdminContributorsPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/admin/contributors');
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16 text-center">
        <p className="label mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-ink">Admins only.</h1>
      </div>
    );
  }

  const all = await fetchAllContributors();

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">
        <Link href="/admin/queue" className="hover:text-primary">Admin</Link>
        {' · '}
        Contributors
      </p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">Edit contributors</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Update names, bios, family-line affiliations, or upgrade stubs to
        full contributors by adding an email.
      </p>

      <table className="mt-12 w-full text-left">
        <thead>
          <tr className="label border-b border-rule">
            <th className="py-3">Name</th>
            <th className="py-3">Role</th>
            <th className="py-3">Primary</th>
            <th className="py-3">Secondary</th>
            <th className="py-3" />
          </tr>
        </thead>
        <tbody>
          {all.map((c) => (
            <tr key={c.id} className="border-b border-rule">
              <td className="py-3 font-serif text-ink">
                {c.name}
                {!c.joined_at && c.role === 'viewer' && (
                  <span className="ml-2 align-middle rounded-full bg-card-mauve px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-paper">
                    stub
                  </span>
                )}
              </td>
              <td className="py-3 label">{c.role}</td>
              <td className="py-3 text-ink-soft">{c.primary_family_line?.name ?? '—'}</td>
              <td className="py-3 text-ink-soft">{c.secondary_family_line?.name ?? '—'}</td>
              <td className="py-3">
                <Link
                  href={`/admin/contributors/${c.slug}/edit`}
                  className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
