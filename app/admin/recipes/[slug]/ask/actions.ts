'use server';

import { Resend } from 'resend';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isStubEmail } from '@/lib/recipes/ask-family';

export type SendAskFamilyInput = {
  recipeId:               string;
  recipientContributorId: string;
  subject:                string;
  bodyPlain:              string;
  bodyHtml:               string;
};

export type SendAskFamilyResult =
  | { ok: true;  to: string }
  | { ok: false; error: 'unauthorized' | 'invalid_recipient' | 'invalid_payload' | 'email_not_configured' | 'send_failed' };

/**
 * Send the admin-composed "Ask the family" email via Resend. Always verifies
 * admin role; always re-validates that the chosen recipient is a real
 * (non-stub-email) contributor server-side, even though the picker only
 * surfaces eligible options. Returns the destination address on success so
 * the UI can confirm where it actually went.
 */
export async function sendAskFamily(input: SendAskFamilyInput): Promise<SendAskFamilyResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return { ok: false, error: 'unauthorized' };
  }

  const subject  = (input.subject  ?? '').trim();
  const bodyPln  = (input.bodyPlain ?? '').trim();
  const bodyHtm  = (input.bodyHtml  ?? '').trim();
  if (!subject || !bodyPln || !bodyHtm) return { ok: false, error: 'invalid_payload' };

  const db = supabaseAdmin();
  const { data: recipient } = await db
    .from('contributors')
    .select('id, email, name')
    .eq('id', input.recipientContributorId)
    .maybeSingle();
  if (!recipient || !recipient.email || isStubEmail(recipient.email)) {
    return { ok: false, error: 'invalid_recipient' };
  }

  // Confirm the recipe exists (so we don't send a "your recipe is missing
  // steps" email about something that's just been deleted).
  const { data: recipe } = await db.from('recipes').select('id').eq('id', input.recipeId).maybeSingle();
  if (!recipe) return { ok: false, error: 'invalid_payload' };

  const apiKey      = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;
  if (!apiKey || !fromAddress) return { ok: false, error: 'email_not_configured' };

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from:     fromAddress,
      to:       recipient.email,
      // Route replies back to Kate so the family member can answer in-thread.
      replyTo:  session.user.email || undefined,
      subject,
      text:     bodyPln,
      html:     bodyHtm,
    });
    return { ok: true, to: recipient.email };
  } catch (err) {
    console.error('ask-family send failed:', err);
    return { ok: false, error: 'send_failed' };
  }
}
