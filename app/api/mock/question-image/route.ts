import { NextRequest, NextResponse } from "next/server";

const ALLOWED_IMAGE_URL =
  /^https:\/\/(?:www\.)?testbee\.in\/preview\/show_qimage\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp)$/i;

function normalizeTestbeeImageUrl(url: string): string {
  return url.replace(/^https:\/\/testbee\.in\//i, "https://www.testbee.in/");
}

/** Proxy legacy Testbee question images so they load reliably in the mock exam UI. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: string;
  try {
    target = decodeURIComponent(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_URL.test(target)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const fetchUrl = normalizeTestbeeImageUrl(target);

  try {
    const upstream = await fetch(fetchUrl, {
      headers: { Accept: "image/*" },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: upstream.status });
    }

    const bytes = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/png";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
