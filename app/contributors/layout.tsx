import { requireAreaAccess } from '@/lib/access';

export default async function ContributorsAreaLayout({ children }: { children: React.ReactNode }) {
  await requireAreaAccess('contributors', '/contributors');
  return <>{children}</>;
}
