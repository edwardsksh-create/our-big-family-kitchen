// Per-contributor daily cap on AI recipe parsing (security gate item 2).
// The parse routes call reserveAiParse() before invoking Claude; a denied
// reservation becomes a 429. releaseAiParse() refunds a slot when no AI was
// actually spent (model error, or a URL that parsed from JSON-LD).

import { supabaseAdmin } from '@/lib/supabase/server';

// Per-day parse ceilings. These bound a runaway loop or a compromised
// account, not normal use. Two tiers, because the legitimate high-volume
// case — a curator setting up a site from a whole-collection file — is an
// admin activity:
//   * ADMIN gets a high backstop that's effectively never hit during real
//     setup but still stops an infinite client loop.
//   * Everyone else gets a tight bound (a big evening of adding is fine;
//     abuse is capped at ~$2.50/day).
// (Bulk imports via the service-role scripts bypass these routes entirely
// and were never capped.) Change either number to adjust.
export const AI_PARSES_PER_DAY       = 25;
export const AI_PARSES_PER_DAY_ADMIN = 500;

export type ParseReservation = { ok: boolean; used: number; limit: number };

export type ParseActor = { contributorId: string; isAdmin: boolean };

/** Resolve the signed-in user's contributor id + admin flag from their
 *  email. Null when they aren't a contributor. */
export async function resolveParseActor(email: string): Promise<ParseActor | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('contributors')
    .select('id, role')
    .ilike('email', email)
    .maybeSingle();
  if (!data) return null;
  return { contributorId: data.id, isAdmin: data.role === 'admin' };
}

/** Atomically claim one of today's parse slots, at the actor's tier.
 *  ok:false means they're at their daily limit. Fails OPEN on a counter
 *  error — the cap is a guardrail, not a paywall, so a limiter hiccup must
 *  never block a legitimate parse. */
export async function reserveAiParse(actor: ParseActor): Promise<ParseReservation> {
  const limit = actor.isAdmin ? AI_PARSES_PER_DAY_ADMIN : AI_PARSES_PER_DAY;
  const db = supabaseAdmin();
  const { data, error } = await db.rpc('reserve_ai_parse', {
    p_contributor_id: actor.contributorId,
    p_limit:          limit,
  });
  if (error) {
    console.error('reserveAiParse: counter error, allowing parse:', error.message);
    return { ok: true, used: 0, limit };
  }
  // The RPC returns the new count, or null when already at/over the limit.
  if (data == null) {
    return { ok: false, used: limit, limit };
  }
  return { ok: true, used: Number(data), limit };
}

/** Refund a previously-reserved slot (parse failed or used no AI). */
export async function releaseAiParse(contributorId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.rpc('release_ai_parse', { p_contributor_id: contributorId });
  if (error) console.error('releaseAiParse failed:', error.message);
}
