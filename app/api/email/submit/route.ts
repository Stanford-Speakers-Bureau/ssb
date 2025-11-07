import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API: POST /api/email/submit
// Body: { email: string, meta?: Record<string, any> }
// Inserts into Supabase table `email_signups` with columns: email (text, unique), created_at (timestamptz, default now()), meta (jsonb, nullable)
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY (or SUPABASE_KEY)
//
// Example curl:
// curl -X POST \
//   -H "Content-Type: application/json" \
//   -d '{"email":"student@stanford.edu","meta":{"source":"contact"}}' \
//   http://localhost:3000/api/email/submit

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration: please set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY)."
    );
  }
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const rawEmail = (body.email ?? "").toString().trim();
    const meta = typeof body.meta === "object" && body.meta !== null ? body.meta : undefined;

    if (!rawEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    // Enforce Stanford domain
    const domain = rawEmail.split("@").pop()?.toLowerCase();
    if (domain !== "stanford.edu") {
      return NextResponse.json(
        { error: "Email must be a stanford.edu address" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Attempt insert
    const { data, error } = await supabase
      .from("malala_emails")
      .insert({ email: rawEmail, meta })
      .select("email, created_at")
      .single();

    if (error) {
      // handle unique violation (duplicate email) gracefully
      const msg = (error as any)?.message || "Supabase insert error";
      const isConflict =
        typeof msg === "string" && /duplicate key|unique constraint/i.test(msg);
      return NextResponse.json(
        { error: isConflict ? "Email already submitted" : msg },
        { status: isConflict ? 409 : 500 }
      );
    }

    return NextResponse.json(
      { success: true, record: data },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
