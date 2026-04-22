import { NextResponse } from "next/server";
import { ensureAlertCacheFresh, getCachedAlertSummary } from "@/lib/alertCache";
import {
  getLiveVehicleCacheSnapshot,
  isLiveVehicleCacheReadOnlyMode,
  resolveLiveVehicleScopeContext,
  triggerLiveVehicleCacheRefresh,
} from "@/lib/liveVehicleCache";
import { getVehicleStatusSummary, getVehicleStatusKey } from "@/lib/vehicleStatus";

export const runtime = "nodejs";

const DEFAULT_SPEED_LIMIT = Number(process.env.DASHBOARD_OVERSPEED_LIMIT_KMH || 80);

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function safeString(value, fallback = "") {
  const next = String(value || "").trim();
  return next || fallback;
}

function scaleToHeight(value, maxValue, minHeight = 20, maxHeight = 74) {
  const safeMax = Math.max(Number(maxValue || 0), 1);
  const ratio = Math.max(Number(value || 0), 0) / safeMax;
  return Math.round(minHeight + ratio * (maxHeight - minHeight));
}

function readVehicleDistanceKm(vehicle) {
  const distance = safeNumber(
    vehicle?.current_trip_km ??
      vehicle?.trip_distance ??
      vehicle?.today_distance ??
      vehicle?.distance_km ??
      vehicle?.today_km ??
      vehicle?.distance,
    0
  );

  return Math.max(distance, 0);
}

function buildUsageBars(vehicles, count = 12) {
  const distances = (Array.isArray(vehicles) ? vehicles : [])
    .map((vehicle) => readVehicleDistanceKm(vehicle))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);

  const picked = distances.slice(0, count);
  while (picked.length < count) picked.push(0);

  const maxValue = Math.max(...picked, 1);

  return picked.map((value, index) => ({
    label: String(index + 1),
    value: Number(value.toFixed(2)),
    heightPercent: Math.max(10, Math.round((value / maxValue) * 100)),
  }));
}

function buildDistribution(items, readKey, fallbackLabel) {
  const counts = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = safeString(readKey(item), fallbackLabel);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function parseTimestamp(row) {
  const candidates = [
    row?.timestamp,
    row?.server_time,
    row?.servertime,
    row?.updated_at,
    row?.gpstime,
    row?.gps_time,
    row?.device_time,
  ];

  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  return 0;
}

function parseDurationToMinutes(value) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1000 ? value / 60 : value;
  }

  const text = String(value).trim();
  if (!text) return null;

  const hhmmss = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmmss) {
    const hours = Number(hhmmss[1] || 0);
    const minutes = Number(hhmmss[2] || 0);
    const seconds = Number(hhmmss[3] || 0);
    return hours * 60 + minutes + seconds / 60;
  }

  const verbose = text.match(/(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?/i);
  if (verbose && (verbose[1] || verbose[2])) {
    return Number(verbose[1] || 0) * 60 + Number(verbose[2] || 0);
  }

  const plain = Number(text);
  return Number.isFinite(plain) ? plain : null;
}

function buildFreshnessSeries(vehicles, bucketCount) {
  const now = Date.now();
  const buckets = Array.from({ length: bucketCount }, () => 0);
  const windowMinutes = 6 * 60;
  const bucketSize = windowMinutes / bucketCount;

  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    const timestamp = parseTimestamp(vehicle);
    const diffMinutes = timestamp > 0 ? Math.max((now - timestamp) / 60000, 0) : windowMinutes;
    const bucketIndex = Math.min(Math.floor(diffMinutes / bucketSize), bucketCount - 1);
    buckets[bucketCount - bucketIndex - 1] += 1;
  });

  return buckets;
}

function buildTopStatusRows(vehicles, maxRows = 6) {
  const grouped = new Map();

  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    const key = safeString(vehicle?.branch || vehicle?.group1 || vehicle?.company || "Unassigned");
    if (!grouped.has(key)) {
      grouped.set(key, { running: 0, idle: 0, stopped: 0, inactive: 0, total: 0 });
    }

    const entry = grouped.get(key);
    const statusKey = getVehicleStatusKey(vehicle);
    entry.total += 1;
    if (entry[statusKey] !== undefined) {
      entry[statusKey] += 1;
    } else {
      entry.stopped += 1;
    }
  });

  return [...grouped.entries()]
    .map(([label, counts]) => {
      const total = Math.max(counts.total, 1);
      const running = Math.round((counts.running / total) * 100);
      const idle = Math.round((counts.idle / total) * 100);
      const grey = Math.max(100 - running - idle, 6);
      return {
        m: label.length > 10 ? `${label.slice(0, 10)}…` : label,
        b: running,
        g: idle,
        grey,
        total: counts.total,
      };
    })
    .sort((left, right) => right.total - left.total)
    .slice(0, maxRows);
}

function buildSavingSeries(vehicles) {
  const speeds = (Array.isArray(vehicles) ? vehicles : [])
    .map((vehicle) => safeNumber(vehicle?.speed, 0))
    .sort((left, right) => right - left);

  if (speeds.length >= 8) return speeds.slice(0, 20);

  const statusSummary = getVehicleStatusSummary(vehicles);
  return [
    statusSummary.running,
    statusSummary.idle,
    statusSummary.stopped,
    statusSummary.inactive,
    statusSummary.all,
    Math.max(statusSummary.running + statusSummary.idle, 0),
    Math.max(statusSummary.all - statusSummary.inactive, 0),
    Math.max(statusSummary.running + statusSummary.idle + statusSummary.stopped, 0),
  ];
}

function average(values) {
  const list = values.filter((value) => Number.isFinite(value));
  if (!list.length) return 0;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function buildDashboardResponseInit(meta = {}) {
  return {
    headers: {
      "x-vtp-cache-source": String(meta?.responseSource || "unknown"),
      "x-vtp-last-synced-at": String(meta?.lastSyncedAt || ""),
      "x-vtp-stale-age-ms":
        meta?.staleAgeMs === null || meta?.staleAgeMs === undefined
          ? ""
          : String(Math.max(0, Math.round(Number(meta.staleAgeMs) || 0))),
      "x-vtp-stale-served": String(Boolean(meta?.isStale)),
      "x-vtp-sync-triggered": String(Boolean(meta?.syncTriggered)),
    },
  };
}

export async function GET() {
  const liveVehicleScopeContext = await resolveLiveVehicleScopeContext().catch(() => null);
  const cacheReadOnlyMode = isLiveVehicleCacheReadOnlyMode();
  const [liveViewResult, alertSummaryResult] = await Promise.allSettled([
    (async () => {
      const snapshot = await getLiveVehicleCacheSnapshot(
        { limit: 5000 },
        { scopeContext: liveVehicleScopeContext }
      );

      if (snapshot?.meta?.hasSnapshot) {
        let syncTriggered = false;
        let effectiveSnapshot = snapshot;
        if (snapshot?.meta?.isStale) {
          const refreshResult = await triggerLiveVehicleCacheRefresh({
            scopeContext: liveVehicleScopeContext,
            reason: "dashboard-stale-while-revalidate",
          }).catch(() => null);
          syncTriggered = Boolean(refreshResult?.triggered);
          if (!cacheReadOnlyMode && refreshResult?.promise) {
            const refreshCompletion = await refreshResult.promise;
            if (refreshCompletion?.ok) {
              effectiveSnapshot = await getLiveVehicleCacheSnapshot(
                { limit: 5000 },
                { scopeContext: liveVehicleScopeContext }
              );
            } else {
              console.warn(
                "[dashboard] stale refresh completion failed:",
                refreshCompletion?.error?.message || "Unknown live vehicle sync error."
              );
            }
          }
        }

        return {
          vehicles: effectiveSnapshot?.vehicles || [],
          meta: {
            ...effectiveSnapshot?.meta,
            syncTriggered,
          },
        };
      }

      const refreshResult = await triggerLiveVehicleCacheRefresh({
        scopeContext: liveVehicleScopeContext,
        force: true,
        reason: "dashboard-cold-start",
      }).catch(() => null);
      if (refreshResult?.promise) {
        const refreshCompletion = await refreshResult.promise;
        if (!refreshCompletion?.ok) {
          console.warn(
            "[dashboard] cold-start refresh failed:",
            refreshCompletion?.error?.message || "Unknown live vehicle sync error."
          );
        }
      }

      const refreshedSnapshot = await getLiveVehicleCacheSnapshot(
        { limit: 5000 },
        { scopeContext: liveVehicleScopeContext }
      );

      return {
        vehicles: refreshedSnapshot?.vehicles || [],
        meta: {
          ...refreshedSnapshot?.meta,
          syncTriggered: Boolean(refreshResult?.triggered),
        },
      };
    })(),
    ensureAlertCacheFresh()
      .then((result) => result.summary)
      .catch(async () => {
        const cached = await getCachedAlertSummary();
        return cached.summary;
      }),
  ]);

  const liveSnapshot =
    liveViewResult.status === "fulfilled"
      ? liveViewResult.value
      : { vehicles: [], meta: { responseSource: "unknown" } };
  const vehicles = Array.isArray(liveSnapshot?.vehicles) ? liveSnapshot.vehicles : [];
  const statusSummary = getVehicleStatusSummary(vehicles);
  const alertSummary =
    alertSummaryResult.status === "fulfilled"
      ? alertSummaryResult.value
      : { total: 0, unacknowledged: 0, acknowledgedToday: 0, high: 0, medium: 0, low: 0 };

  const totalVehicles = statusSummary.all;
  const runningVehicles = statusSummary.running;
  const idleVehicles = statusSummary.idle;
  const stoppedVehicles = statusSummary.stopped + statusSummary.inactive + statusSummary.nodata;
  const ignitionOnVehicles = vehicles.filter((vehicle) => {
    const ignition = safeString(vehicle?.ignition_status).toUpperCase();
    return ignition === "ON" || getVehicleStatusKey(vehicle) === "running" || getVehicleStatusKey(vehicle) === "idle";
  }).length;

  const speeds = vehicles.map((vehicle) => safeNumber(vehicle?.speed, 0));
  const distanceValues = vehicles.map((vehicle) => readVehicleDistanceKm(vehicle));
  const avgSpeed = average(speeds);
  const maxSpeed = Math.max(...speeds, 0);
  const totalDistanceKm = distanceValues.reduce((sum, value) => sum + value, 0);
  const avgDistanceKm = totalVehicles > 0 ? totalDistanceKm / totalVehicles : 0;
  const overspeedCount = vehicles.filter((vehicle) => safeNumber(vehicle?.speed, 0) >= DEFAULT_SPEED_LIMIT).length;
  const overspeedScore = totalVehicles > 0 ? (overspeedCount / totalVehicles) * 100 : 0;

  const branchDistribution = buildDistribution(
    vehicles,
    (vehicle) => vehicle?.branch || vehicle?.group1 || vehicle?.company,
    "Unassigned"
  );
  const companyDistribution = buildDistribution(
    vehicles,
    (vehicle) => vehicle?.company || vehicle?.organizations || vehicle?.branch,
    "Shared"
  );

  const averageDriveMinutes = Math.round(
    average(
      vehicles.map((vehicle) =>
        parseDurationToMinutes(vehicle?.running_time ?? vehicle?.runningTime ?? vehicle?.drive_time ?? vehicle?.driveTime)
      )
    )
  );
  const derivedDriveMinutes =
    averageDriveMinutes > 0 ? averageDriveMinutes : Math.round(((runningVehicles + idleVehicles) / Math.max(totalVehicles, 1)) * 8 * 60);

  const dailyBarsSource = branchDistribution.slice(0, 7);
  const maxDailyValue = Math.max(...dailyBarsSource.map((item) => item.value), 1);
  const dailyBars = dailyBarsSource.map((item) => ({
    d: item.label.length > 8 ? `${item.label.slice(0, 8)}…` : item.label,
    h: scaleToHeight(item.value, maxDailyValue),
  }));

  const hoursRows = buildTopStatusRows(vehicles, 6);
  const usageBars = buildUsageBars(vehicles, 12);
  const lineSeries = {
    day: buildFreshnessSeries(vehicles, 14),
    month: branchDistribution.slice(0, 12).map((item) => item.value),
    year: companyDistribution.slice(0, 12).map((item) => item.value),
    max: [...speeds].sort((left, right) => right - left).slice(0, 18),
  };

  const savingSeries = buildSavingSeries(vehicles);

  const payload = {
    generatedAt: new Date().toISOString(),
    engine: {
      title: "Engine",
      subtitle:
        totalVehicles > 0
          ? `${ignitionOnVehicles}/${totalVehicles} vehicles ignition on`
          : "No vehicles reporting right now",
      on: ignitionOnVehicles > 0,
      onLabel: "ON",
      offLabel: "OFF",
    },
    saving: {
      amount: totalVehicles,
      displayValue: String(totalVehicles),
      subtitle: "Vehicles reporting right now",
      tooltip: ignitionOnVehicles,
      tooltipDisplayValue: `${ignitionOnVehicles} ON`,
      series: savingSeries,
      markerIndex: Math.max(Math.floor(savingSeries.length * 0.6), 0),
    },
    donut: {
      month: "Live fleet split",
      segments: [
        { label: "Running", value: runningVehicles, color: "#3DDC84" },
        { label: "Idle", value: idleVehicles, color: "#F4C542" },
        { label: "Stopped", value: statusSummary.stopped, color: "#FF5A5F" },
        { label: "InActive", value: statusSummary.inactive, color: "#2F81F7" },
        { label: "No Data", value: statusSummary.nodata, color: "#6B7280" },
      ],
    },
    usage: {
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
      avgDistanceKm: Number(avgDistanceKm.toFixed(2)),
      bars: usageBars,
    },
    daily: {
      title: "Branch Activity",
      subtitle: "Top branches by live vehicle count",
      averageMinutes: derivedDriveMinutes,
      bars: dailyBars,
      footerTitle: `${alertSummary.unacknowledged} unacknowledged alerts`,
      footerSubtitle: `High ${alertSummary.high} | Medium ${alertSummary.medium} | Low ${alertSummary.low}`,
    },
    overspeed: {
      score: Number(overspeedScore.toFixed(2)),
      alerts: overspeedCount,
      maxSpeed: Math.round(maxSpeed),
    },
    avgDriving: {
      title: "Average Driving",
      meta: "Estimated from live running telemetry",
      hours: Math.floor(derivedDriveMinutes / 60),
      minutes: derivedDriveMinutes % 60,
    },
    lineCard: {
      title: "Vehicle Activity",
      value: totalVehicles,
      series: lineSeries,
    },
    hours: {
      title: "Branch Utilization",
      value: Number(avgSpeed.toFixed(1)),
      unitLabel: "Avg km/h",
      rows: hoursRows,
    },
  };

  return NextResponse.json(payload, buildDashboardResponseInit(liveSnapshot?.meta));
}
