import { createClient } from '@supabase/supabase-js';

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the server environment');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Server-only client. The service role key bypasses RLS and must never be sent to the browser.
export const supabase = createSupabaseClient();

export async function checkDatabaseConnection() {
  const { error } = await supabase.from('categories').select('id', { count: 'exact', head: true });
  if (error) {
    throw new Error(`Supabase connection failed: ${error.message || error.code || 'unknown error'}`);
  }
  console.log('Supabase connected');
}
