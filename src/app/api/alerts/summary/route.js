import { NextResponse } from "next/server";
import { ensureAlertCacheFresh, getCachedAlertSummary } from "@/lib/alertCache";

export const runtime = "nodejs";
let lastAlertSummary = {
  total: 0,
  unacknowledged: 0,
  acknowledgedToday: 0,
  high: 0,
  medium: 0,
  low: 0,
};

export async function GET() {
  try {
    const fresh = await ensureAlertCacheFresh();
    lastAlertSummary = fresh.summary;
    return NextResponse.json(lastAlertSummary, { status: 200 });
  } catch (error) {
    try {
      const cached = await getCachedAlertSummary();
      lastAlertSummary = cached.summary;
      return NextResponse.json(
        {
          ...cached.summary,
          degraded: true,
          message: error?.message || "Unable to fetch alert summary.",
        },
        { status: 200 }
      );
    } catch {
      // Fall back to the last in-memory payload if the cache is unavailable.
    }

    return NextResponse.json(
      {
        ...lastAlertSummary,
        degraded: true,
        message: error?.message || "Unable to fetch alert summary.",
      },
      { status: 200 }
    );
  }
}
