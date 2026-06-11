import Image from 'next/image';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sectionBySlug, type SectionColorToken } from '@/lib/sections';
import { publicUrl } from '@/lib/storage/photos';
import { publicStatusNotes } from '@/lib/recipes/status-notes';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { fetchPhotosForRecipe } from '@/lib/queries/family-photos';
import { fetchCommentsForRecipe } from '@/lib/queries/recipe-comments';
import { RecipeComments } from '@/components/recipe-comments';
import { SIGNED_OUT_COMMENT_VIEWER, type CommentViewer } from '@/lib/recipes/comment-permissions';
import { slugify } from '@/lib/utils';

// Comments need the signed-in viewer's contributor row to decide who can
// post or delete; that has to be fresh per request rather than served from
// the static ISR cache.
export const dynamic = 'force-dynamic';

type ContribJoin = {
  id: string;
  name: string | null;
  email: string;
  nickname: string | null;
  birth_name: string | null;
};

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
  contributor:           ContribJoin | null;
  added_by:              ContribJoin | null;
  last_edited_by:        ContribJoin | null;
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
      contributor:contributors!recipes_contributor_id_fkey ( id, name, email, nickname, birth_name ),
      added_by:contributors!recipes_added_by_id_fkey ( id, name, email, nickname, birth_name ),
      last_edited_by:contributors!recipes_last_edited_by_id_fkey ( id, name, email, nickname, birth_name ),
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

  const [{ data: ingredients }, { data: instructions }, { data: tagJoins }, { data: photoRows }, familyPhotos, comments] = await Promise.all([
    db.from('ingredients').select('sub_header, item_text, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('instructions').select('sub_header, body, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    db.from('recipe_tags').select('tag:tags!recipe_tags_tag_id_fkey(slug, name)').eq('recipe_id', recipe.id),
    db.from('photos').select('id, url, storage_path, caption, photo_type, sort_order').eq('recipe_id', recipe.id).order('sort_order'),
    fetchPhotosForRecipe(recipe.id),
    fetchCommentsForRecipe(recipe.id),
  ]);

  // Resolve the comment viewer — needs the viewer's contributor id and
  // can_sign_in to decide who can post / who can delete.
  let commentViewer: CommentViewer = SIGNED_OUT_COMMENT_VIEWER;
  if (session?.user?.email) {
    const { data: viewerRow } = await db
      .from('contributors')
      .select('id, can_sign_in')
      .ilike('email', session.user.email)
      .maybeSingle();
    if (viewerRow) {
      commentViewer = {
        isAdmin,
        contributorId: viewerRow.id,
        canSignIn:     !!viewerRow.can_sign_in,
      };
    }
  }

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
  // The "Saved by" provenance uses added_by_id (who saved the recipe to the
  // site); falls back to the contributor (original author) if the column is
  // null on a pre-backfill row.
  const savedBy     = recipe.added_by ?? recipe.contributor;
  const lastEditedBy = recipe.last_edited_by;
  const contributorSlug = contributor ? slugify(contributor.name || contributor.email.split('@')[0]) : null;
  const savedBySlug     = savedBy     ? slugify(savedBy.name     || savedBy.email.split('@')[0])     : null;
  const tags = ((tagJoins ?? []) as unknown as { tag: { slug: string; name: string } | null }[])
    .map((j) => j.tag).filter(Boolean) as { slug: string; name: string }[];

  const contributorDisplay = contributor
    ? formatDisplayName({
        fullName:   contributor.name || contributor.email.split('@')[0],
        nickname:   contributor.nickname,
        birth_name: contributor.birth_name,
      })
    : null;
  const savedByDisplay = savedBy
    ? formatDisplayName({
        fullName:   savedBy.name || savedBy.email.split('@')[0],
        nickname:   savedBy.nickname,
        birth_name: savedBy.birth_name,
      })
    : null;
  const lastEditedByDisplay = lastEditedBy
    ? formatDisplayName({
        fullName:   lastEditedBy.name || lastEditedBy.email.split('@')[0],
        nickname:   lastEditedBy.nickname,
        birth_name: lastEditedBy.birth_name,
      })
    : null;

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

  const statusNotes = publicStatusNotes(tags.map((t) => t.slug), recipe.originally_from);
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

      <div className="mt-3">
        {/* Byline + originally-from */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
          {contributor && contributorSlug && contributorDisplay && (
            <Link href={`/contributors/${contributorSlug}`} className="hover:text-primary">
              By {contributorDisplay}
            </Link>
          )}
          {recipe.originally_from && (
            <>
              <span>·</span>
              <span className="italic">Originally from {recipe.originally_from}</span>
            </>
          )}
        </div>

        {/* The Section appears in the breadcrumb above; a full labeled
            "At a glance" box for that single field is redundant, so it's
            been removed. If this page later grows real at-a-glance facts
            (serves, time, etc.), restore an aside here. */}

        {/* Main column body. */}
        <div className="mt-6 space-y-6">
          {/* Actionable needs-prompt. Visible ONLY to admin or this recipe's
              own contributor — the same set of viewers who can act on it.
              Admin sees the "Ask the family" CTA so they can route the
              question to any emailable family member (often someone other
              than the original contributor — e.g. a sibling for a recipe
              attributed to a deceased relative). The recipe's own
              contributor (non-admin) sees the warm self-edit prompt. */}
          {canEdit && (() => {
            const needsMethod = (instructions ?? []).length === 0;
            const needsStory  = !recipe.story || recipe.story.trim().length === 0;
            if (!needsMethod && !needsStory) return null;
            if (isAdmin) {
              return (
                <div data-no-print>
                  <NeedsPrompt
                    headline="This recipe is missing information."
                    href={`/admin/recipes/${params.slug}/ask`}
                    cta="Ask the family"
                  />
                </div>
              );
            }
            return (
              <div data-no-print>
                <NeedsPrompt
                  headline="This recipe is missing information — would you help fix it?"
                  href={`/recipes/${params.slug}/edit`}
                  cta="Add the steps"
                />
              </div>
            );
          })()}

      {/* Ingredients and Method are gated on having content. An empty
          recipe should not render a labeled header pointing at nothing —
          the actionable signal for missing pieces lives in the NeedsPrompt
          above, which only admin/contributor see. A non-contributor on an
          incomplete recipe gets a clean page with no empty headings and no
          incompleteness signal. */}
      {(ingredients ?? []).length > 0 && (
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
      )}

      {(instructions ?? []).length > 0 && (
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
      )}

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

      {familyPhotos.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink">Family photos of this recipe</h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {familyPhotos.slice(0, 3).map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-rule bg-paper">
                <Link href={`/album?photo=${p.id}`} className="block">
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={p.public_url}
                      alt={p.caption ?? 'Family photo'}
                      fill
                      sizes="(min-width: 768px) 33vw, 50vw"
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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

      {/* Provenance note (e.g. "From Lucy's recipe collection") — a quiet
          factual line, placed just before the boxed Family Note so the
          personal story is the very last thing read. Hidden entirely when
          there's no provenance to surface. */}
      {statusNotes.length > 0 && (
        <div className="mt-16 space-y-3" data-no-print>
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

      {/* Family Note — the cook's story, given a visually distinct boxed
          treatment so it reads as a personal aside rather than another body
          section. Sits just before the communal Comments layer. Hidden
          entirely when there's no story to tell — never replaced by system
          or needs-class prose. */}
      {recipe.story && recipe.story.trim().length > 0 && (
        <section className="mt-16 rounded-2xl border border-rule bg-cream/40 p-6 md:p-8">
          <h2 className="font-serif text-2xl text-ink">Family note</h2>
          <div className="prose-body mt-4 text-lg leading-relaxed text-ink-soft">
            <p>{recipe.story}</p>
          </div>
        </section>
      )}

      {/* Family memories — the communal layer that comes after the
          contributor's own note. Any signed-in family member can add one. */}
      <RecipeComments
        recipeId={recipe.id}
        recipeSlug={params.slug}
        comments={comments}
        viewer={commentViewer}
      />

      <footer className="hairline mt-16 space-y-1 pt-6 text-xs italic text-ink-soft/70">
        {savedBy && savedByDisplay && (
          <p>
            Saved by{' '}
            {savedBySlug ? (
              <Link href={`/contributors/${savedBySlug}`} className="not-italic hover:text-primary">
                {savedByDisplay}
              </Link>
            ) : (
              <span className="not-italic">{savedByDisplay}</span>
            )}
            {recipe.published_at && (
              <> on {new Date(recipe.published_at).toLocaleDateString('en-US', { dateStyle: 'long' })}</>
            )}
            .
          </p>
        )}
        {showLastEdited && lastEditedBy && lastEditedByDisplay && (
          <p>
            Last edited by{' '}
            {lastEditorSlug ? (
              <Link href={`/contributors/${lastEditorSlug}`} className="not-italic hover:text-primary">
                {lastEditedByDisplay}
              </Link>
            ) : (
              <span className="not-italic">{lastEditedByDisplay}</span>
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

/** Actionable prompt rendered on the recipe detail page when the viewer can
 *  fix the gap (admin or the recipe's contributor). Warm accent treatment so
 *  it reads as an invitation rather than a cold "incomplete" badge. */
function NeedsPrompt({
  headline,
  href,
  cta,
}: {
  headline: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-4">
      <p className="font-serif text-base italic text-ink">{headline}</p>
      <p className="mt-2">
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink"
        >
          {cta} →
        </Link>
      </p>
    </div>
  );
}
