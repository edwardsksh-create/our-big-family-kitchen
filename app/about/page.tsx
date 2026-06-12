import Image from 'next/image';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-prose px-6 py-20">
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        A kitchen big enough for everyone’s recipes.
      </h1>
      <div className="prose-body mt-8 text-lg leading-relaxed text-ink-soft">
        <p>
          Our Big Family Kitchen was built to solve a familiar family problem:
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
              src="/hero/leusch-sisters-thanksgiving.jpg"
              alt="Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s."
              fill
              sizes="(min-width: 768px) 70ch, 100vw"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-3 font-serif text-sm italic text-ink-soft">
            Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s.
          </figcaption>
        </figure>
        <p>
          It sits alongside{' '}
          <a
            href="https://leuschfamilyrecipes.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
          >
            the original Leusch family archive
          </a>
          , which preserves Aunt Laura’s 2003 cookbook and the recipes passed
          down through that branch of the family. Our Big Family Kitchen is the
          growing side: the place for the Sundy, Edwards, Hong, Quinn, Branion,
          and Leusch lines to add what we cook now, what we remember, and what
          we want the next generation to be able to find.
        </p>
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

      {/* Aunt Laura's letter — the heart of things, closing the page.
          Kate's content, hard-coded on purpose: other families would get
          their own equivalent, never a template of this. */}
      <section id="letter" className="mt-20 scroll-mt-24">
        <h2 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
          Aunt Laura’s letter
        </h2>
        <div className="prose-body mt-6 text-lg leading-relaxed text-ink-soft">
          <p>
            Aunt Laura made those original books as a college graduation gift
            for me — handwritten cards typed up, and recipes that had never
            been written down recreated from memory. This letter came with
            them. These are her exact words.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-rule bg-cream/40 p-6 md:p-10">
          <div className="prose-body font-serif text-lg leading-relaxed text-ink">
            <p>Dear Kate,</p>
            <p>
              I have spent this past winter and spring trying to compile these
              books for you. It is a true labor of love, believe me! As you
              enter the big world, I am sending with you “The Leusch Family
              Recipes.” They have been gathered from three generations before
              yours. They also come from friends of ours, both old and new,
              some gone outgrown, or just lost. A piece of all of them stays
              with us. I hope you enjoy using these recipes and reading the
              occasional story connected with them.
            </p>
            <p>
              As I was copying these, I thought of many hints to give you.
              Most of them have disappeared as I came to this final point. I
              found that we have a lot of what I would call “weekend” recipes.
              They take a lot of time! Almost always, they are worth it. Some
              recipes are so old and well known to us that they were never
              written down; I have tried to recreate those for you.
            </p>
            <p>
              My hints… oh yes, Kate, I do have a few! Do you know that the
              only food you pack when measuring is brown sugar? Don’t be
              afraid to talk to the butcher or fish man for advice or to order
              a specific cut of meat or fish; they are there to help you. A
              lot of the recipes call for a small amount of liquor and you
              probably won’t want to buy a full bottle for just 2 tablespoons.
              Look for a store that sells small bottles; you’ll save a lot of
              money and still be able to make the recipe. Most of all, enjoy
              the cooking! Have fun with it. If you really hate an ingredient,
              leave it out. And finally, if you never want to cook, save this
              for your children.
            </p>
            <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
              <p className="m-0">Happy Graduation, Kate!</p>
              <p className="m-0 italic">Love, Aunt Laura</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
