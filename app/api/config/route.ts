import { NextResponse } from "next/server";
import { normalizeWorkerOrigin } from "../../utils/baseUrl";

/** Resolve at request time so server-only `API_URL` can override without a client rebuild. */
export const dynamic = "force-dynamic";

export async function GET() {
  const apiUrl = normalizeWorkerOrigin(
    process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      ""
  );

  return NextResponse.json(
    {
      apiUrl,
      remotePatterns: process.env.NEXT_PUBLIC_REMOTE_PATTERNS || "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
