import Link from 'next/link';
import { auth } from '@/auth';
import { SearchBar } from '@/components/search-bar';

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-30">
      <div className="mx-auto flex max-w-page items-center gap-4 px-6 py-4 md:gap-6">
        <Link href="/" className="group flex items-baseline gap-2 shrink-0">
          <span className="font-serif text-lg text-ink md:text-xl">Our Big Family Kitchen</span>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar />
        </div>

        <nav className="ml-auto flex items-center gap-5 label">
          <Link href="/recipes"             className="hover:text-primary transition-colors">Recipes</Link>
          <Link href="/family-lines/leusch" className="hover:text-primary transition-colors hidden md:inline">Families</Link>
          <Link href="/contributors"        className="hover:text-primary transition-colors hidden md:inline">Contributors</Link>
          <Link href="/about"               className="hover:text-primary transition-colors hidden lg:inline">About</Link>
          {session?.user ? (
            <Link href="/sign-out" className="hover:text-primary transition-colors">Sign out</Link>
          ) : (
            <Link href="/sign-in"  className="hover:text-primary transition-colors">Sign in</Link>
          )}
        </nav>
      </div>

      <div className="border-t border-rule px-6 py-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
