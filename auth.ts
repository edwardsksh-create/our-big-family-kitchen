import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { supabaseAdmin } from '@/lib/supabase/server';
import { magicLinkHtml, magicLinkText } from '@/lib/auth/magic-link-email';

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
    // Send auth errors (e.g. a used or expired magic link) back to our own
    // sign-in page instead of NextAuth's default error screen, so family
    // members get a friendly explanation and the form to request a new link.
    error: '/sign-in',
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
        .select('id, family_line_ids, invited_by_id')
        .ilike('email', email)
        .is('accepted_at', null)
        .maybeSingle();

      if (invite) {
        const { data: newContributor, error: insertErr } = await db
          .from('contributors')
          .insert({
            email,
            name:          user.name ?? null,
            role:          'contributor',
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
