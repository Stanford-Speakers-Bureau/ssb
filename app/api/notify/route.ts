import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, speaker_id } = body;

    if (!email || !speaker_id) {
      return NextResponse.json(
        { error: "Missing required fields: email and speaker_id are required." },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("notify")
      .insert([
        {
          email,
          speaker_id,
        },
      ])
      .select();

    if (error) {
      console.error("Error inserting into notify table:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in notify route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
