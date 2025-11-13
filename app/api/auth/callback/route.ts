import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API: GET /api/auth/callback
// Handles OAuth callback from Google sign-in
// Checks if email is Stanford, saves to Supabase if yes, shows error if no

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration: please set SUPABASE_URL and SUPABASE_KEY."
    );
  }
  
  return createClient(url, key);
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration: please set SUPABASE_URL and SUPABASE_KEY."
    );
  }
  
  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const redirectTo = searchParams.get("redirect_to") || "/events/malala";
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Construct base URL for redirects
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

    // Debug: Log all query parameters
    const allParams = Object.fromEntries(searchParams.entries());
    console.log("OAuth callback params:", allParams);

    // Handle OAuth errors
    if (error) {
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", error);
      errorUrl.searchParams.set("error_message", errorDescription || "Authentication failed");
      return NextResponse.redirect(errorUrl.toString());
    }

    if (!code) {
      // Check if there are any other parameters that might indicate what happened
      console.log("No code found. All params:", allParams);
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "no_code");
      errorUrl.searchParams.set("error_message", "No authorization code provided. Please try signing in again.");
      return NextResponse.redirect(errorUrl.toString());
    }

    const supabase = getSupabaseClient();
    
    // Exchange the code for a session
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.session) {
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "auth_failed");
      errorUrl.searchParams.set("error_message", authError?.message || "Failed to authenticate");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Get user email from the session
    const email = authData.user?.email;
    
    if (!email) {
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "no_email");
      errorUrl.searchParams.set("error_message", "No email found in account");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Check if email is Stanford
    const domain = email.split("@").pop()?.toLowerCase();
    const isStanford = domain === "stanford.edu";

    if (!isStanford) {
      // Sign out the user since they're not Stanford
      await supabase.auth.signOut();
      
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "not_stanford");
      errorUrl.searchParams.set("error_message", "Please sign in with a Stanford email address (@stanford.edu)");
      return NextResponse.redirect(errorUrl.toString());
    }

    // Save email to Supabase malala_emails table
    const supabaseAdmin = getSupabaseAdmin();
    
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("malala_emails")
      .insert({ 
        email: email, 
        meta: { event: "malala", source: "google_signin" } 
      })
      .select("email, created_at")
      .single();

    // Sign out the user after saving (we don't need to keep them signed in)
    await supabase.auth.signOut();

    if (insertError) {
      // Handle duplicate email gracefully
      const msg = (insertError as { message?: string })?.message || "Supabase insert error";
      const isConflict =
        typeof msg === "string" && /duplicate key|unique constraint/i.test(msg);
      
      if (isConflict) {
        // Email already exists, that's fine - redirect with success
        const successUrl = new URL(redirectTo, baseUrl);
        successUrl.searchParams.set("success", "true");
        successUrl.searchParams.set("message", "You're already signed up!");
        return NextResponse.redirect(successUrl.toString());
      }
      
      // Other error
      const errorUrl = new URL(redirectTo, baseUrl);
      errorUrl.searchParams.set("error", "save_failed");
      errorUrl.searchParams.set("error_message", msg);
      return NextResponse.redirect(errorUrl.toString());
    }

    // Success - redirect back to event page
    const successUrl = new URL(redirectTo, baseUrl);
    successUrl.searchParams.set("success", "true");
    successUrl.searchParams.set("message", "Successfully signed up! You'll be notified when tickets open.");
    return NextResponse.redirect(successUrl.toString());
    
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unexpected server error";
    const { searchParams } = new URL(req.url);
    const redirectTo = searchParams.get("redirect_to") || "/events/malala";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    const errorUrl = new URL(redirectTo, baseUrl);
    errorUrl.searchParams.set("error", "server_error");
    errorUrl.searchParams.set("error_message", errorMessage);
    return NextResponse.redirect(errorUrl.toString());
  }
}

