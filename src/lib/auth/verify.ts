/* Auth utility for JWT verification in Next.js API routes */

import { createClient } from "@/lib/supabase/admin";

/**
 * Verifies the user from the Authorization header
 * @param request - Next.js Request object
 * @returns User object if valid, null otherwise
 */
export async function verifyUser(
  request: Request
): Promise<{ id: string; email?: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const accessToken = authHeader.split(" ")[1];
  if (!accessToken) {
    return null;
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      console.log(`Error verifying user: ${error?.message}`);
      return null;
    }

    return user;
  } catch (error) {
    console.log(`Error in verifyUser: ${error}`);
    return null;
  }
}

