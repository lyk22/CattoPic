import { NextResponse } from "next/server";
import { normalizeWorkerOrigin } from "../../utils/baseUrl";

// Required for static export
export const dynamic = "force-static";

export async function GET() {
  const apiUrl = normalizeWorkerOrigin(
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
      ""
  );

  return NextResponse.json({
    apiUrl,
    remotePatterns: process.env.NEXT_PUBLIC_REMOTE_PATTERNS || "",
  });
}
