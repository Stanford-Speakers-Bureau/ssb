import { NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ authenticated: !!user });
}
