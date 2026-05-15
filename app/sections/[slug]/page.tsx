import { notFound } from 'next/navigation';
import { SECTIONS, sectionBySlug, SECTION_BG, SECTION_TEXT } from '@/lib/sections';
import { cn } from '@/lib/utils';

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ slug: s.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const section = sectionBySlug(params.slug);
  return { title: section?.name ?? 'Section' };
}

export default function SectionPage({ params }: { params: { slug: string } }) {
  const section = sectionBySlug(params.slug);
  if (!section) notFound();

  return (
    <div>
      <header
        className={cn('w-full', SECTION_BG[section.color], SECTION_TEXT[section.color])}
      >
        <div className="mx-auto max-w-page px-6 py-20">
          <p className="label" style={{ color: 'inherit', opacity: 0.7 }}>Section</p>
          <h1 className="font-serif mt-3 text-5xl leading-tight md:text-6xl">{section.name}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-page px-6 py-16">
        <h2 className="font-serif text-2xl text-ink">Recipes</h2>
        <div className="mt-6 rounded-2xl border border-dashed border-rule p-12 text-center">
          <p className="font-serif italic text-2xl text-ink-soft">No recipes yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            The first {section.name.toLowerCase()} recipes will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
