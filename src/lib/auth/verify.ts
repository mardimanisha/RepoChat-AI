/* eslint-disable @typescript-eslint/no-explicit-any */
/* Auth utility for JWT verification in Next.js API routes */

import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Verifies the user from cookies (preferred) or Authorization header (fallback)
 * Uses cookies first to avoid 431 errors from large Authorization headers
 * @param request - Next.js Request object
 * @returns User object if valid, null otherwise
 */
export async function verifyUser(
  request: Request
): Promise<{ id: string; email?: string } | null> {
  try {
    // First, try to get user from cookies (preferred method to avoid 431 errors)
    // This uses Supabase SSR which reads from cookies automatically
    try {
      const supabase = await createServerClient();
      const {
        data: { user },
        error: cookieError,
      } = await supabase.auth.getUser();

      if (!cookieError && user) {
        return user;
      }
    } catch (cookieError: any) {
      // If cookie-based auth fails, fall back to Authorization header
      console.log("Cookie-based auth failed, trying Authorization header:", cookieError?.message);
    }

    // Fallback: Try Authorization header (for backward compatibility)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return null;
    }

    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
      return null;
    }

    // Use admin client to verify the token
    const supabase = createAdminClient();

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
