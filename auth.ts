import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { supabaseAdmin } from '@/lib/supabase/server';
import { magicLinkHtml, magicLinkText } from '@/lib/auth/magic-link-email';
import { FAMILY } from '@/config/family';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: SupabaseAdapter({
    url: supabaseUrl,
    secret: supabaseServiceRoleKey,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      // Custom branded email overrides NextAuth's default plain-text template.
      // We POST to Resend's REST API directly so we control subject + HTML.
      async sendVerificationRequest({ identifier, url, provider }) {
        const host = new URL(url).host;
        const apiKey = (provider as { apiKey?: string }).apiKey
          ?? process.env.RESEND_API_KEY!;
        const from = (provider as { from?: string }).from
          ?? process.env.EMAIL_FROM
          ?? 'onboarding@resend.dev';

        const res = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: {
            authorization:  `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to:      identifier,
            subject: 'Your Magic Sign-In Link',
            html:    magicLinkHtml({ url, host }),
            text:    magicLinkText({ url, host }),
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Resend email send failed (${res.status}): ${body}`);
        }
      },
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/sign-in',
    verifyRequest: '/sign-in/check-email',
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const db = supabaseAdmin();
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();

      // 1) Already a contributor → allow, ensure joined_at is set.
      const { data: contributor } = await db
        .from('contributors')
        .select('id, joined_at')
        .ilike('email', email)
        .maybeSingle();

      if (contributor) {
        if (!contributor.joined_at) {
          await db
            .from('contributors')
            .update({ joined_at: new Date().toISOString() })
            .eq('id', contributor.id);
        }
        return true;
      }

      // 2) Bootstrap admin (Kate) → create on first sign-in.
      if (adminEmail && email === adminEmail) {
        await db.from('contributors').insert({
          email,
          name: user.name ?? null,
          role: 'admin',
          joined_at: new Date().toISOString(),
        });
        return true;
      }

      // 3) Has an invitation → accept it, create contributor row.
      const { data: invite } = await db
        .from('invitations')
        .select('id, family_line_ids, invited_by_id, role')
        .ilike('email', email)
        .is('accepted_at', null)
        .maybeSingle();

      if (invite) {
        const inviteRole = invite.role === 'viewer' ? 'viewer' : 'contributor';
        const { data: newContributor, error: insertErr } = await db
          .from('contributors')
          .insert({
            email,
            name:          user.name ?? null,
            role:          inviteRole,
            // Viewers are read-only: they sign in and browse, but the app
            // blocks contributing and can_sign_in stays false so the
            // upload/comment affordances never appear. An invited
            // contributor gets can_sign_in=true so they can participate.
            can_sign_in:   inviteRole !== 'viewer',
            invited_at:    new Date().toISOString(),
            invited_by_id: invite.invited_by_id,
            joined_at:     new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertErr || !newContributor) return false;

        if (invite.family_line_ids?.length) {
          await db.from('contributor_family_lines').insert(
            invite.family_line_ids.map((fl: string) => ({
              contributor_id: newContributor.id,
              family_line_id: fl,
            })),
          );
        }

        await db
          .from('invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invite.id);

        // Let the admin know who was let in (view-only guests are invited by
        // any family member via a share link, so the admin isn't otherwise
        // in the loop). Fire-and-forget — never block sign-in on the email.
        if (inviteRole === 'viewer') {
          void notifyAdminViewerJoined(db, { email, invitedById: invite.invited_by_id });
        }

        return true;
      }

      // 4) Otherwise, reject.
      return '/sign-in?error=not_invited';
    },
    async session({ session }) {
      // Augment session with contributor role for use in UI guards.
      // We resolve by email rather than the `user` arg from NextAuth so that
      // role/contributorId always lands on the session, even if the adapter
      // didn't surface the user object on a given callback.
      const email = session.user?.email;
      if (email) {
        const db = supabaseAdmin();
        const { data } = await db
          .from('contributors')
          .select('id, role')
          .ilike('email', email)
          .maybeSingle();
        if (data) {
          (session.user as { contributorId?: string }).contributorId = data.id;
          (session.user as { role?: string }).role = data.role;
        }
      }
      return session;
    },
  },
});

// Notify the admin that a view-only guest just joined, and who invited them.
// Fire-and-forget: any failure is logged, never surfaced to the sign-in flow.
async function notifyAdminViewerJoined(
  db: ReturnType<typeof supabaseAdmin>,
  args: { email: string; invitedById: string | null },
): Promise<void> {
  try {
    const apiKey      = process.env.RESEND_API_KEY;
    const adminEmail  = process.env.ADMIN_EMAIL;
    const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    if (!apiKey || !adminEmail) return;

    let invitedBy = 'a family member';
    if (args.invitedById) {
      const { data } = await db
        .from('contributors')
        .select('name, email')
        .eq('id', args.invitedById)
        .maybeSingle();
      if (data) invitedBy = data.name || data.email;
    }

    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from:    fromAddress,
        to:      adminEmail,
        subject: `New view-only guest: ${args.email}`,
        text:
          `${args.email} just signed in as a view-only guest on ${FAMILY.siteName}.\n\n` +
          `Invited by: ${invitedBy}.\n\n` +
          `They can browse the site but can't add, edit, or comment. Manage guests under Admin → Contributors.`,
      }),
    });
  } catch (err) {
    console.error('notifyAdminViewerJoined failed:', (err as Error).message);
  }
}
