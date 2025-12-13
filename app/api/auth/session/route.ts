import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({ authenticated: !!user });
}
