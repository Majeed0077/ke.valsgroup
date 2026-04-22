import { NextResponse } from "next/server";
import { externalLiveViewFetch, LIVE_VIEW_PATHS, normalizeLiveViewRows } from "@/lib/liveViewApi";

export const runtime = "nodejs";

function readQuery(url) {
  const { searchParams } = new URL(url);
  return {
    obj_name: searchParams.get("obj_name") || "",
    obj_reg_no: searchParams.get("obj_reg_no") || "",
    group1: searchParams.get("group1") || "",
    branch: searchParams.get("branch") || "",
    company: searchParams.get("company") || "",
    organizations: searchParams.get("organizations") || "",
    imei_id: searchParams.get("imei_id") || "",
    min_speed: searchParams.get("min_speed") || "",
    max_speed: searchParams.get("max_speed") || "",
    movement_status: searchParams.get("movement_status") || "",
    ignition_status: searchParams.get("ignition_status") || "",
    gps_fix_status: searchParams.get("gps_fix_status") || "",
    sos_status: searchParams.get("sos_status") || "",
    from_date: searchParams.get("from_date") || "",
    to_date: searchParams.get("to_date") || "",
    limit: searchParams.get("limit") || "",
    offset: searchParams.get("offset") || "",
  };
}

export async function GET(request) {
  try {
    const data = await externalLiveViewFetch(LIVE_VIEW_PATHS.live, readQuery(request.url));
    return NextResponse.json(normalizeLiveViewRows(data), { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Unable to fetch live vehicle data.",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
