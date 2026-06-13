import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { InviteGuestPanel } from '@/components/invite-guest-panel';

export const metadata = { title: 'Invite a guest' };
export const dynamic = 'force-dynamic';

// Any signed-in family member (admin or contributor) can create a view-only
// link to share. Viewers can't invite; signed-out visitors sign in first.
export default async function InvitePage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in?next=/invite');

  const db = supabaseAdmin();
  const { data: actor } = await db
    .from('contributors')
    .select('role')
    .ilike('email', session.user.email)
    .maybeSingle();
  if (!actor || (actor.role !== 'admin' && actor.role !== 'contributor')) {
    redirect('/');
  }

  return (
    <div className="mx-auto max-w-prose px-6 py-16">
      <p className="label mb-3">Invite a guest</p>
      <h1 className="font-serif text-4xl leading-tight text-ink md:text-5xl">
        Share view-only access.
      </h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Create a link for someone you’d like to let look around — a friend, a
        cousin, anyone. They’ll be able to browse the site, but not add, edit,
        or comment on anything. You’ll get a note when they join.
      </p>
      <InviteGuestPanel />
    </div>
  );
}
