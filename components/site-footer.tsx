import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-rule">
      <div className="mx-auto flex max-w-page flex-col gap-2 px-6 py-12 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
        <p className="font-serif italic">
          Built alongside{' '}
          <Link
            href="https://leuschfamilyrecipes.com"
            className="text-primary underline decoration-rule underline-offset-4 hover:decoration-primary"
          >
            leuschfamilyrecipes.com
          </Link>
          .
        </p>
        <p className="label">© {new Date().getFullYear()} Our Big Family Kitchen</p>
      </div>
    </footer>
  );
}
