import { NextResponse } from "next/server";
import { externalLiveViewFetch, LIVE_VIEW_PATHS } from "@/lib/liveViewApi";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await externalLiveViewFetch(LIVE_VIEW_PATHS.branches, {
      search: searchParams.get("search") || "",
    });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Unable to fetch branches LOV.",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
