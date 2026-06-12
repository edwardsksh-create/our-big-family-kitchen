import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, ClipboardPaste, Link2, Pencil } from 'lucide-react';
import { auth } from '@/auth';

export const metadata = { title: 'Add a recipe' };

type Tile = {
  href:        string;
  title:       string;
  body:        string;
  icon:        React.ReactNode;
};

const TILES: Tile[] = [
  {
    href:  '/add/photo',
    title: 'Upload a photo',
    body:  'Snap a handwritten card or a cookbook page — it\u2019ll be typed up for you to check.',
    icon:  <Camera size={24} />,
  },
  {
    href:  '/add/paste',
    title: 'Paste text',
    body:  'Paste a recipe from a doc, email, or notes app.',
    icon:  <ClipboardPaste size={24} />,
  },
  {
    href:  '/add/url',
    title: 'From a URL',
    body:  'Paste a link to a recipe online — we’ll pull it in.',
    icon:  <Link2 size={24} />,
  },
  {
    href:  '/add/manual',
    title: 'Enter manually',
    body:  'Type ingredients and instructions yourself.',
    icon:  <Pencil size={24} />,
  },
];

export default async function AddPickerPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add');

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="label mb-3">Add</p>
      <h1 className="font-serif text-4xl text-ink md:text-5xl">Add a recipe</h1>
      <p className="mt-3 max-w-prose text-ink-soft">Four ways to start.</p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group block min-h-[180px] rounded-2xl border border-rule p-6 card-hover hover:border-ink hover:shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)] md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {t.icon}
            </span>
            <h2 className="mt-4 font-serif text-xl text-ink group-hover:text-primary md:text-2xl">{t.title}</h2>
            <p className="mt-2 text-sm text-ink-soft">{t.body}</p>
            <p className="mt-5 label text-primary transition-transform duration-300 group-hover:translate-x-1">
              Continue →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
