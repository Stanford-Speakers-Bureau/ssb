import { NextRequest, NextResponse } from "next/server";
import {
  buildApplePassForTicket,
  verifyApplePassAuth,
} from "@/app/lib/wallet-pass-builder";

type Params = {
  params: Promise<{ passTypeIdentifier: string; serialNumber: string }>;
};

// GET .../passes/{passType}/{serial}
// Returns the latest .pkpass for the serial. Honors If-Modified-Since so the
// device skips the download when nothing changed (304).
export async function GET(req: NextRequest, { params }: Params) {
  const { serialNumber } = await params;

  if (!(await verifyApplePassAuth(req, serialNumber))) {
    return new NextResponse(null, { status: 401 });
  }

  const built = await buildApplePassForTicket(serialNumber);
  if (!built) {
    return new NextResponse(null, { status: 404 });
  }

  // Compare at second precision — HTTP dates have no sub-second component.
  const ifModifiedSince = req.headers.get("if-modified-since");
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    if (
      Number.isFinite(since) &&
      Math.floor(built.lastModified.getTime() / 1000) <=
        Math.floor(since / 1000)
    ) {
      return new NextResponse(null, { status: 304 });
    }
  }

  return new NextResponse(built.buffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": built.lastModified.toUTCString(),
    },
  });
}
