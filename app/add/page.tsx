import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const metadata = { title: 'Add a recipe' };

export default async function AddPickerPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add');

  const cards: { href: string; title: string; body: string }[] = [
    {
      href: '/add/paste',
      title: 'Paste text',
      body:  'Paste a recipe from a doc, email, or notes app.',
    },
    {
      href: '/add/url',
      title: 'From a URL',
      body:  'Paste a link to a recipe online — we’ll pull it in.',
    },
    {
      href: '/add/manual',
      title: 'Enter manually',
      body:  'Type ingredients and instructions yourself.',
    },
  ];

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Add</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">Add a recipe</h1>
      <p className="mt-3 max-w-prose text-ink-soft">Three ways to start.</p>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group block rounded-2xl border border-rule p-8 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]"
          >
            <h2 className="font-serif text-2xl text-ink group-hover:text-primary">{c.title}</h2>
            <p className="mt-3 text-ink-soft">{c.body}</p>
            <p className="mt-8 label text-primary transition-transform duration-300 group-hover:translate-x-1">
              Continue →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
