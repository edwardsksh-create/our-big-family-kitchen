// Per-area visibility enforcement. Each public-facing area is independently
// 'public' or 'private' (config/family.ts → FAMILY.visibility). A private
// area requires a signed-in user to view; a public one is open to anyone.
//
// Used two ways:
//   - requireAreaAccess(area) at the top of an area's layout — redirects a
//     logged-out visitor to sign-in when the area is private.
//   - isAreaPublic(area) on the home page (and sitemap) to decide which
//     widgets/links to show to a logged-out visitor.
//
// Contributing, editing, and admin are gated separately (by session + role),
// independent of these read-visibility settings.
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { FAMILY } from '@/config/family';

export type SiteArea = keyof typeof FAMILY.visibility; // 'recipes' | 'family' | 'contributors' | 'album'

export function isAreaPublic(area: SiteArea): boolean {
  return FAMILY.visibility[area] === 'public';
}

/** Redirect a logged-out visitor to sign-in when the area is private.
 *  No-op for public areas and for signed-in users. `next` is where to
 *  return after signing in (the area's landing path). */
export async function requireAreaAccess(area: SiteArea, next: string): Promise<void> {
  if (isAreaPublic(area)) return;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
}
