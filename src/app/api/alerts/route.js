import { NextResponse } from "next/server";
import { ensureAlertCacheFresh, getAlertsFromCache } from "@/lib/alertCache";

export const runtime = "nodejs";
let lastAlertsPayload = {
  alerts: [],
  total: 0,
  unacknowledged_count: 0,
  summary: {
    total: 0,
    unacknowledged: 0,
    acknowledgedToday: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
};

function readQuery(url) {
  const { searchParams } = new URL(url);
  return {
    acknowledged: searchParams.get("acknowledged") || "",
    severity: searchParams.get("severity") || "",
    imei: searchParams.get("imei") || "",
    obj_name: searchParams.get("obj_name") || "",
    rule_name: searchParams.get("rule_name") || "",
    search: searchParams.get("search") || "",
    from_date: searchParams.get("from_date") || "",
    to_date: searchParams.get("to_date") || "",
    limit: searchParams.get("limit") || "8",
    offset: searchParams.get("offset") || "0",
  };
}

function hasUsableAlertPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (Array.isArray(payload.alerts) && payload.alerts.length > 0) return true;
  if (Number(payload.total || 0) > 0) return true;
  if (Number(payload?.summary?.total || 0) > 0) return true;
  return Boolean(payload.cacheState);
}

export async function GET(request) {
  const query = readQuery(request.url);
  try {
    const cachedPayload = await getAlertsFromCache(query);
    if (hasUsableAlertPayload(cachedPayload)) {
      lastAlertsPayload = cachedPayload;
      ensureAlertCacheFresh().catch((error) => {
        console.warn("[api/alerts] background refresh failed:", error?.message || "Unknown alerts sync error.");
      });
      return NextResponse.json(cachedPayload, { status: 200 });
    }

    await ensureAlertCacheFresh();
    lastAlertsPayload = await getAlertsFromCache(query);
    return NextResponse.json(lastAlertsPayload, { status: 200 });
  } catch (error) {
    try {
      const cachedPayload = await getAlertsFromCache(query);
      lastAlertsPayload = cachedPayload;
      return NextResponse.json(
        {
          ...cachedPayload,
          degraded: true,
          message: error?.message || "Unable to fetch alerts.",
        },
        { status: 200 }
      );
    } catch {
      // Fall back to the last in-memory payload if cache access also fails.
    }

    return NextResponse.json(
      {
        ...lastAlertsPayload,
        degraded: true,
        message: error?.message || "Unable to fetch alerts.",
      },
      { status: 200 }
    );
  }
}
