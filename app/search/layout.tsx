import { requireAreaAccess } from '@/lib/access';

// Search surfaces recipes — gated with the recipes area.
export default async function SearchAreaLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess('recipes', '/recipes');
  return <>{children}</>;
}
