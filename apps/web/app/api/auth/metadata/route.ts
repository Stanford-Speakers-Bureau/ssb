import { NextResponse } from "next/server";
import { generateMetadata } from "@/app/lib/saml";

export async function GET(request: Request) {
  try {
    const metadata = await generateMetadata(request);
    return new NextResponse(metadata, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("Stanford SSO metadata error:", error);
    return NextResponse.json(
      { error: "Failed to generate metadata" },
      { status: 500 },
    );
  }
}
