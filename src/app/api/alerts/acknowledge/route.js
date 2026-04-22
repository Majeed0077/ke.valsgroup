import { NextResponse } from "next/server";
import { ALERT_PATHS, externalAlertFetch } from "@/lib/alertApi";
import { markCachedAlertAcknowledged } from "@/lib/alertCache";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const alertId = Number(payload?.alert_id || 0);

    if (!alertId) {
      return NextResponse.json(
        { message: "A valid alert_id is required." },
        { status: 400 }
      );
    }

    const data = await externalAlertFetch(ALERT_PATHS.acknowledge, {
      method: "POST",
      body: {
        alert_id: alertId,
        remarks: String(payload?.remarks || ""),
      },
    });

    await markCachedAlertAcknowledged(alertId, payload?.remarks || "");

    return NextResponse.json(
      {
        success: true,
        message: data?.message || "Alert acknowledged.",
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Unable to acknowledge alert.",
        details: error?.payload || null,
      },
      { status: error?.status || 500 }
    );
  }
}
