import Link from 'next/link';
import { Menu } from 'lucide-react';
import { auth } from '@/auth';
import { SearchBar } from '@/components/search-bar';

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const signedIn = !!session?.user;

  const primaryLinks = (
    <>
      <Link href="/recipes"  className="hover:text-primary transition-colors">Recipes</Link>
      <Link href="/sections" className="hover:text-primary transition-colors">Sections</Link>
    </>
  );

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-30">
      <div className="mx-auto flex max-w-page items-center gap-4 px-6 py-4 md:gap-6">
        <Link href="/" className="group flex items-baseline gap-2 shrink-0">
          <span className="font-serif text-lg text-ink md:text-xl">Our Big Family Kitchen</span>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar />
        </div>

        {/* Desktop nav */}
        <nav className="ml-auto hidden items-center gap-5 label md:flex">
          {primaryLinks}
          <Link href="/contributors" className="hover:text-primary transition-colors hidden lg:inline">Contributors</Link>
          <Link href="/about"        className="hover:text-primary transition-colors hidden lg:inline">About</Link>
          {signedIn && (
            <Link href="/add" className="rounded-full bg-primary px-3 py-1.5 text-paper transition-colors hover:bg-ink">+ Add</Link>
          )}
          {role === 'admin' && (
            <>
              <Link href="/admin/queue"        className="hover:text-primary transition-colors hidden lg:inline">Queue</Link>
              <Link href="/admin/contributors" className="hover:text-primary transition-colors hidden lg:inline">People</Link>
            </>
          )}
          {signedIn ? (
            <Link href="/sign-out" className="hover:text-primary transition-colors">Sign out</Link>
          ) : (
            <Link href="/sign-in"  className="hover:text-primary transition-colors">Sign in</Link>
          )}
        </nav>

        {/* Mobile menu (hamburger) */}
        <details className="relative ml-auto md:hidden">
          <summary
            aria-label="Menu"
            className="list-none flex h-10 w-10 items-center justify-center rounded-full border border-rule text-ink hover:border-ink cursor-pointer [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" />
          </summary>
          <nav className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-rule bg-paper p-2 shadow-[0_12px_40px_-20px_rgba(42,37,34,0.45)] label">
            <Link href="/recipes"  className="block rounded-lg px-3 py-3 hover:bg-cream/40">Recipes</Link>
            <Link href="/sections" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Sections</Link>
            {signedIn && (
              <Link href="/add" className="block rounded-lg px-3 py-3 text-primary hover:bg-cream/40">+ Add</Link>
            )}
            {role === 'admin' && (
              <>
                <Link href="/admin/queue"        className="block rounded-lg px-3 py-3 hover:bg-cream/40">Queue</Link>
                <Link href="/admin/contributors" className="block rounded-lg px-3 py-3 hover:bg-cream/40">People</Link>
              </>
            )}
            <Link href="/contributors" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Contributors</Link>
            <Link href="/about"        className="block rounded-lg px-3 py-3 hover:bg-cream/40">About</Link>
            <div className="my-1 border-t border-rule" />
            {signedIn ? (
              <Link href="/sign-out" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Sign out</Link>
            ) : (
              <Link href="/sign-in"  className="block rounded-lg px-3 py-3 hover:bg-cream/40">Sign in</Link>
            )}
          </nav>
        </details>
      </div>

      <div className="border-t border-rule px-6 py-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
