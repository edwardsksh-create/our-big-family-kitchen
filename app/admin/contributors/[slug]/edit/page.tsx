import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchContributorBySlug } from '@/lib/queries/contributors';
import { fetchFormOptions } from '@/lib/recipes/form-options';
import { AdminContributorEditor } from '@/components/admin/contributor-editor';

export const metadata = { title: 'Edit contributor' };
export const dynamic  = 'force-dynamic';

export default async function AdminContributorEditPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user) redirect(`/sign-in?next=/admin/contributors/${params.slug}/edit`);
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16 text-center">
        <p className="label mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-ink">Admins only.</h1>
      </div>
    );
  }

  const [contributor, options] = await Promise.all([
    fetchContributorBySlug(params.slug),
    fetchFormOptions(session.user.email),
  ]);
  if (!contributor) notFound();

  return (
    <div className="mx-auto max-w-page px-6 py-12">
      <p className="label mb-3">
        <Link href="/admin/contributors" className="hover:text-primary">Admin · Contributors</Link>
        {' · '}
        Edit
      </p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">{contributor.name}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {contributor.role}
        {!contributor.joined_at && contributor.role === 'viewer' && ' · stub (no sign-in)'}
      </p>

      <AdminContributorEditor
        contributor={{
          id:                       contributor.id,
          name:                     contributor.name,
          email:                    contributor.email,
          bio:                      contributor.bio ?? '',
          role:                     contributor.role,
          can_publish:              contributor.can_publish,
          can_edit_photos:          contributor.can_edit_photos,
          primary_family_line_id:   findFamilyLineId(options.familyLines, contributor.primary_family_line?.slug),
          secondary_family_line_id: findFamilyLineId(options.familyLines, contributor.secondary_family_line?.slug),
        }}
        familyLines={options.familyLines}
      />
    </div>
  );
}

function findFamilyLineId(
  familyLines: { id: string; slug: string }[],
  slug?: string,
): string | undefined {
  if (!slug) return undefined;
  return familyLines.find((f) => f.slug === slug)?.id;
}
