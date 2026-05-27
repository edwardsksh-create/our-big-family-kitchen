import { SECTIONS } from '@/lib/sections';
import { SectionCard } from '@/components/section-card';

export const metadata = { title: 'Browse by recipe type' };

export default function SectionsIndexPage() {
  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Browse by recipe type
      </h1>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {SECTIONS.map((section) => (
          <SectionCard key={section.slug} section={section} />
        ))}
      </div>
    </div>
  );
}
