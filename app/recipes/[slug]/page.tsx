import Image from 'next/image';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sectionBySlug, type SectionColorToken } from '@/lib/sections';
import { publicUrl } from '@/lib/storage/photos';
import { publicStatusNotes } from '@/lib/recipes/status-notes';
import { slugify } from '@/lib/utils';

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
  last_edited_at: string | null;
  kitchen_notes: string[] | null;
  contributor:           { id: string; name: string | null; email: string } | null;
  last_edited_by:        { id: string; name: string | null; email: string } | null;
  primary_family_line:   { slug: string; name: string } | null;
  secondary_family_line: { slug: string; name: string } | null;
  section:               { slug: string; name: string; color_token: SectionColorToken } | null;
};

type PhotoRow = {
  id: string;
  url: string | null;
  storage_path: string | null;
  caption: string | null;
  photo_type: 'source' | 'dish';
  sort_order: number;
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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { msg?: string };
}) {
  const session = await auth();
  const db = supabaseAdmin();

  const { data } = await db
    .from('recipes')
    .select(`
      id, title, slug, story, originally_from, status, published_at, created_at, last_edited_at, kitchen_notes,
      contributor:contributors!recipes_contributor_id_fkey ( id, name, email ),
      last_edited_by:contributors!recipes_last_edited_by_id_fkey ( id, name, email ),
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

  // Edit privilege: admin OR original contributor. Stub/viewers (no contributor
  // row) can't edit even their own attributions until they sign up.
  const canEdit = isAdmin || isOwner;

  const [{ data: ingredients }, { data: instructions }, { data: tagJoins }, { data: photoRows }] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('recipe_tags').select('tag:tags!recipe_tags_tag_id_fkey(slug, name)').eq('recipe_id', recipe.id),
    db.from('photos').select('id, url, storage_path, caption, photo_type, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
  ]);

  const photos = ((photoRows ?? []) as PhotoRow[]).map((p) => ({
    id: p.id,
    url: p.storage_path ? publicUrl(p.storage_path) : (p.url ?? ''),
    caption: p.caption,
    photo_type: p.photo_type,
  })).filter((p) => p.url);
  const dishPhotos   = photos.filter((p) => p.photo_type === 'dish');
  const sourcePhotos = photos.filter((p) => p.photo_type === 'source');
  const heroPhoto    = dishPhotos[0] ?? null;
  const kitchenNotes = (recipe.kitchen_notes ?? []).filter((n) => n.trim().length > 0);

  const contributor = recipe.contributor;
  const lastEditedBy = recipe.last_edited_by;
  const contributorSlug = contributor ? slugify(contributor.name || contributor.email.split('@')[0]) : null;
  const tags = ((tagJoins ?? []) as unknown as { tag: { slug: string; name: string } | null }[])
    .map((j) => j.tag).filter(Boolean) as { slug: string; name: string }[];

  // Show "Last edited by X" only when the edit happened more than a day after
  // first publish (so a freshly published recipe doesn't show two near-identical lines).
  const publishedAt = recipe.published_at ? new Date(recipe.published_at) : null;
  const lastEditedAt = recipe.last_edited_at ? new Date(recipe.last_edited_at) : null;
  const showLastEdited =
    !!lastEditedAt &&
    !!lastEditedBy &&
    !!publishedAt &&
    lastEditedAt.getTime() - publishedAt.getTime() > ONE_DAY_MS;
  const lastEditorSlug = lastEditedBy
    ? slugify(lastEditedBy.name || lastEditedBy.email.split('@')[0])
    : null;

  const flashNotAllowed = searchParams.msg === 'not_allowed';

  const statusNotes = publicStatusNotes(tags.map((t) => t.slug));
  // Section display name is sourced from lib/sections.ts (canonical "and" copy)
  // rather than the DB row, which may still hold legacy "&" punctuation.
  const sectionDisplayName = recipe.section
    ? (sectionBySlug(recipe.section.slug)?.name ?? recipe.section.name)
    : null;

  return (
    <article className="mx-auto max-w-page px-6 py-12">
      {flashNotAllowed && (
        <div className="recipe-flash mb-8 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">
            Only the recipe’s contributor or an admin can edit this recipe.
          </span>
        </div>
      )}

      {/* Status banners */}
      {recipe.status === 'draft' && (
        <div className="recipe-flash mb-8 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">This recipe is a draft</span> — only you and Kate can see it.
        </div>
      )}
      {recipe.status === 'pending_review' && (
        <div className="recipe-flash mb-8 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">Pending review</span> — Kate will take a look.
        </div>
      )}

      {/* Hero finished-dish photo (first one if multiple). */}
      {heroPhoto && (
        <figure className="mb-8 overflow-hidden rounded-2xl border border-rule" data-no-print>
          <div className="relative aspect-[16/10] w-full">
            <Image
              src={heroPhoto.url}
              alt={heroPhoto.caption || recipe.title}
              fill
              priority
              sizes="(min-width: 768px) 80vw, 100vw"
              className="object-cover"
            />
          </div>
          {dishPhotos.length > 1 && (
            <figcaption className="px-4 py-2 text-sm text-ink-soft">
              {dishPhotos.length} photos of this dish
            </figcaption>
          )}
        </figure>
      )}

      {/* Breadcrumb */}
      <nav className="label mb-2 flex flex-wrap items-center gap-2">
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
            {sectionDisplayName}
          </Link>
        )}
      </nav>

      {/* Edit + Print actions — hidden in print. */}
      <p className="recipe-actions mb-4 flex flex-wrap items-center gap-4 text-sm" data-no-print>
        {canEdit && (
          <Link
            href={`/recipes/${params.slug}/edit`}
            className="font-serif italic text-ink-soft hover:text-primary"
          >
            Edit this recipe →
          </Link>
        )}
        <a
          href={`/recipes/${params.slug}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-serif italic text-ink-soft hover:text-primary"
        >
          <Printer size={14} aria-hidden="true" />
          Print recipe
        </a>
      </p>

      <h1 className="font-serif text-4xl leading-tight text-primary md:text-5xl">{recipe.title}</h1>

      {/* Title-down content: byline + body in the left column; at-a-glance
          floats at top-right via absolute positioning so its height never
          stretches main-column rows. */}
      <div className="mt-3 md:relative md:pr-[20.5rem]">
        {/* Byline + originally-from */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
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

        {/* At a glance — absolute top-right on md+, inline (full-width) on mobile. */}
        <aside
          className="mt-6 rounded-2xl border border-rule bg-cream/30 px-5 py-4 md:absolute md:right-0 md:top-0 md:mt-0 md:w-[18rem]"
          aria-label="At a glance"
          data-no-print
        >
          <p className="label mb-3 text-ink-soft">At a glance</p>
          <dl className="space-y-3 text-sm">
            {recipe.section && (
              <div>
                <dt className="label text-[10px] text-ink-soft/70">Section</dt>
                <dd className="mt-0.5">
                  <Link
                    href={`/sections/${recipe.section.slug}`}
                    className="font-serif text-base text-ink hover:text-primary"
                  >
                    {sectionDisplayName}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </aside>

        {/* Main column body — packs tightly under the byline since the aside
            is absolutely positioned and doesn't affect block flow on md+. */}
        <div className="mt-6 space-y-6">
          {statusNotes.length > 0 && (
            <div className="space-y-3" data-no-print>
              {statusNotes.map((note, i) => (
                <p
                  key={i}
                  className="rounded-xl border border-rule bg-cream/30 px-4 py-3 text-sm leading-relaxed text-ink-soft"
                >
                  <span className="font-serif italic">{note}</span>
                </p>
              ))}
            </div>
          )}

      <section className="recipe-ingredients mt-12">
        <h2 className="font-serif text-2xl text-ink">Ingredients</h2>
        <ul className="mt-4 space-y-1 text-ink-soft">
          {(ingredients ?? []).map((i, idx, arr) => {
            // Render the sub-header only when it changes from the previous row's
            // value, so recipes that repeat the sub_header on every row (e.g.
            // Marmalade soup, where every row says "For the Soup") don't print
            // the heading before each ingredient.
            const showSub = !!i.sub_header && i.sub_header !== arr[idx - 1]?.sub_header;
            return (
              <li key={idx} className="print-keep">
                {showSub && (
                  <p className="mt-4 font-serif text-base italic text-primary">{i.sub_header}</p>
                )}
                <span>{i.item_text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="recipe-instructions mt-12">
        <h2 className="font-serif text-2xl text-ink">Method</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-5 text-ink-soft">
          {(instructions ?? []).map((i, idx, arr) => {
            const showSub = !!i.sub_header && i.sub_header !== arr[idx - 1]?.sub_header;
            return (
              <li key={idx} className="print-keep">
                {showSub && (
                  <p className="mb-1 -ml-5 font-serif text-base italic text-primary">{i.sub_header}</p>
                )}
                <span>{i.body}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {kitchenNotes.length > 0 && (
        <section className="recipe-notes mt-12">
          <h2 className="font-serif text-2xl text-ink">Notes from the kitchen</h2>
          <ul className="mt-4 space-y-3 text-ink-soft">
            {kitchenNotes.map((note, idx) => (
              <li key={idx} className="font-serif italic">
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Additional dish photos in a small grid below the recipe body — only
          when there are extras beyond the hero. */}
      {dishPhotos.length > 1 && (
        <section className="mt-12" data-no-print>
          <p className="label">More photos of this dish</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dishPhotos.slice(1).map((p, i) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl border border-rule"
                  title="Open full size"
                >
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={p.url}
                      alt={p.caption || `${recipe.title} photo ${i + 2}`}
                      fill
                      sizes="(min-width: 1024px) 30vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.story && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink">Family note</h2>
          <div className="prose-body mt-4 text-lg leading-relaxed text-ink-soft">
            <p>{recipe.story}</p>
          </div>
        </section>
      )}

      {sourcePhotos.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink">Original page</h2>
          <p className="mt-2 text-ink-soft">
            {tags.some((t) => t.slug === 'lucys-recipe-collection')
              ? "Photographed from Lucy's collection."
              : 'Photographed from the original.'}
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sourcePhotos.map((p, i) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl border border-rule"
                  title="Open full size"
                >
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={p.url}
                      alt={p.caption || `Original page ${i + 1}`}
                      fill
                      sizes="(min-width: 1024px) 30vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="hairline mt-16 space-y-1 pt-6 text-xs italic text-ink-soft/70">
        {contributor && (
          <p>
            Saved by{' '}
            {contributorSlug ? (
              <Link href={`/contributors/${contributorSlug}`} className="not-italic hover:text-primary">
                {contributor.name || contributor.email.split('@')[0]}
              </Link>
            ) : (
              <span className="not-italic">
                {contributor.name || contributor.email.split('@')[0]}
              </span>
            )}
            {recipe.published_at && (
              <> on {new Date(recipe.published_at).toLocaleDateString('en-US', { dateStyle: 'long' })}</>
            )}
            .
          </p>
        )}
        {showLastEdited && lastEditedBy && (
          <p>
            Last edited by{' '}
            {lastEditorSlug ? (
              <Link href={`/contributors/${lastEditorSlug}`} className="not-italic hover:text-primary">
                {lastEditedBy.name || lastEditedBy.email.split('@')[0]}
              </Link>
            ) : (
              <span className="not-italic">
                {lastEditedBy.name || lastEditedBy.email.split('@')[0]}
              </span>
            )}
            {' '}on {lastEditedAt!.toLocaleDateString('en-US', { dateStyle: 'long' })}.
          </p>
        )}
      </footer>
        </div>
      </div>
    </article>
  );
}
