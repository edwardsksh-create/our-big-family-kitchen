import { requireAreaAccess } from '@/lib/access';

// Sections browse recipes — same visibility as the recipes area.
export default async function SectionsAreaLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess('recipes', '/recipes');
  return <>{children}</>;
}
