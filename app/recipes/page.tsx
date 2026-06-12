import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchRecipeIndex } from '@/lib/queries/recipes';
import { visibleInNeedsFamilyHelp, type Viewer, ANONYMOUS_VIEWER } from '@/lib/recipes/badges';
import { RecipeIndexGrid } from '@/components/recipe-index-card';
import { RecipeIndex } from '@/components/recipe-index';

export const metadata = { title: 'Recipes' };
// This page reads the signed-in session for viewer-aware needs prompts,
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

// THE collection page — one door for recipes. Search lives in the header
// (everywhere); recently-added lives on home; section browsing is the
// colored chip row inside the index. No lobby, just the cookbook.
export default async function RecipesIndexPage() {
  const [recipes, viewer] = await Promise.all([fetchRecipeIndex(), resolveViewer()]);
  const now = Date.now();

  // Needs-family-help is gated by viewer permission: admin sees every flagged
  // recipe, a contributor sees only their own, everyone else sees none and
  // the section hides itself.
  const needingHelp = recipes.filter((r) => visibleInNeedsFamilyHelp(r, viewer)).slice(0, 6);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <section>
        <h1 className="font-serif text-4xl text-ink md:text-5xl">
          Everything in the kitchen so far.
        </h1>
        <p className="mt-4 max-w-prose text-lg text-ink-soft">
          Some recipes are polished and ready to cook; others are old cards,
          scanned pages, remembered favorites, or notes still waiting for
          someone in the family to fill in the details.
        </p>
      </section>

      <section className="mt-12">
        <RecipeIndex recipes={recipes} viewer={viewer} now={now} />
      </section>

      {/* Needs family help — hidden when this viewer has nothing actionable. */}
      {needingHelp.length > 0 && (
        <section className="mt-20">
          <h2 className="font-serif text-2xl text-ink md:text-3xl">Needs family help</h2>
          <p className="mt-2 max-w-prose text-ink-soft">
            These recipes are missing a method, a memory, a photo, or someone&rsquo;s best guess.
          </p>
          <div className="mt-6">
            <RecipeIndexGrid recipes={needingHelp} viewer={viewer} now={now} plain />
          </div>
        </section>
      )}
    </div>
  );
}
