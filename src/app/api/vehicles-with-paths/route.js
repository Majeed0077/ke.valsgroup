import { NextResponse } from "next/server";
import {
  getLiveVehicleDebugSnapshot,
  getLiveVehicleCacheSnapshot,
  isLiveVehicleDirectFallbackEnabled,
  resolveLiveVehicleScopeContext,
  triggerLiveVehicleCacheRefresh,
} from "@/lib/liveVehicleCache";
import {
  externalLiveViewFetch,
  LIVE_VIEW_PATHS,
  normalizeLiveViewRows,
} from "@/lib/liveViewApi";

export const runtime = "nodejs";
const DIRECT_LIVE_MAX_RECORDS = Math.max(
  100,
  Number(process.env.LIVE_VEHICLE_QUERY_LIMIT || process.env.LIVE_VEHICLE_SYNC_MAX_RECORDS || 5000)
);
const DIRECT_LIVE_PAGE_SIZE = Math.max(
  100,
  Math.min(DIRECT_LIVE_MAX_RECORDS, Number(process.env.EXTERNAL_LIVE_VIEW_PAGE_SIZE || 1000))
);
const ENABLE_VEHICLES_WITH_PATHS_LOGS = String(
  process.env.VEHICLES_WITH_PATHS_DEBUG || ""
).trim() === "1";

function slimVehiclePayloadForClient(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (!row || typeof row !== "object") return row;
    const { raw, ...rest } = row;
    const next = { ...rest };

    if (
      String(next.obj_reg_no || "").trim() !== "" &&
      String(next.obj_reg_no || "").trim() === String(next.vehicle_no || "").trim()
    ) {
      delete next.obj_reg_no;
    }

    if (
      String(next.vehicle_name || "").trim() !== "" &&
      String(next.vehicle_name || "").trim() === String(next.obj_name || "").trim()
    ) {
      delete next.vehicle_name;
    }

    return next;
  });
}

function buildResponseInit(source, durationMs, meta = {}, extraHeaders = {}) {
  return {
    status: 200,
    headers: {
      "x-vtp-vehicle-source": String(source || "unknown"),
      "x-vtp-vehicle-duration-ms": String(Math.max(0, Math.round(Number(durationMs) || 0))),
      "x-vtp-cache-source": String(meta?.responseSource || source || "unknown"),
      "x-vtp-last-synced-at": String(meta?.lastSyncedAt || ""),
      "x-vtp-stale-age-ms":
        meta?.staleAgeMs === null || meta?.staleAgeMs === undefined
          ? ""
          : String(Math.max(0, Math.round(Number(meta.staleAgeMs) || 0))),
      "x-vtp-stale-served": String(Boolean(meta?.isStale)),
      "x-vtp-sync-triggered": String(Boolean(meta?.syncTriggered)),
      ...extraHeaders,
    },
  };
}

async function logVehicleRouteResult(scopeContext, query, source, count, startedAt) {
  const durationMs = Date.now() - startedAt;
  if (!ENABLE_VEHICLES_WITH_PATHS_LOGS) {
    return durationMs;
  }
  try {
    const snapshot = await getLiveVehicleDebugSnapshot({ scopeContext });
    console.info("[vehicles-with-paths]", {
      source,
      count,
      durationMs,
      scopeKey: snapshot?.scopeKey || "",
      readStorage: snapshot?.readStorage || "",
      mongoBucketCount: Number(snapshot?.mongoBucketCount || 0),
      mongoFilteredCount: Number(snapshot?.mongoFilteredCount || 0),
      memoryBucketCount: Number(snapshot?.memoryBucketCount || 0),
      query: hasActiveVehicleFilters(query) ? query : {},
    });
  } catch {
    console.info("[vehicles-with-paths]", {
      source,
      count,
      durationMs,
      query: hasActiveVehicleFilters(query) ? query : {},
    });
  }
  return durationMs;
}

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

function hasActiveVehicleFilters(query) {
  return Object.entries(query).some(([key, value]) => {
    if (key === "limit" || key === "offset") return false;
    return String(value || "").trim().length > 0;
  });
}

function extractLiveRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.vehicles)) return payload.vehicles;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function readPayloadTotal(payload) {
  const explicitTotal = Number(payload?.total || payload?.count || payload?.total_count || 0);
  return Number.isFinite(explicitTotal) && explicitTotal > 0 ? explicitTotal : 0;
}

function buildPageSignature(rows = []) {
  return rows
    .slice(0, 10)
    .map((row) =>
      String(
        row?.imei_id ||
          row?.imeiId ||
          row?.vehicle_no ||
          row?.obj_reg_no ||
          row?.obj_name ||
          `${row?.latitude ?? ""}:${row?.longitude ?? ""}`
      ).trim()
    )
    .filter(Boolean)
    .join("|");
}

async function fetchDirectLiveVehicles(query) {
  const explicitLimit = Number(query?.limit || 0);
  const hasExplicitLimit = Number.isFinite(explicitLimit) && explicitLimit > 0;
  const maxRecords = hasExplicitLimit
    ? Math.min(DIRECT_LIVE_MAX_RECORDS, explicitLimit)
    : DIRECT_LIVE_MAX_RECORDS;

  const rows = [];
  let offset = Math.max(0, Number(query?.offset || 0));
  let reportedTotal = 0;
  let previousPageSignature = "";

  while (rows.length < maxRecords) {
    const limit = Math.min(DIRECT_LIVE_PAGE_SIZE, maxRecords - rows.length);
    const payload = await externalLiveViewFetch(LIVE_VIEW_PATHS.live, {
      ...query,
      limit,
      offset,
    });
    const pageRows = extractLiveRows(payload);
    const explicitTotalCount = readPayloadTotal(payload);
    if (explicitTotalCount > 0) {
      reportedTotal = explicitTotalCount;
    }

    if (pageRows.length === 0) break;

    const pageSignature = buildPageSignature(pageRows);
    if (offset > 0 && pageSignature && pageSignature === previousPageSignature) break;

    rows.push(...pageRows);
    offset += pageRows.length;
    previousPageSignature = pageSignature;

    if (reportedTotal > 0 && offset >= reportedTotal) break;
    if (pageRows.length < limit && reportedTotal <= 0) break;
  }

  return normalizeLiveViewRows(rows);
}

export async function GET(request) {
  const startedAt = Date.now();
  const query = readQuery(request.url);
  const scopeContext = await resolveLiveVehicleScopeContext();
  try {
    const snapshot = await getLiveVehicleCacheSnapshot(query, { scopeContext });
    const hasSnapshot = Boolean(snapshot?.meta?.hasSnapshot);

    if (hasSnapshot) {
      let refreshMeta = { syncTriggered: false };
      if (snapshot?.meta?.isStale) {
        const refreshResult = await triggerLiveVehicleCacheRefresh({
          scopeContext,
          reason: "stale-while-revalidate",
        }).catch((error) => {
          console.warn(
            "[vehicles-with-paths] background refresh failed:",
            error?.message || "Unknown live vehicle sync error."
          );
          return null;
        });
        refreshMeta = {
          syncTriggered: Boolean(refreshResult?.triggered),
          syncReusedSingleFlight: Boolean(refreshResult?.reused),
        };
        if (refreshResult?.promise) {
          refreshResult.promise
            .then((refreshCompletion) => {
              if (!refreshCompletion?.ok) {
                console.warn(
                  "[vehicles-with-paths] stale refresh completion failed:",
                  refreshCompletion?.error?.message || "Unknown live vehicle sync error."
                );
              }
            })
            .catch((error) => {
              console.warn(
                "[vehicles-with-paths] stale refresh completion failed:",
                error?.message || "Unknown live vehicle sync error."
              );
            });
        }
      }
      const durationMs = await logVehicleRouteResult(
        scopeContext,
        query,
        snapshot?.meta?.isStale ? "stale-cache" : "cache-hit",
        Array.isArray(snapshot?.vehicles) ? snapshot.vehicles.length : 0,
        startedAt
      );
      return NextResponse.json(
        slimVehiclePayloadForClient(snapshot?.vehicles || []),
        buildResponseInit(
          snapshot?.meta?.isStale ? "stale-cache" : "cache-hit",
          durationMs,
          {
            ...snapshot?.meta,
            ...refreshMeta,
          },
          {
            "x-vtp-sync-reused-single-flight": String(Boolean(refreshMeta.syncReusedSingleFlight)),
          }
        )
      );
    }

    const coldStartRefresh = await triggerLiveVehicleCacheRefresh({
      scopeContext,
      force: true,
      reason: "cold-start",
    });
    if (coldStartRefresh?.promise) {
      const coldStartCompletion = await coldStartRefresh.promise;
      if (!coldStartCompletion?.ok) {
        console.warn(
          "[vehicles-with-paths] cold-start refresh failed:",
          coldStartCompletion?.error?.message || "Unknown live vehicle sync error."
        );
      }
    }
    const refreshedSnapshot = await getLiveVehicleCacheSnapshot(query, { scopeContext });
    const refreshedVehicles = refreshedSnapshot?.vehicles || [];
    if (Array.isArray(refreshedVehicles) && refreshedVehicles.length > 0) {
      const durationMs = await logVehicleRouteResult(
        scopeContext,
        query,
        "cold-start-sync",
        refreshedVehicles.length,
        startedAt
      );
      return NextResponse.json(
        slimVehiclePayloadForClient(refreshedVehicles),
        buildResponseInit("cold-start-sync", durationMs, {
          ...refreshedSnapshot?.meta,
          syncTriggered: Boolean(coldStartRefresh?.triggered),
        })
      );
    }

    if (isLiveVehicleDirectFallbackEnabled()) {
      const directVehicles = await fetchDirectLiveVehicles(query);
      const durationMs = await logVehicleRouteResult(
        scopeContext,
        query,
        "direct-live-fallback",
        Array.isArray(directVehicles) ? directVehicles.length : 0,
        startedAt
      );
      return NextResponse.json(
        slimVehiclePayloadForClient(directVehicles || []),
        buildResponseInit("direct-live-fallback", durationMs, {
          responseSource: "direct-live-fallback",
          syncTriggered: Boolean(coldStartRefresh?.triggered),
        })
      );
    }

    const durationMs = await logVehicleRouteResult(scopeContext, query, "empty-cache", 0, startedAt);
    return NextResponse.json(
      [],
      buildResponseInit("empty-cache", durationMs, {
        responseSource: "empty-cache",
        syncTriggered: Boolean(coldStartRefresh?.triggered),
      })
    );
  } catch (error) {
    try {
      const snapshot = await getLiveVehicleCacheSnapshot(query, { scopeContext });
      const vehicles = snapshot?.vehicles || [];
      if (snapshot?.meta?.hasSnapshot) {
        const durationMs = await logVehicleRouteResult(
          scopeContext,
          query,
          "stale-cache-fallback",
          vehicles.length,
          startedAt
        );
        return NextResponse.json(
          slimVehiclePayloadForClient(vehicles),
          buildResponseInit("stale-cache-fallback", durationMs, {
            ...snapshot?.meta,
            isStale: true,
          })
        );
      }
    } catch {}

    if (isLiveVehicleDirectFallbackEnabled()) {
      try {
        const directVehicles = await fetchDirectLiveVehicles(query);
        const durationMs = await logVehicleRouteResult(
          scopeContext,
          query,
          "direct-live-fallback",
          Array.isArray(directVehicles) ? directVehicles.length : 0,
          startedAt
        );
        return NextResponse.json(
          slimVehiclePayloadForClient(directVehicles || []),
          buildResponseInit("direct-live-fallback", durationMs, {
            responseSource: "direct-live-fallback",
          })
        );
      } catch {}
    }

    return NextResponse.json(
      {
        error: error?.message || "Unable to fetch live vehicle data.",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
