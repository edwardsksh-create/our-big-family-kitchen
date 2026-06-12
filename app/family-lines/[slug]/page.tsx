import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import { FAMILY_LINES, familyLineBySlug, FAMILY_BG } from '@/lib/family-lines';
import { fetchFederatedCount } from '@/lib/queries/federated';
import { fetchPublishedRecipesForFamilyLine } from '@/lib/queries/recipes';
import { fetchPhotosForFamilyLine } from '@/lib/queries/family-photos';
import { fetchFamilyMembersForLine, type FamilyMember } from '@/lib/queries/family-members';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { NativeRecipeGrid } from '@/components/native-recipe-card';
import { cn } from '@/lib/utils';

export const revalidate = 60;

// Slugs of family lines that have a federated mirror at leuschfamilyrecipes.com.
// For now only the Leusch line federates.
const FEDERATED_LINES: Record<string, { siteUrl: string }> = {
  leusch: { siteUrl: 'https://leuschfamilyrecipes.com' },
};

export function generateStaticParams() {
  return FAMILY_LINES.map((f) => ({ slug: f.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const line = familyLineBySlug(params.slug);
  return { title: line ? `${line.name} family recipes` : 'Family line' };
}

function MemberName({ member }: { member: FamilyMember }) {
  const formatted = formatDisplayName({
    fullName:   member.name,
    nickname:   member.nickname,
    birth_name: member.birth_name,
  });
  const inner = member.contributor_slug ? (
    <Link
      href={`/contributors/${member.contributor_slug}`}
      className="hover:text-primary"
    >
      {formatted}
    </Link>
  ) : (
    <span>{formatted}</span>
  );
  return (
    <span className="whitespace-nowrap">
      {inner}
      {member.deceased && (
        <span className="ml-1 text-xs italic text-ink-soft/70">· in loving memory</span>
      )}
    </span>
  );
}

export default async function FamilyLinePage({ params }: { params: { slug: string } }) {
  const line = familyLineBySlug(params.slug);
  if (!line) notFound();

  const federation = FEDERATED_LINES[line.slug];
  const [native, members, photos, federatedCount] = await Promise.all([
    fetchPublishedRecipesForFamilyLine(line.slug),
    fetchFamilyMembersForLine(line.slug),
    fetchPhotosForFamilyLine(line.slug, 12),
    federation ? fetchFederatedCount() : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Family line</p>
      {/* Ink heading + a short rule in the line's color — the light tokens
          (gold, sky) fail contrast as text on paper. */}
      <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">
        {line.name} family recipes
      </h1>
      <div aria-hidden="true" className={cn('mt-5 h-1.5 w-24 rounded-full', FAMILY_BG[line.color])} />
      {/* The line's blurb — the personality copy that used to live only on
          cards belongs on the page itself. */}
      <p className="mt-6 max-w-prose font-serif text-lg italic text-ink-soft">
        {line.blurb}
      </p>

      <section className="mt-8 max-w-prose">
        <p className="label mb-2 text-ink-soft">People included here</p>
        {members.length > 0 ? (
          <p className="text-base leading-relaxed text-ink">
            {members.map((m, i) => (
              <span key={m.id}>
                <MemberName member={m} />
                {i < members.length - 1 && <span className="text-ink-soft">, </span>}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-base italic text-ink-soft">Members coming soon.</p>
        )}
      </section>

      {/* Recipes from this line */}
      <section className="mt-16">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">
          Recipes from this line
        </h2>
        {native.length > 0 ? (
          <div className="mt-6">
            <NativeRecipeGrid recipes={native} />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
            <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
            <p className="mt-2 text-sm text-ink-soft">
              The first {line.name} recipes will appear here as they’re added.
            </p>
          </div>
        )}
      </section>

      {/* From the album — photos in which this line's people are tagged.
          Hidden entirely when none exist; a line with no tagged photos
          shows no empty heading. */}
      {photos.length > 0 && (
        <section className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-3xl text-ink md:text-4xl">From the album</h2>
            <Link href="/album" className="font-serif text-sm italic text-ink-soft hover:text-primary">
              The kitchen across decades →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-rule bg-paper">
                <Link href={`/album?photo=${p.id}`} className="block">
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={p.public_url}
                      alt={p.caption ?? 'Family photo'}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
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

      {/* Federated banner — Leusch only */}
      {federation && federatedCount > 0 && (
        <section className="mt-16">
          <a
            href={federation.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl border border-rule bg-paper p-8 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)] md:p-12"
          >
            <p className="font-serif italic text-primary">From Aunt Laura’s 2003 cookbook</p>
            <h2 className="font-serif mt-2 text-3xl text-ink md:text-4xl">
              {federatedCount} recipes from this family line
            </h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              The Leusch archive — every recipe with its full ingredients,
              story, and scans of the original page — lives in Aunt
              Laura&rsquo;s original collection.
            </p>
            <span className="btn-primary mt-7 inline-flex items-center gap-2">
              Browse Aunt Laura’s cookbook
              <ExternalLink size={14} aria-hidden="true" />
            </span>
            <span className="sr-only">Opens Aunt Laura&rsquo;s original collection in a new tab.</span>
          </a>
        </section>
      )}
    </div>
  );
}
