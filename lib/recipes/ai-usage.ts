// Per-contributor daily cap on AI recipe parsing (security gate item 2).
// The parse routes call reserveAiParse() before invoking Claude; a denied
// reservation becomes a 429. releaseAiParse() refunds a slot when no AI was
// actually spent (model error, or a URL that parsed from JSON-LD).

import { supabaseAdmin } from '@/lib/supabase/server';

// The per-contributor, per-day ceiling. This bounds a runaway loop or a
// compromised account, not normal use (a few parses a day). Change this one
// number to adjust the cap.
export const AI_PARSES_PER_DAY = 25;

export type ParseReservation = { ok: boolean; used: number; limit: number };

/** Resolve the signed-in user's contributor id from their email. */
export async function contributorIdForEmail(email: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('contributors')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  return data?.id ?? null;
}

/** Atomically claim one of today's parse slots. ok:false means the
 *  contributor is at their daily limit. Fails OPEN on a counter error — the
 *  cap is a guardrail, not a paywall, so a limiter hiccup must never block a
 *  legitimate parse. */
export async function reserveAiParse(contributorId: string): Promise<ParseReservation> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc('reserve_ai_parse', {
    p_contributor_id: contributorId,
    p_limit:          AI_PARSES_PER_DAY,
  });
  if (error) {
    console.error('reserveAiParse: counter error, allowing parse:', error.message);
    return { ok: true, used: 0, limit: AI_PARSES_PER_DAY };
  }
  // The RPC returns the new count, or null when already at/over the limit.
  if (data == null) {
    return { ok: false, used: AI_PARSES_PER_DAY, limit: AI_PARSES_PER_DAY };
  }
  return { ok: true, used: Number(data), limit: AI_PARSES_PER_DAY };
}

/** Refund a previously-reserved slot (parse failed or used no AI). */
export async function releaseAiParse(contributorId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.rpc('release_ai_parse', { p_contributor_id: contributorId });
  if (error) console.error('releaseAiParse failed:', error.message);
}
