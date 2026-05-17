import Link from 'next/link';

export const metadata = { title: 'Thanks!' };

export default function ThanksPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-prose flex-col justify-center px-6 py-16 text-center">
      <p className="label mb-4">Submitted</p>
      <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
        Thanks — Kate will review your recipe.
      </h1>
      <p className="mt-4 text-ink-soft">
        You’ll see it on the site once it’s approved.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="btn-ghost">Back home</Link>
        <Link href="/add" className="btn-primary">Add another</Link>
      </div>
    </div>
  );
}
