import { requireAreaAccess } from '@/lib/access';

export default async function FamilyAreaLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess('family', '/family-lines');
  return <>{children}</>;
}
