import { supabase } from '../config/supabase.js';
import { unwrap } from './errors.js';
import { serializeUser } from './serializers.js';

const PUBLIC_PROFILE_COLUMNS = 'id,name,email,phone,role,is_active,created_at,updated_at';
const USER_WITH_ADDRESSES = `${PUBLIC_PROFILE_COLUMNS},addresses(*)`;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Public user (no password hash / reset token) with addresses, in the shape the client expects.
export async function getUserById(id) {
  const row = unwrap(
    await supabase.from('profiles').select(USER_WITH_ADDRESSES).eq('id', id).maybeSingle(),
    'Failed to load user'
  );
  return serializeUser(row);
}

export async function getUserByLegacyId(legacyId) {
  const row = unwrap(
    await supabase.from('profiles').select(USER_WITH_ADDRESSES).eq('legacy_mongo_id', legacyId).maybeSingle(),
    'Failed to load user'
  );
  return serializeUser(row);
}

// Internal lookup that includes the password hash. Never send the result to a client.
export async function getAuthProfileByEmail(email) {
  return unwrap(
    await supabase
      .from('profiles')
      .select(`${PUBLIC_PROFILE_COLUMNS},password_hash`)
      .eq('email', normalizeEmail(email))
      .maybeSingle(),
    'Failed to load user'
  );
}

export async function getPasswordHash(id) {
  const row = unwrap(
    await supabase.from('profiles').select('password_hash').eq('id', id).maybeSingle(),
    'Failed to load user'
  );
  return row?.password_hash ?? null;
}

export async function emailExists(email, excludeId) {
  let query = supabase.from('profiles').select('id').eq('email', normalizeEmail(email));
  if (excludeId) query = query.neq('id', excludeId);
  const rows = unwrap(await query.limit(1), 'Failed to check email');
  return rows.length > 0;
}
