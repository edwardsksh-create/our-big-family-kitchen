import { redirect } from 'next/navigation';
import { auth } from '@/auth';

// Contributing is for family members, not view-only guests. Signed-out
// visitors sign in; viewers are sent home. (Individual /add pages still do
// their own per-flow checks.)
export default async function AddLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/sign-in?next=/add');
  if ((session.user as { role?: string }).role === 'viewer') redirect('/');
  return <>{children}</>;
}
