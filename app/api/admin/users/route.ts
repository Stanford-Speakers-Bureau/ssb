import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../lib/supabase";

export async function GET() {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Get all admins
    const { data: admins, error: adminsError } = await auth.adminClient!
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (adminsError) {
      console.error("Admins fetch error:", adminsError);
      return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 });
    }

    // Get all bans
    const { data: bans, error: bansError } = await auth.adminClient!
      .from("bans")
      .select("*")
      .order("created_at", { ascending: false });

    if (bansError) {
      console.error("Bans fetch error:", bansError);
      return NextResponse.json({ error: "Failed to fetch bans" }, { status: 500 });
    }

    return NextResponse.json({ admins: admins || [], bans: bans || [] });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { email, id, type, action } = body;

    if (!type || !["admin", "ban"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const table = type === "admin" ? "admins" : "bans";

    if (action === "add") {
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }

      // Check if already exists
      const { data: existing } = await auth.adminClient!
        .from(table)
        .select("id")
        .eq("email", email)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: `This email is already ${type === "admin" ? "an admin" : "banned"}` },
          { status: 400 }
        );
      }

      const { error } = await auth.adminClient!.from(table).insert([{ email }]);

      if (error) {
        console.error("Insert error:", error);
        return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      // Remove
      if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
      }

      const { error } = await auth.adminClient!.from(table).delete().eq("id", id);

      if (error) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Users action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

