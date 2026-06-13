'use server';

// Shareable view-only invite links. Any signed-in family member (not a
// viewer) can generate a one-time link; they share it however they like. The
// guest opens /invite/<token>, enters their email, and that turns the link
// into a normal email-bound invitation (role 'viewer') and sends the
// magic-link sign-in. Acceptance happens in auth.ts, which also notifies the
// admin who joined.
import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { FAMILY } from '@/config/family';

export type CreateLinkResult = { ok: true; url: string } | { ok: false; error: string };

/** Generate a one-time view-only invite link. Caller must be a signed-in
 *  contributor or admin (viewers can't invite). */
export async function createViewerInviteLink(note?: string): Promise<CreateLinkResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'unauthorized' };

  const db = supabaseAdmin();
  const { data: actor } = await db
    .from('contributors')
    .select('id, role')
    .ilike('email', session.user.email)
    .maybeSingle();
  if (!actor) return { ok: false, error: 'unauthorized' };
  if (actor.role !== 'admin' && actor.role !== 'contributor') {
    return { ok: false, error: 'viewers_cannot_invite' };
  }

  const token = crypto.randomBytes(24).toString('base64url');
  const { error } = await db.from('invite_links').insert({
    token,
    role:          'viewer',
    created_by_id: actor.id,
    note:          note?.trim() || null,
  });
  if (error) {
    console.error('createViewerInviteLink failed:', error.message);
    return { ok: false, error: 'create_failed' };
  }
  return { ok: true, url: `${FAMILY.baseUrl}/invite/${token}` };
}

/** Claim a view-only link with the guest's email, then send the sign-in
 *  magic link. Form action on /invite/[token]. Redirects on both failure
 *  (back to the link page with an error code) and success (signIn). */
export async function claimViewerInvite(token: string, formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) redirect(`/invite/${token}?e=email`);

  const db = supabaseAdmin();
  const { data: link } = await db
    .from('invite_links')
    .select('id, role, created_by_id, revoked, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!link || link.revoked || new Date(link.expires_at) < new Date()) {
    redirect(`/invite/${token}?e=link`);
  }

  // If they're already a contributor, the link is moot — just sign them in.
  const { data: existing } = await db
    .from('contributors')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (!existing) {
    // Turn the link into an email-bound invitation (the existing acceptance
    // path in auth.ts handles the rest on first sign-in). Upsert by email so
    // re-submitting is harmless.
    const { error: invErr } = await db
      .from('invitations')
      .upsert(
        { email, role: link!.role, invited_by_id: link!.created_by_id, token: crypto.randomUUID(), accepted_at: null },
        { onConflict: 'email' },
      );
    if (invErr) {
      console.error('claimViewerInvite: invitation upsert failed:', invErr.message);
      redirect(`/invite/${token}?e=claim`);
    }
  }

  // One-time: a loose link shouldn't mint unlimited accounts.
  await db.from('invite_links').update({ revoked: true }).eq('id', link!.id);

  // Sends the magic link and redirects to the verify-request page.
  await signIn('resend', { email, redirectTo: '/' });
}
