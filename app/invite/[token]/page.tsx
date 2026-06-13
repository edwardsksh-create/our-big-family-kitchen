import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { claimViewerInvite } from '@/lib/invites/share-link';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'You’re invited' };
export const dynamic = 'force-dynamic';

// Public landing for a shared view-only link. The guest enters their email
// and gets a sign-in link (claimViewerInvite turns the link into an
// invitation + sends the magic link). Already-signed-in visitors are sent home.
export default async function ClaimInvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { e?: string };
}) {
  const session = await auth();
  if (session?.user) {
    redirect('/'); // already have access — no need to claim
  }

  const db = supabaseAdmin();
  const { data: link } = await db
    .from('invite_links')
    .select('id, created_by_id, revoked, expires_at')
    .eq('token', params.token)
    .maybeSingle();
  const valid = !!link && !link.revoked && new Date(link.expires_at) >= new Date();

  let inviter = 'Someone in the family';
  if (valid && link!.created_by_id) {
    const { data } = await db.from('contributors').select('name').eq('id', link!.created_by_id).maybeSingle();
    if (data?.name) inviter = data.name;
  }

  const wrap = 'mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16';

  if (!valid) {
    return (
      <div className={wrap}>
        <p className="label mb-4">Invitation</p>
        <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">This link isn’t active.</h1>
        <p className="mt-3 text-ink-soft">
          It may have already been used or expired. Ask whoever shared it for a fresh one.
        </p>
      </div>
    );
  }

  const claim = claimViewerInvite.bind(null, params.token);

  return (
    <div className={wrap}>
      <p className="label mb-4">You’re invited</p>
      <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
        {inviter} invited you to look around {FAMILY.siteName}.
      </h1>
      <p className="mt-3 text-ink-soft">
        Enter your email and we’ll send you a sign-in link. You’ll be able to
        browse — recipes, photos, the family — as a guest.
      </p>
      <form action={claim} className="mt-8 space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
        </label>
        <button type="submit" className="btn-primary w-full">Send me a sign-in link</button>
      </form>
      {searchParams.e === 'email' && (
        <p className="mt-6 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          That email didn’t look right — please check and try again.
        </p>
      )}
      {(searchParams.e === 'link' || searchParams.e === 'claim') && (
        <p className="mt-6 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          Something went wrong with this link — ask for a fresh one.
        </p>
      )}
    </div>
  );
}
