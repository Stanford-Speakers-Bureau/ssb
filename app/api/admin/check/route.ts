import { NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../lib/supabase";

export async function GET() {
  try {
    const auth = await verifyAdminRequest();

    if (!auth.authorized) {
      // For the admin layout, treat unauthenticated / unauthorized as non-admin
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        isAdmin: true,
        email: auth.email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin check error:", error);
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}

