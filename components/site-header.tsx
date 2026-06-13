import Link from 'next/link';
import { auth } from '@/auth';
import { SearchBar } from '@/components/search-bar';
import { MobileMenu } from '@/components/mobile-menu';
import { FAMILY } from '@/config/family';
import { isAreaPublic } from '@/lib/access';

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const signedIn = !!session?.user;

  // Show an area's nav link only when this visitor can actually reach it —
  // public to all, or signed in. Avoids links that just bounce to sign-in on
  // a private site. About is always shown; search rides with the recipes area.
  const showRecipes      = isAreaPublic('recipes')      || signedIn;
  const showFamily       = isAreaPublic('family')       || signedIn;
  const showContributors = isAreaPublic('contributors') || signedIn;
  const showAlbum        = isAreaPublic('album')         || signedIn;

  // Canonical nav order, kept identical between desktop and mobile.
  const navItems = [
    showRecipes      && { href: '/recipes',      label: 'Recipes' },
    showContributors && { href: '/contributors', label: 'Contributors' },
    showFamily       && { href: '/family-lines', label: 'Families' },
    { href: '/about', label: 'About' },
    showAlbum        && { href: '/album',         label: 'Album' },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-30">
      <div className="mx-auto flex max-w-page items-center gap-4 px-6 py-4 md:gap-6">
        <Link href="/" className="group flex items-baseline gap-2 shrink-0">
          <span className="font-serif text-lg text-ink md:text-xl">{FAMILY.siteName}</span>
        </Link>

        {showRecipes && (
          <div className="hidden flex-1 justify-center md:flex">
            <SearchBar />
          </div>
        )}

        {/* Desktop nav — only shown at lg+ (1024px) so all items fit without
            individual `hidden` qualifiers. Below lg, the hamburger takes over. */}
        <nav className="ml-auto hidden items-center gap-5 label lg:flex">
          {navItems.map((i) => (
            <Link key={i.href} href={i.href} className="hover:text-primary transition-colors">{i.label}</Link>
          ))}
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
          {navItems.map((i) => (
            <Link key={i.href} href={i.href} className="block rounded-lg px-3 py-3 hover:bg-cream/40">{i.label}</Link>
          ))}
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

      {showRecipes && (
        <div className="border-t border-rule px-6 py-3 md:hidden">
          <SearchBar />
        </div>
      )}
    </header>
  );
}
