// Public browser configuration for Bermuda cloud accounts.
// Supabase project URL and publishable/anon keys are intentionally client-visible credentials;
// player data security is enforced by RLS in supabase/schema.sql. Never place a secret/service key here.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

if ( typeof window !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY ) {
	window.__BERMUDA_SUPABASE__ = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
