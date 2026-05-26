import { SECTIONS } from '@/lib/sections';
import { SectionCard } from '@/components/section-card';

export const metadata = { title: 'Sections' };

export default function SectionsIndexPage() {
  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">A meal-day in 16 colors</p>
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Sections
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-soft">
        Browse recipes by the part of the meal they belong to — from morning
        plates and weeknight mains to the things that end the night sweet.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {SECTIONS.map((section) => (
          <SectionCard key={section.slug} section={section} />
        ))}
      </div>
    </div>
  );
}
