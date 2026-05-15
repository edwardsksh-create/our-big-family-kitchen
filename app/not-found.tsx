import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-prose px-6 py-24 text-center">
      <p className="label mb-3">404</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">
        Nothing in the pantry by that name.
      </h1>
      <p className="mt-4 text-ink-soft">
        Try heading back <Link href="/" className="text-primary underline">home</Link>.
      </p>
    </div>
  );
}
