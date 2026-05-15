import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

// Service-role client — for trusted server-side reads/writes only.
// Never expose this to the browser.
//
// We type as SupabaseClient<any> until we generate Database types via the
// Supabase CLI. Once `supabase gen types typescript` is wired, swap this in.
let _adminClient: SupabaseClient<any, 'public', any> | undefined;

export function supabaseAdmin(): SupabaseClient<any, 'public', any> {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
    );
  }

  _adminClient = createSupabaseClient<any, 'public', any>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db:   { schema: 'public' },
  });

  return _adminClient;
}
