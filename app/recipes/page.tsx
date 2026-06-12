import Link from 'next/link';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchRecipeIndex } from '@/lib/queries/recipes';
import { visibleInNeedsFamilyHelp, type Viewer, ANONYMOUS_VIEWER } from '@/lib/recipes/badges';
import { RecipeIndexGrid } from '@/components/recipe-index-card';
import { RecipeIndex } from '@/components/recipe-index';
import { RecipeSearchBlock } from '@/components/recipe-search-block';
import { SECTIONS, SECTION_BG, SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Recipes' };
// This page now reads the signed-in session for viewer-aware needs prompts,
// so it must render per-request rather than from the static ISR cache.
export const dynamic = 'force-dynamic';

async function resolveViewer(): Promise<Viewer> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return ANONYMOUS_VIEWER;
  const isAdmin = (session?.user?.role ?? '') === 'admin';
  const { data } = await supabaseAdmin()
    .from('contributors')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  return { isAdmin, contributorId: data?.id ?? null };
}

export default async function RecipesIndexPage() {
  const [recipes, viewer] = await Promise.all([fetchRecipeIndex(), resolveViewer()]);
  const now = Date.now();

  const recent      = recipes.slice(0, 6);
  // Needs-family-help is gated by viewer permission: admin sees every flagged
  // recipe, a contributor sees only their own, everyone else sees none and
  // the section hides itself.
  const needingHelp = recipes.filter((r) => visibleInNeedsFamilyHelp(r, viewer)).slice(0, 6);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      {/* Hero */}
      <section>
        <h1 className="font-serif text-4xl text-ink md:text-5xl">
          Everything in the kitchen so far.
        </h1>
        <p className="mt-4 max-w-prose text-lg text-ink-soft">
          Search, browse, or wander through the family recipe collection. Some
          recipes are polished and ready to cook; others are old cards, scanned
          pages, remembered favorites, or notes still waiting for someone in
          the family to fill in the details.
        </p>
      </section>

      {/* Search */}
      <section className="mt-14">
        <h2 className="font-serif text-2xl text-ink md:text-3xl">Search the recipe box</h2>
        <p className="mt-2 max-w-prose text-ink-soft">
          Look for a recipe by name, ingredient, contributor, family line, or
          the dish someone always brings.
        </p>
        <RecipeSearchBlock />
      </section>

      {/* Browse by recipe type */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl text-ink md:text-3xl">Browse by recipe type</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/sections/${s.slug}`}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2 font-serif text-sm transition-transform card-hover md:text-base',
                  SECTION_BG[s.color],
                  SECTION_TEXT[s.color],
                )}
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Recently added */}
      {recent.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Recently added</h2>
          <div className="mt-6">
            <RecipeIndexGrid recipes={recent} viewer={viewer} now={now} plain />
          </div>
        </section>
      )}

      {/* Needs family help — hidden when this viewer has nothing actionable. */}
      {needingHelp.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Needs family help</h2>
          <p className="mt-2 max-w-prose text-ink-soft">
            These recipes are missing a method, a memory, a photo, or someone&rsquo;s best guess.
          </p>
          <div className="mt-6">
            <RecipeIndexGrid recipes={needingHelp} viewer={viewer} now={now} plain />
          </div>
        </section>
      )}

      {/* All recipes */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl text-ink md:text-3xl">All recipes</h2>
        <p className="mt-2 max-w-prose text-ink-soft">
          Browse the full collection, or use search and filters to narrow it down.
        </p>
        <div className="mt-6">
          <RecipeIndex recipes={recipes} viewer={viewer} now={now} />
        </div>
      </section>
    </div>
  );
}
