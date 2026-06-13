import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { eligibleRecipients, defaultRecipientId, type AskFamilyContext } from '@/lib/recipes/ask-family';
import { AskFamilyForm } from '@/components/admin/ask-family-form';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'Ask the family' };
export const dynamic   = 'force-dynamic';

type ContribRow = {
  id:         string;
  email:      string | null;
  name:       string | null;
  nickname:   string | null;
  birth_name: string | null;
};

export default async function AskFamilyPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user) redirect(`/sign-in?next=/admin/recipes/${params.slug}/ask`);
  if (session.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-prose px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Admin only.</h1>
        <p className="mt-4 text-ink-soft">This screen is for {FAMILY.adminName}.</p>
      </div>
    );
  }

  const db = supabaseAdmin();
  const { data: recipe } = await db
    .from('recipes')
    .select(`
      id, slug, title, contributor_id,
      contributor:contributors!recipes_contributor_id_fkey ( id, email, name, nickname, birth_name )
    `)
    .eq('slug', params.slug)
    .maybeSingle();
  if (!recipe) notFound();

  const { data: contribRows } = await db
    .from('contributors')
    .select('id, email, name, nickname, birth_name')
    .order('name');

  const baseUrl = process.env.NEXTAUTH_URL || FAMILY.baseUrl;
  const recipeUrl = `${baseUrl}/recipes/${recipe.slug}`;

  const contribDisplay = (c: ContribRow): string => {
    const fullName = c.name || (c.email ? c.email.split('@')[0] : '') || '';
    return formatDisplayName({ fullName, nickname: c.nickname, birth_name: c.birth_name });
  };

  const allContributors = (contribRows ?? []).map((c) => ({
    id:          c.id,
    displayName: contribDisplay(c as ContribRow),
    email:       c.email,
  }));

  const recipeContributorRaw = (recipe.contributor ?? null) as ContribRow | null;
  const recipeContributor = recipeContributorRaw
    ? {
        id:          recipeContributorRaw.id,
        displayName: contribDisplay(recipeContributorRaw),
        email:       recipeContributorRaw.email,
      }
    : null;

  const ctx: AskFamilyContext = { allContributors, contributor: recipeContributor };
  const recipients = eligibleRecipients(ctx);
  const defaultId  = defaultRecipientId(ctx);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="label mb-1">Admin</p>
      <h1 className="font-serif text-3xl text-ink">Ask the family</h1>
      <p className="mt-2 text-ink-soft">
        Send a note about{' '}
        <Link href={`/recipes/${recipe.slug}`} className="hover:text-primary underline decoration-rule underline-offset-4">
          {recipe.title}
        </Link>
        {recipeContributor && (
          <>
            {' '}— originally saved by{' '}
            <span className="font-serif italic">{recipeContributor.displayName}</span>.
          </>
        )}
      </p>

      <div className="mt-8">
        <AskFamilyForm
          recipeId={recipe.id}
          recipeSlug={recipe.slug as string}
          recipeTitle={recipe.title}
          recipeUrl={recipeUrl}
          contributorId={recipeContributor?.id ?? null}
          contributorName={recipeContributor?.displayName ?? ''}
          recipients={recipients}
          defaultRecipientId={defaultId}
        />
      </div>
    </div>
  );
}
