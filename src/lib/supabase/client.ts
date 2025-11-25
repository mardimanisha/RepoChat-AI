/**
 * Browser client for Supabase
 * Use this in client components and browser-side code
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  return createBrowserClient(supabaseUrl, publicAnonKey);
}


