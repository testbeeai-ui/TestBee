import { NextResponse } from "next/server";

export async function GET() {
  const nowMs = Date.now();
  return NextResponse.json({
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
  });
}

