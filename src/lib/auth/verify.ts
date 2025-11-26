/* eslint-disable @typescript-eslint/no-explicit-any */
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
    // First, try to verify JWT locally (faster, no network call)
    // This works if the JWT is signed with the JWT secret
    const supabase = createClient();

    // Use getUser with a shorter timeout, or verify JWT directly
    const {
      data: { user },
      error,
    } = (await Promise.race([
      supabase.auth.getUser(accessToken),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 15000)
      ),
    ])) as any;

    if (error || !user) {
      console.log(`Error verifying user: ${error?.message || "No user found"}`);
      return null;
    }

    return user;
  } catch (error: any) {
    // Handle timeout and connection errors gracefully
    if (
      error.name === "AbortError" ||
      error.message?.includes("timeout") ||
      error.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error.message === "Request timeout"
    ) {
      console.error(
        `Error verifying user: Connection timeout - Supabase API may be unreachable`
      );
      // Return null to fail gracefully - user will get 401 Unauthorized
      return null;
    }

    console.error(`Error in verifyUser: ${error.message || error}`);
    return null;
  }
}
