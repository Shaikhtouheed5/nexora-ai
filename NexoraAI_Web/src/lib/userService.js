/**
 * userService.js — Supabase User Management
 *
 * DB schema (users table — actual Supabase columns):
 *   id               UUID PRIMARY KEY → auth.users(id)
 *   email            TEXT
 *   name             TEXT
 *   avatar_url       TEXT
 *   xp               INTEGER DEFAULT 0
 *   level            INTEGER DEFAULT 1
 *   streak           INTEGER DEFAULT 0
 *   last_active_date TIMESTAMPTZ
 *   badges           TEXT[]
 *   auth_provider    TEXT DEFAULT 'email'
 *   created_at       TIMESTAMPTZ DEFAULT now()
 *   updated_at       TIMESTAMPTZ DEFAULT now()
 */

import supabase from './supabase';

/**
 * Upserts the authenticated user into the 'users' table.
 * Uses `id` as the primary key (matches auth.users).
 * @param {object} supabaseUser
 * @returns {Promise<object>} The full user row
 */
export async function createOrFetchUser(supabaseUser) {
  if (!supabaseUser) return null;

  const { id, email, user_metadata, app_metadata } = supabaseUser;
  const name        = user_metadata?.full_name || user_metadata?.name || email?.split('@')[0] || 'User';
  const avatar_url  = user_metadata?.avatar_url || user_metadata?.picture || null;
  const auth_provider = app_metadata?.provider || 'email';

  // Upsert — insert on first login, update on subsequent logins
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id,
        email,
        name,
        avatar_url,
        auth_provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) console.error('[userService] upsert error:', error);
  return data;
}

/**
 * Fetches full user profile from users table by id.
 * @param {string} id — Supabase auth user id
 */
export async function getUserProfile(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  if (error) console.error('[userService] fetch error:', error);
  return data;
}

/**
 * Updates specific fields in the user's profile.
 * @param {string} id
 * @param {object} updates
 */
export async function updateUserProfile(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) console.error('[userService] update error:', error);
  return data;
}
