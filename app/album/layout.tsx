import { requireAreaAccess } from '@/lib/access';

// The album is its own visibility area (photos are the most sensitive part).
// Private by default; if a family sets it public, logged-out visitors can
// browse — the page renders read-only for them (no upload, no commenting).
export default async function AlbumAreaLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess('album', '/album');
  return <>{children}</>;
}
