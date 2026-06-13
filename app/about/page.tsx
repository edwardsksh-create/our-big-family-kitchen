import Image from 'next/image';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'About' };

export default function AboutPage() {
  const letter = FAMILY.foundingLetter;
  return (
    <div className="mx-auto max-w-prose px-6 py-20">
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        A kitchen big enough for everyone’s recipes.
      </h1>
      <div className="prose-body mt-8 text-lg leading-relaxed text-ink-soft">
        <p>
          {FAMILY.siteName} was built to solve a familiar family problem:
          the recipes are everywhere.
        </p>
        <p>
          Some are in old cookbooks. Some are on handwritten cards. Some live in
          someone’s memory, in a text thread, in a photo, or in the answer to
          “Can you send me that again?”
        </p>
        <p>This site gives all of those recipes a place to land.</p>
        <figure className="my-10">
          <div className="relative aspect-[7/5] overflow-hidden rounded-2xl border border-rule">
            <Image
              src={FAMILY.heroFallback.src}
              alt={FAMILY.heroFallback.caption}
              fill
              sizes="(min-width: 768px) 70ch, 100vw"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-3 font-serif text-sm italic text-ink-soft">
            {FAMILY.heroFallback.caption}
          </figcaption>
        </figure>
        {FAMILY.federation && (
          <p>
            It sits alongside{' '}
            <a
              href={FAMILY.federation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
            >
              {FAMILY.federation.aboutLinkText}
            </a>
            , which preserves {FAMILY.federation.archiveName} and the recipes passed
            down through that branch of the family. {FAMILY.siteName} is the
            growing side: the place for the Sundy, Edwards, Hong, Quinn, Branion,
            and Leusch lines to add what we cook now, what we remember, and what
            we want the next generation to be able to find.
          </p>
        )}
        <p>
          Recipes here do not have to be perfect. They can be old or new, fancy
          or practical, fully tested or still waiting for someone’s note in the
          margin. The goal is not to make a flawless cookbook. The goal is to
          keep the food, the stories, and the people connected.
        </p>
        <p>
          For now, the kitchen is private and invitation-only. If you’re here,
          pull up a chair.
        </p>
      </div>

      {/* The founding letter — the heart of things, closing the page.
          Kate's instance: Aunt Laura's letter, transcribed exactly. Other
          families get their own equivalent in config, or no section at all —
          never a template of this. */}
      {letter && (
        <section id="letter" className="mt-20 scroll-mt-24">
          <h2 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
            {letter.heading}
          </h2>
          <div className="prose-body mt-6 text-lg leading-relaxed text-ink-soft">
            <p>{letter.intro}</p>
          </div>

          <div className="mt-8 rounded-2xl border border-rule bg-cream/40 p-6 md:p-10">
            <div className="prose-body font-serif text-lg leading-relaxed text-ink">
              <p>{letter.salutation}</p>
              {letter.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
              <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
                <p className="m-0">{letter.closingLeft}</p>
                <p className="m-0 italic">{letter.closingRight}</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
