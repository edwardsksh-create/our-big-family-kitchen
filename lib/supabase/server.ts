import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Service-role client — for trusted server-side reads/writes only.
// Never expose this to the browser. The Database generic comes from
// `supabase gen types typescript --linked > types/supabase.ts` — rerun
// after any new migration so this file's types stay accurate.
let _adminClient: SupabaseClient<Database, 'public'> | undefined;

export function supabaseAdmin(): SupabaseClient<Database, 'public'> {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
    );
  }

  _adminClient = createSupabaseClient<Database, 'public'>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db:   { schema: 'public' },
  });

  return _adminClient;
}
