import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildCookieNames } from "@/lib/authCore";

export const runtime = "nodejs";

const BASE_URL = process.env.EXTERNAL_MAPVIEW_API_URL;    // yes: you used same base in your example
const TOKEN = process.env.EXTERNAL_MAPVIEW_API_TOKEN;
const USER_ID = process.env.EXTERNAL_MAPVIEW_API_USERID;
const COOKIE_NAMES = buildCookieNames("customer");

export async function GET() {
  if (!BASE_URL || !TOKEN || !USER_ID) {
    console.error(
      "[/api/fuel] Missing env config: EXTERNAL_MAPVIEW_API_URL / EXTERNAL_MAPVIEW_API_TOKEN / EXTERNAL_MAPVIEW_API_USERID"
    );
    return NextResponse.json({ error: "Server configuration error (fuel)." }, { status: 500 });
  }

  const upstreamUrl = `${BASE_URL}/vtp/fuelrate`;
  const cookieStore = await cookies();
  const loginFor = cookieStore.get(COOKIE_NAMES.loginFor)?.value || "";
  const loginKey = cookieStore.get(COOKIE_NAMES.loginKey)?.value || "";

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        token: TOKEN,
        userid: USER_ID,
        Accept: "application/json",
        ...(loginFor ? { login_for: loginFor } : {}),
        ...(loginKey ? { login_key: loginKey } : {}),
      },
      cache: "no-store",
    });

    const bodyText = await upstream.text();

    if (!upstream.ok) {
      console.error(`[/api/fuel] Upstream error: ${upstream.status} ${upstream.statusText}`);
      try {
        const parsed = JSON.parse(bodyText);
        return NextResponse.json(parsed, { status: upstream.status });
      } catch {
        return NextResponse.json(
          { error: "Upstream fuel failed", details: bodyText },
          { status: upstream.status }
        );
      }
    }

    try {
      const data = JSON.parse(bodyText);
      return NextResponse.json(data, { status: 200 });
    } catch (e) {
      console.error("[/api/fuel] JSON parse failed:", e?.message || e);
      return NextResponse.json(
        { error: "Invalid JSON from upstream fuel", details: bodyText },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[/api/fuel] Network/fetch error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to connect to upstream fuel", details: String(error?.message || error) },
      { status: 503 }
    );
  }
}
