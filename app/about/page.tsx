export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-prose px-6 py-20">
      <p className="label mb-4">About</p>
      <h1 className="font-serif text-4xl leading-tight text-ink">
        A kitchen big enough for everyone’s recipes.
      </h1>
      <div className="prose-body mt-8 text-ink-soft">
        <p className="font-serif italic text-base text-ink-soft">
          Kate’s voice TBD — placeholder copy follows.
        </p>
        <p className="mt-6">
          Our Big Family Kitchen sits alongside the Leusch family archive. The
          archive remembers; this site grows. It’s where the Sundys and Edwards
          and Hongs and the newer Quinns and Branions write down what they cook
          now, so it’s not lost the next time someone asks.
        </p>
        <p>
          Recipes here can be old or brand-new. They’re by invitation for now —
          if you got an email from Kate, you’re in.
        </p>
      </div>
    </div>
  );
}
