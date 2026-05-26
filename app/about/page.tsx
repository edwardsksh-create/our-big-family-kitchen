export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-prose px-6 py-20">
      <p className="label mb-4">About</p>
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
    </div>
  );
}
