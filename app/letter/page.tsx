import Image from 'next/image';

export const metadata = { title: 'Aunt Laura’s letter' };

// Aunt Laura's 2003 letter — the founding document of this whole project,
// transcribed verbatim from the books she made for Kate's graduation.
// This page is Kate's own content, hard-coded on purpose: if the site ever
// hosts other families, they get their own equivalent, not a template of
// this one.

export default function LetterPage() {
  return (
    <div className="mx-auto max-w-prose px-6 py-20">
      <p className="label mb-3">From the archive</p>
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Aunt Laura’s letter
      </h1>

      <div className="prose-body mt-8 text-lg leading-relaxed text-ink-soft">
        <p>
          Aunt Laura put the original “Leusch Family Recipes” together as a
          college graduation gift for me — recipes gathered from the whole
          family, handwritten cards typed up, and instructions recreated for
          dishes that had never been written down at all. This site grew out
          of that gift.
        </p>
        <p>
          The letter below came with it, and it’s still the best explanation
          of why any of this exists. These are her exact words.
        </p>
      </div>

      <figure className="my-10 md:max-w-[320px]">
        <div className="overflow-hidden rounded-2xl border border-rule">
          <Image
            src="/letter/leusch-great-grandparents.jpg"
            alt="Great-grandparents on the Leusch side, standing outside their house."
            width={859}
            height={1500}
            sizes="(min-width: 768px) 320px, 80vw"
            className="h-auto w-full"
          />
        </div>
        <figcaption className="mt-3 font-serif text-sm italic text-ink-soft">
          Great-grandparents on the Leusch side.
        </figcaption>
      </figure>

      {/* The letter itself — the Family Note treatment: this is the site's
          boxed register for a person speaking in their own words. */}
      <section className="rounded-2xl border border-rule bg-cream/40 p-6 md:p-10">
        <div className="prose-body font-serif text-lg leading-relaxed text-ink">
          <p>Dear Kate,</p>
          <p>
            I have spent this past winter and spring trying to compile these
            books for you. It is a true labor of love, believe me! As you enter
            the big world, I am sending with you “The Leusch Family Recipes.”
            They have been gathered from three generations before yours. They
            also come from friends of ours, both old and new, some gone
            outgrown, or just lost. A piece of all of them stays with us. I
            hope you enjoy using these recipes and reading the occasional
            story connected with them.
          </p>
          <p>
            As I was copying these, I thought of many hints to give you. Most
            of them have disappeared as I came to this final point. I found
            that we have a lot of what I would call “weekend” recipes. They
            take a lot of time! Almost always, they are worth it. Some
            recipes are so old and well known to us that they were never
            written down; I have tried to recreate those for you.
          </p>
          <p>
            My hints… oh yes, Kate, I do have a few! Do you know that the
            only food you pack when measuring is brown sugar? Don’t be afraid
            to talk to the butcher or fish man for advice or to order a
            specific cut of meat or fish; they are there to help you. A lot
            of the recipes call for a small amount of liquor and you probably
            won’t want to buy a full bottle for just 2 tablespoons. Look for
            a store that sells small bottles; you’ll save a lot of money and
            still be able to make the recipe. Most of all, enjoy the cooking!
            Have fun with it. If you really hate an ingredient, leave it out.
            And finally, if you never want to cook, save this for your
            children.
          </p>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
            <p className="m-0">Happy Graduation, Kate!</p>
            <p className="m-0 italic">Love, Aunt Laura</p>
          </div>
        </div>
      </section>

      <p className="mt-10 text-sm italic text-ink-soft">
        Aunt Laura’s full cookbook — every recipe, story, and scan — lives at{' '}
        <a
          href="https://leuschfamilyrecipes.com"
          target="_blank"
          rel="noopener noreferrer"
          className="not-italic text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
        >
          leuschfamilyrecipes.com
        </a>
        .
      </p>
    </div>
  );
}
