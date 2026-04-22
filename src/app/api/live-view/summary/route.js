import { NextResponse } from "next/server";
import { externalLiveViewFetch, LIVE_VIEW_PATHS } from "@/lib/liveViewApi";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await externalLiveViewFetch(LIVE_VIEW_PATHS.summary);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Unable to fetch live view summary.",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
