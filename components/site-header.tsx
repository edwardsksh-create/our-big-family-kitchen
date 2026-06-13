import Link from 'next/link';
import { auth } from '@/auth';
import { SearchBar } from '@/components/search-bar';
import { MobileMenu } from '@/components/mobile-menu';
import { FAMILY } from '@/config/family';

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const signedIn = !!session?.user;

  // Canonical nav order, kept identical between desktop and mobile so users
  // get the same scan whichever surface they're on. "By type" reads cleaner
  // than the old "Browse" — the latter was ambiguous with the umbrella for
  // all the browsing axes (sections, families, contributors). Album appears
  // for everyone in the nav; access to /album itself stays signed-in only.
  const primaryLinks = (
    <>
      <Link href="/recipes"      className="hover:text-primary transition-colors">Recipes</Link>
      <Link href="/contributors" className="hover:text-primary transition-colors">Contributors</Link>
      <Link href="/family-lines" className="hover:text-primary transition-colors">Families</Link>
      <Link href="/about"        className="hover:text-primary transition-colors">About</Link>
      <Link href="/album"        className="hover:text-primary transition-colors">Album</Link>
    </>
  );

  const mobilePrimaryLinks = (
    <>
      <Link href="/recipes"      className="block rounded-lg px-3 py-3 hover:bg-cream/40">Recipes</Link>
      <Link href="/contributors" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Contributors</Link>
      <Link href="/family-lines" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Families</Link>
      <Link href="/about"        className="block rounded-lg px-3 py-3 hover:bg-cream/40">About</Link>
      <Link href="/album"        className="block rounded-lg px-3 py-3 hover:bg-cream/40">Album</Link>
    </>
  );

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-30">
      <div className="mx-auto flex max-w-page items-center gap-4 px-6 py-4 md:gap-6">
        <Link href="/" className="group flex items-baseline gap-2 shrink-0">
          <span className="font-serif text-lg text-ink md:text-xl">{FAMILY.siteName}</span>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar />
        </div>

        {/* Desktop nav — only shown at lg+ (1024px) so all items fit without
            individual `hidden` qualifiers. Below lg, the hamburger takes over
            with the complete list. Keeping these in lockstep avoids the
            dead-zone width where the desktop nav drops items but the
            hamburger isn't yet available. */}
        <nav className="ml-auto hidden items-center gap-5 label lg:flex">
          {primaryLinks}
          {signedIn && (
            <Link href="/add" className="rounded-full bg-primary px-3 py-1.5 text-paper transition-colors hover:bg-ink">+ Add</Link>
          )}
          {role === 'admin' && (
            <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
          )}
          {signedIn ? (
            <Link href="/sign-out" className="hover:text-primary transition-colors">Sign out</Link>
          ) : (
            <Link href="/sign-in"  className="hover:text-primary transition-colors">Sign in</Link>
          )}
        </nav>

        <MobileMenu>
          {mobilePrimaryLinks}
          {signedIn && (
            <Link href="/add" className="block rounded-lg px-3 py-3 text-primary hover:bg-cream/40">+ Add</Link>
          )}
          {role === 'admin' && (
            <Link href="/admin" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Admin</Link>
          )}
          <div className="my-1 border-t border-rule" />
          {signedIn ? (
            <Link href="/sign-out" className="block rounded-lg px-3 py-3 hover:bg-cream/40">Sign out</Link>
          ) : (
            <Link href="/sign-in"  className="block rounded-lg px-3 py-3 hover:bg-cream/40">Sign in</Link>
          )}
        </MobileMenu>
      </div>

      <div className="border-t border-rule px-6 py-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
