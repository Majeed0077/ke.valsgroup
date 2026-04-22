import { NextResponse } from "next/server";
import {
  externalHistoryReplayFetch,
  HISTORY_REPLAY_PATHS,
  normalizeHistoryReplayRows,
} from "@/lib/historyReplayApi";
import {
  readPlaybackHistoryCache,
  writePlaybackHistoryCache,
} from "@/lib/playbackHistoryCache";

const DEFAULT_HISTORY_REPLAY_PAGE_SIZE = 100;
const MAX_HISTORY_REPLAY_PAGE_SIZE = 500;
const MAX_HISTORY_REPLAY_TOTAL_ROWS = 20000;

function normalizeHistoryReplayDateParam(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalizedRaw = raw.replace(/\s+/, "T");
  const explicitDateTimeMatch = normalizedRaw.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/
  );
  if (explicitDateTimeMatch) {
    const [, datePart, timePart, secondsPart] = explicitDateTimeMatch;
    return `${datePart}T${timePart}:${secondsPart || "00"}`;
  }

  const explicitDateMatch = normalizedRaw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (explicitDateMatch) return explicitDateMatch[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");
  const hasExplicitTime = /[t\s]\d{1,2}:\d{2}/i.test(raw);
  return hasExplicitTime
    ? `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
    : `${year}-${month}-${day}`;
}

function buildErrorResponse(error) {
  const status =
    Number(error?.status) || (/sign in again/i.test(String(error?.message || "")) ? 401 : 500);
  return NextResponse.json(
    {
      error: String(error?.message || "Unable to fetch playback history."),
      ...(error?.payload && typeof error.payload === "object" ? { details: error.payload } : {}),
    },
    { status }
  );
}

function mergeHistoryReplayRows(rows = []) {
  const seenKeys = new Set();
  const merged = [];

  (Array.isArray(rows) ? rows : []).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const key = [
      String(item.id || ""),
      Number(item.timestamp || 0),
      Number(item.lat ?? item.latitude ?? 0).toFixed(6),
      Number(item.lng ?? item.longitude ?? 0).toFixed(6),
      Number(item.speed_kmh ?? item.speed ?? 0).toFixed(2),
    ].join("|");
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    merged.push(item);
  });

  return merged.sort((left, right) => {
    const leftTimestamp = Number(left?.timestamp || 0);
    const rightTimestamp = Number(right?.timestamp || 0);
    if (leftTimestamp && rightTimestamp) return leftTimestamp - rightTimestamp;
    return 0;
  });
}

function haversineMeters(fromRow, toRow) {
  const fromLat = Number(fromRow?.lat ?? fromRow?.latitude);
  const fromLng = Number(fromRow?.lng ?? fromRow?.longitude);
  const toLat = Number(toRow?.lat ?? toRow?.latitude);
  const toLng = Number(toRow?.lng ?? toRow?.longitude);
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return 0;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

function normalizeHeadingDelta(fromHeading, toHeading) {
  const from = Number(fromHeading);
  const to = Number(toHeading);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  let delta = Math.abs((to % 360) - (from % 360));
  if (delta > 180) delta = 360 - delta;
  return delta;
}

function getPlaybackShapingPolicy(fromDate, toDate, rowCount) {
  const parsedFrom = new Date(fromDate);
  const parsedTo = new Date(toDate);
  const durationMs =
    !Number.isNaN(parsedFrom.getTime()) && !Number.isNaN(parsedTo.getTime())
      ? Math.max(0, parsedTo.getTime() - parsedFrom.getTime())
      : 0;

  if (rowCount <= 1200) {
    return { enabled: false };
  }

  if (durationMs <= 24 * 60 * 60 * 1000) {
    return {
      enabled: true,
      targetMaxPoints: 2500,
      minTimeGapMs: 60 * 1000,
      minDistanceMeters: 120,
      minHeadingDelta: 24,
      minSpeedDelta: 8,
    };
  }

  if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
    return {
      enabled: true,
      targetMaxPoints: 3000,
      minTimeGapMs: 5 * 60 * 1000,
      minDistanceMeters: 350,
      minHeadingDelta: 22,
      minSpeedDelta: 10,
    };
  }

  return {
    enabled: true,
    targetMaxPoints: 4000,
    minTimeGapMs: 15 * 60 * 1000,
    minDistanceMeters: 800,
    minHeadingDelta: 20,
    minSpeedDelta: 12,
  };
}

function shapeHistoryReplayRows(rows = [], fromDate, toDate) {
  const mergedRows = mergeHistoryReplayRows(rows);
  const policy = getPlaybackShapingPolicy(fromDate, toDate, mergedRows.length);
  if (!policy?.enabled) {
    return mergedRows;
  }

  const keptEntries = [];
  const firstRow = mergedRows[0] || null;
  const lastRow = mergedRows[mergedRows.length - 1] || null;
  if (!firstRow) return [];

  keptEntries.push({ row: firstRow, important: true });
  let lastKeptRow = firstRow;

  for (let index = 1; index < mergedRows.length - 1; index += 1) {
    const currentRow = mergedRows[index];
    const previousRow = mergedRows[index - 1] || null;
    const nextRow = mergedRows[index + 1] || null;

    const previousStatus = String(previousRow?.movement_status || "").trim();
    const currentStatus = String(currentRow?.movement_status || "").trim();
    const previousIgnition = String(previousRow?.ignition_status || "").trim();
    const currentIgnition = String(currentRow?.ignition_status || "").trim();
    const hasEvent = String(currentRow?.event_name || "").trim() !== "";
    const statusChanged = previousStatus !== currentStatus;
    const ignitionChanged = previousIgnition !== currentIgnition;
    const distanceFromLastKept = haversineMeters(lastKeptRow, currentRow);
    const headingDelta = normalizeHeadingDelta(lastKeptRow?.heading, currentRow?.heading);
    const speedDelta = Math.abs(
      Number(currentRow?.speed_kmh ?? currentRow?.speed ?? 0) -
        Number(lastKeptRow?.speed_kmh ?? lastKeptRow?.speed ?? 0)
    );
    const timeGapMs = Math.max(
      0,
      Number(currentRow?.timestamp || 0) - Number(lastKeptRow?.timestamp || 0)
    );
    const nextDistance = haversineMeters(currentRow, nextRow);
    const nextHeadingDelta = normalizeHeadingDelta(currentRow?.heading, nextRow?.heading);
    const isTurnAnchor =
      headingDelta >= policy.minHeadingDelta && nextHeadingDelta >= Math.max(12, policy.minHeadingDelta / 2);

    const important = hasEvent || statusChanged || ignitionChanged;
    const shouldKeep =
      important ||
      timeGapMs >= policy.minTimeGapMs ||
      distanceFromLastKept >= policy.minDistanceMeters ||
      headingDelta >= policy.minHeadingDelta ||
      speedDelta >= policy.minSpeedDelta ||
      isTurnAnchor ||
      nextDistance >= policy.minDistanceMeters * 1.5;

    if (!shouldKeep) continue;

    keptEntries.push({ row: currentRow, important });
    lastKeptRow = currentRow;
  }

  if (lastRow && lastRow !== firstRow) {
    keptEntries.push({ row: lastRow, important: true });
  }

  const dedupedEntries = [];
  const seenKeys = new Set();
  keptEntries.forEach((entry) => {
    const row = entry?.row;
    if (!row) return;
    const key = String(row.id || `${Number(row.timestamp || 0)}:${Number(row.lat ?? row.latitude ?? 0).toFixed(6)}:${Number(row.lng ?? row.longitude ?? 0).toFixed(6)}`);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    dedupedEntries.push(entry);
  });

  if (dedupedEntries.length <= policy.targetMaxPoints) {
    return dedupedEntries.map((entry) => entry.row);
  }

  const importantEntries = dedupedEntries.filter((entry) => entry.important);
  const regularEntries = dedupedEntries.filter((entry) => !entry.important);
  if (importantEntries.length >= policy.targetMaxPoints) {
    const stride = Math.max(1, Math.ceil(importantEntries.length / policy.targetMaxPoints));
    return importantEntries
      .filter((_, index) => index % stride === 0 || index === importantEntries.length - 1)
      .slice(0, policy.targetMaxPoints)
      .map((entry) => entry.row);
  }

  const remainingBudget = Math.max(0, policy.targetMaxPoints - importantEntries.length);
  const stride = Math.max(1, Math.ceil(regularEntries.length / Math.max(1, remainingBudget)));
  const sampledRegularEntries = regularEntries.filter(
    (_, index) => index % stride === 0 || index === regularEntries.length - 1
  );

  return [...importantEntries, ...sampledRegularEntries]
    .slice(0, policy.targetMaxPoints)
    .map((entry) => entry.row)
    .sort((left, right) => Number(left?.timestamp || 0) - Number(right?.timestamp || 0));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fromDate = normalizeHistoryReplayDateParam(searchParams.get("from_date"));
  const toDate = normalizeHistoryReplayDateParam(searchParams.get("to_date"));

  if (!fromDate || !toDate) {
    return NextResponse.json(
      { error: "Missing required query parameters: from_date and to_date." },
      { status: 400 }
    );
  }

  try {
    const fullRangeRequested = searchParams.get("full_range") === "1";
    const requestedLimit = Math.max(
      1,
      Math.min(
        MAX_HISTORY_REPLAY_PAGE_SIZE,
        Number(searchParams.get("limit") || DEFAULT_HISTORY_REPLAY_PAGE_SIZE) || DEFAULT_HISTORY_REPLAY_PAGE_SIZE
      )
    );
    const startOffset = Math.max(0, Number(searchParams.get("offset") || 0) || 0);
    const maxRecords = Math.max(
      requestedLimit,
      Math.min(
        MAX_HISTORY_REPLAY_TOTAL_ROWS,
        Number(searchParams.get("max_records") || requestedLimit) || requestedLimit
      )
    );
    const baseQuery = {
      from_date: fromDate,
      to_date: toDate,
      limit: String(requestedLimit),
      offset: String(startOffset),
      full_range: fullRangeRequested ? "1" : "",
      max_records: fullRangeRequested ? String(maxRecords) : "",
      imei_id: searchParams.get("imei_id"),
      obj_name: searchParams.get("obj_name"),
      obj_reg_no: searchParams.get("obj_reg_no"),
      min_speed: searchParams.get("min_speed"),
      max_speed: searchParams.get("max_speed"),
      ignition_status: searchParams.get("ignition_status"),
      gps_fix_status: searchParams.get("gps_fix_status"),
    };

    const cached = await readPlaybackHistoryCache(baseQuery);
    if (Array.isArray(cached?.rows)) {
      return NextResponse.json(cached.rows, {
        status: 200,
        headers: {
          "x-vtp-playback-cache": String(cached.source || "cache"),
        },
      });
    }

    let normalizedRows = [];
    if (fullRangeRequested) {
      const collectedRows = [];
      let nextOffset = startOffset;
      while (collectedRows.length < maxRecords) {
        const pageLimit = Math.min(requestedLimit, maxRecords - collectedRows.length);
        const payload = await externalHistoryReplayFetch(HISTORY_REPLAY_PATHS.history, {
          ...baseQuery,
          limit: String(pageLimit),
          offset: String(nextOffset),
          full_range: "",
          max_records: "",
        });
        const pageRows = normalizeHistoryReplayRows(payload);
        if (pageRows.length === 0) break;
        collectedRows.push(...pageRows);
        if (pageRows.length < pageLimit) break;
        nextOffset += pageRows.length;
      }
      normalizedRows = shapeHistoryReplayRows(collectedRows, fromDate, toDate).slice(0, maxRecords);
    } else {
      const payload = await externalHistoryReplayFetch(HISTORY_REPLAY_PATHS.history, {
        ...baseQuery,
        limit: String(requestedLimit),
        offset: String(startOffset),
      });
      normalizedRows = mergeHistoryReplayRows(normalizeHistoryReplayRows(payload));
    }
    await writePlaybackHistoryCache(baseQuery, normalizedRows, cached?.authContext || null).catch(() => {});

    return NextResponse.json(normalizedRows, {
      status: 200,
      headers: {
        "x-vtp-playback-cache": "miss",
      },
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
