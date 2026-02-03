/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OPTIONS /api/auth/signin
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * POST /api/auth/signin
 * Sign in endpoint supporting both email/password and OAuth (Google) authentication
 *
 * For email/password: Send { email, password }
 * For OAuth: Send { provider: "google", redirectTo?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, provider, redirectTo } = body;

    const supabase = await createClient();

    // Handle OAuth sign-in (Google)
    if (provider === "google") {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        return NextResponse.json(
          { error: "Supabase URL not configured" },
          {
            status: 500,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
          }
        );
      }

      // Determine redirect URL
      const origin = request.headers.get("origin") || request.nextUrl.origin;
      const finalRedirectTo = redirectTo || `${origin}/dashboard`;

      // Generate OAuth URL using Supabase's signInWithOAuth
      // Note: In server-side context, we construct the URL manually
      const oauthUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
      oauthUrl.searchParams.set("provider", "google");
      oauthUrl.searchParams.set("redirect_to", finalRedirectTo);

      // Get the public anon key for the URL
      const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (publicAnonKey) {
        oauthUrl.searchParams.set("api_key", publicAnonKey);
      }

      return NextResponse.json(
        {
          success: true,
          oauthUrl: oauthUrl.toString(),
          provider: "google",
          message: "Please visit the OAuth URL to complete sign-in",
          instructions:
            "Click the oauthUrl link or copy it to your browser to complete Google sign-in",
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        }
      );
    }

    // Handle email/password sign-in
    if (email && password) {
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log(`[AUTH] Sign in error: ${error.message}`);
        return NextResponse.json(
          { error: error.message || "Invalid email or password" },
          {
            status: 401,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      return NextResponse.json(
        {
          success: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name,
          },
          message: "Signed in successfully",
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // If neither OAuth nor email/password provided
    return NextResponse.json(
      {
        error:
          "Invalid request. Provide either { provider: 'google' } or { email, password }",
      },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    console.error(`[AUTH] Server error during signin:`, error);
    return NextResponse.json(
      { error: "Internal server error during sign in" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
