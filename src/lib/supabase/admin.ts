/**
 * Admin client for Supabase (Service role)
 * Use this ONLY for privileged operations like:
 * - User signup (admin.createUser)
 * - Background tasks
 * - System-level operations
 * 
 * NEVER use this in client-side code or expose service role key
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  
  adminClient = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  return adminClient;
}


