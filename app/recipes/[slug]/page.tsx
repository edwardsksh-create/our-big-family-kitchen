import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { SECTION_BG, SECTION_TEXT, type SectionColorToken } from '@/lib/sections';
import { cn, slugify } from '@/lib/utils';

export const revalidate = 60;

type RecipeRow = {
  id: string;
  title: string;
  slug: string | null;
  story: string | null;
  originally_from: string | null;
  status: 'draft' | 'pending_review' | 'published' | 'rejected';
  published_at: string | null;
  created_at: string;
  contributor:           { id: string; name: string | null; email: string } | null;
  primary_family_line:   { slug: string; name: string } | null;
  secondary_family_line: { slug: string; name: string } | null;
  section:               { slug: string; name: string; color_token: SectionColorToken } | null;
};

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const db = supabaseAdmin();
  const { data } = await db
    .from('recipes')
    .select('title')
    .eq('slug', params.slug)
    .maybeSingle();
  return { title: data?.title ?? 'Recipe' };
}

export default async function RecipePage({ params }: { params: { slug: string } }) {
  const session = await auth();
  const db = supabaseAdmin();

  const { data } = await db
    .from('recipes')
    .select(`
      id, title, slug, story, originally_from, status, published_at, created_at,
      contributor:contributors!recipes_contributor_id_fkey ( id, name, email ),
      primary_family_line:family_lines!recipes_primary_family_line_id_fkey ( slug, name ),
      secondary_family_line:family_lines!recipes_secondary_family_line_id_fkey ( slug, name ),
      section:sections!recipes_section_id_fkey ( slug, name, color_token )
    `)
    .eq('slug', params.slug)
    .maybeSingle();

  const recipe = data as RecipeRow | null;
  if (!recipe) notFound();

  const isOwner =
    !!session?.user?.email &&
    !!recipe.contributor &&
    recipe.contributor.email.toLowerCase() === session.user.email.toLowerCase();
  const isAdmin = (session?.user?.role ?? '') === 'admin';
  const visible = recipe.status === 'published' || isOwner || isAdmin;
  if (!visible) notFound();

  const [{ data: ingredients }, { data: instructions }, { data: tagJoins }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('recipe_tags').select('tag:tags!recipe_tags_tag_id_fkey(slug, name)').eq('recipe_id', recipe.id),
  ]);

  const contributor = recipe.contributor;
  const contributorSlug = contributor ? slugify(contributor.name || contributor.email.split('@')[0]) : null;
  const tags = ((tagJoins ?? []) as unknown as { tag: { slug: string; name: string } | null }[])
    .map((j) => j.tag).filter(Boolean) as { slug: string; name: string }[];

  return (
    <article className="mx-auto max-w-prose px-6 py-12">
      {/* Status banners */}
      {recipe.status === 'draft' && (
        <div className="mb-8 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">This recipe is a draft</span> — only you and Kate can see it.
        </div>
      )}
      {recipe.status === 'pending_review' && (
        <div className="mb-8 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">Pending review</span> — Kate will take a look.
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="label mb-6 flex flex-wrap items-center gap-2">
        {recipe.primary_family_line && (
          <>
            <Link href={`/family-lines/${recipe.primary_family_line.slug}`} className="hover:text-primary">
              {recipe.primary_family_line.name}
            </Link>
            <span>·</span>
          </>
        )}
        {recipe.section && (
          <Link href={`/sections/${recipe.section.slug}`} className="hover:text-primary">
            {recipe.section.name}
          </Link>
        )}
      </nav>

      <h1 className="font-serif text-4xl leading-tight text-primary md:text-5xl">{recipe.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
        {contributor && contributorSlug && (
          <Link href={`/contributors/${contributorSlug}`} className="hover:text-primary">
            By {contributor.name || contributor.email.split('@')[0]}
          </Link>
        )}
        {recipe.originally_from && (
          <>
            <span>·</span>
            <span className="italic">Originally from {recipe.originally_from}</span>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {recipe.primary_family_line && (
          <span className="label rounded-full border border-rule px-3 py-1">{recipe.primary_family_line.name}</span>
        )}
        {recipe.secondary_family_line && (
          <span className="label rounded-full border border-rule px-3 py-1">{recipe.secondary_family_line.name}</span>
        )}
        {recipe.section && (
          <span
            className={cn(
              'label rounded-full px-3 py-1',
              SECTION_BG[recipe.section.color_token],
              SECTION_TEXT[recipe.section.color_token],
            )}
            style={{ color: 'inherit', opacity: 0.95 }}
          >
            {recipe.section.name}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t.slug} className="rounded-full bg-paper border border-rule px-3 py-1 text-xs text-ink-soft">
              {t.name}
            </li>
          ))}
        </ul>
      )}

      {recipe.story && (
        <div className="prose-body mt-10 max-w-prose text-lg font-serif italic text-ink-soft">
          <p>{recipe.story}</p>
        </div>
      )}

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-ink">Ingredients</h2>
        <ul className="mt-4 space-y-1 text-ink-soft">
          {(ingredients ?? []).map((i, idx) => (
            <li key={idx}>
              {i.sub_header && (
                <p className="mt-4 font-serif text-base italic text-primary">{i.sub_header}</p>
              )}
              <span>{i.item_text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-ink">Method</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-5 text-ink-soft">
          {(instructions ?? []).map((i, idx) => (
            <li key={idx}>
              {i.sub_header && (
                <p className="mb-1 -ml-5 font-serif text-base italic text-primary">{i.sub_header}</p>
              )}
              <span>{i.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="hairline mt-16 pt-6 text-sm text-ink-soft">
        {contributor && (
          <p>
            Added by <span className="font-serif italic">{contributor.name || contributor.email.split('@')[0]}</span>
            {recipe.published_at && (
              <> on {new Date(recipe.published_at).toLocaleDateString('en-US', { dateStyle: 'long' })}</>
            )}
            .
          </p>
        )}
      </footer>
    </article>
  );
}
