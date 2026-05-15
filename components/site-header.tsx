import Link from 'next/link';
import { auth } from '@/auth';

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-30">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-5">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-xl text-ink">Our Big Family Kitchen</span>
        </Link>

        <nav className="flex items-center gap-6 label">
          <Link href="/recipes"        className="hover:text-primary transition-colors">Recipes</Link>
          <Link href="/family-lines/leusch" className="hover:text-primary transition-colors hidden md:inline">Families</Link>
          <Link href="/contributors"   className="hover:text-primary transition-colors hidden md:inline">Contributors</Link>
          <Link href="/about"          className="hover:text-primary transition-colors hidden md:inline">About</Link>
          {session?.user ? (
            <Link href="/sign-out" className="hover:text-primary transition-colors">Sign out</Link>
          ) : (
            <Link href="/sign-in"  className="hover:text-primary transition-colors">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
