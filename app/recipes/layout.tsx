import { requireAreaAccess } from '@/lib/access';

export default async function RecipesAreaLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess('recipes', '/recipes');
  return <>{children}</>;
}
