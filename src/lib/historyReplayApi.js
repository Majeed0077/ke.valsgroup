import { getCustomerAuthContext } from "@/lib/externalMasterApi";

const EXTERNAL_BASE_URL =
  process.env.EXTERNAL_AUTH_API_URL || process.env.EXTERNAL_MAPVIEW_API_URL || "";
const EXTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 10000);
const EXTERNAL_HISTORY_REPLAY_TIMEOUT_MS = Number(
  process.env.EXTERNAL_HISTORY_REPLAY_TIMEOUT_MS || EXTERNAL_REQUEST_TIMEOUT_MS || 30000
);

export const HISTORY_REPLAY_PATHS = {
  history: process.env.EXTERNAL_HISTORY_REPLAY_API_PATH || "/react/history-replay",
};

let hasLoggedFirstHistoryReplayRowShape = false;
let hasLoggedEmptyHistoryReplayPayloadShape = false;

function getBaseUrl() {
  const baseUrl = String(EXTERNAL_BASE_URL || "").trim();
  if (!baseUrl) {
    throw new Error("External history replay API base URL is not configured.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function readString(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function readNumber(row, keys, fallback = null) {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function readTimestampMs(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null || value === "") continue;

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }

    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
}

function extractCollection(payload) {
  if (Array.isArray(payload)) return payload;

  const candidateKeys = ["data", "items", "rows", "results", "records", "list"];
  for (const key of candidateKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  if (isLikelyHistoryRow(payload)) {
    return [payload];
  }

  const recursiveMatch = findNestedHistoryCollection(payload);
  if (recursiveMatch.length > 0) {
    return recursiveMatch;
  }

  return [];
}

function isLikelyHistoryRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;

  const hasCoordinate =
    Number.isFinite(readNumber(row, ["latitude", "lat", "y"])) &&
    Number.isFinite(readNumber(row, ["longitude", "lng", "lon", "x"]));
  if (hasCoordinate) return true;

  return Boolean(
    readString(row, [
      "imei_id",
      "imei",
      "imeiId",
      "obj_reg_no",
      "vehicle_no",
      "obj_name",
      "device_datetime",
      "server_datetime",
    ])
  );
}

function findNestedHistoryCollection(payload, depth = 0, seen = new WeakSet()) {
  if (!payload || typeof payload !== "object" || depth > 4) return [];
  if (seen.has(payload)) return [];
  seen.add(payload);

  let bestMatch = [];

  for (const value of Object.values(payload)) {
    if (!value) continue;

    if (Array.isArray(value)) {
      const normalizedItems = value.filter((item) => isLikelyHistoryRow(item));
      if (normalizedItems.length > bestMatch.length) {
        bestMatch = normalizedItems;
      }

      value.forEach((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        const nested = findNestedHistoryCollection(item, depth + 1, seen);
        if (nested.length > bestMatch.length) {
          bestMatch = nested;
        }
      });
      continue;
    }

    if (typeof value === "object") {
      const nested = findNestedHistoryCollection(value, depth + 1, seen);
      if (nested.length > bestMatch.length) {
        bestMatch = nested;
      }
    }
  }

  return bestMatch;
}

function normalizeIgnitionStatus(row) {
  const value = readString(row, ["ignition_status", "ignitionStatus", "ignition", "acc_status"]).toUpperCase();
  if (!value) return "";
  if (["1", "Y", "YES", "ON", "IGNITION_ON"].includes(value)) return "ON";
  if (["0", "N", "NO", "OFF", "IGNITION_OFF"].includes(value)) return "OFF";
  return value;
}

function normalizeGpsFixStatus(row) {
  const value = readString(row, ["gps_fix_status", "gpsFixStatus", "gps_status", "gpsStatus"]).toUpperCase();
  if (!value) return "";
  if (["1", "Y", "YES", "FIX", "VALID"].includes(value)) return "FIX";
  if (["0", "N", "NO", "NO_FIX", "INVALID"].includes(value)) return "NO_FIX";
  return value;
}

function appendQueryParams(url, query = {}) {
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });
}

export async function externalHistoryReplayFetch(path, query = {}) {
  const { loginFor, loginKey, accessToken } = await getCustomerAuthContext();
  const url = new URL(`${getBaseUrl()}${path}`);

  appendQueryParams(url, {
    login_for: loginFor,
    login_key: loginKey,
    ...query,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_HISTORY_REPLAY_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("History replay request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { detail: text } : null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error ||
      data?.message ||
      `History replay request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export function normalizeHistoryReplayRow(row) {
  const latitude = readNumber(row, ["latitude", "lat", "y"]);
  const longitude = readNumber(row, ["longitude", "lng", "lon", "x"]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const timestamp = readTimestampMs(row, [
    "timestamp",
    "device_datetime",
    "device_time",
    "deviceTime",
    "gps_time",
    "gpsTime",
    "server_time",
    "serverTime",
    "server_datetime",
    "serverDatetime",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
  ]);
  const speedKmh = Math.max(0, readNumber(row, ["speed_kmh", "speedKmh", "speed"], 0) || 0);
  const objName = readString(row, ["obj_name", "vehicle_name", "name", "vehicle_no"]);
  const objRegNo = readString(row, ["obj_reg_no", "vehicle_no", "reg_no", "registration_no"]);
  const imeiId = readString(row, ["imei_id", "imei", "imeiId", "device_id", "deviceId"]);
  const batteryVoltage = readNumber(
    row,
    ["battery_voltage", "batteryVoltage", "main_battery_voltage", "voltage"],
    null
  );
  const fuelLevel = readNumber(
    row,
    ["fuel_level", "fuelLevel", "fuel_percentage", "fuelPercentage", "fuel"],
    null
  );
  const temperature = readNumber(
    row,
    ["temperature", "temperature_c", "temperatureC", "temp", "temp_c"],
    null
  );

  return {
    id:
      readString(row, ["id", "_id"]) ||
      `${imeiId || objRegNo || objName || "history"}:${timestamp || `${latitude}:${longitude}`}`,
    timestamp,
    device_datetime: timestamp ? new Date(timestamp).toISOString() : "",
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    speed_kmh: speedKmh,
    speed: speedKmh,
    ignition_status: normalizeIgnitionStatus(row),
    gps_fix_status: normalizeGpsFixStatus(row),
    movement_status: readString(row, ["movement_status", "movementStatus"]),
    obj_name: objName,
    obj_reg_no: objRegNo,
    imei_id: imeiId,
    driver_name: readString(row, ["driver_name", "driver", "driverName"]),
    address: readString(row, ["address", "location", "location_name"]),
    heading: readNumber(row, ["heading", "angle", "course"], null),
    battery_voltage: batteryVoltage,
    fuel_level: fuelLevel,
    temperature: temperature,
    event_name: readString(row, ["event_name", "eventName", "event", "alert_name", "alertName"]),
  };
}

export function normalizeHistoryReplayRows(payload) {
  const rows = extractCollection(payload);

  if (!hasLoggedFirstHistoryReplayRowShape && rows.length > 0) {
    hasLoggedFirstHistoryReplayRowShape = true;
    console.log("[historyReplayApi] First history replay row keys:", Object.keys(rows[0] || {}).sort());
  }

  if (
    !hasLoggedEmptyHistoryReplayPayloadShape &&
    rows.length === 0 &&
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    hasLoggedEmptyHistoryReplayPayloadShape = true;
    console.warn("[historyReplayApi] Unable to extract history rows. Top-level payload keys:", Object.keys(payload));
  }

  return rows
    .map((row) => normalizeHistoryReplayRow(row))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTimestamp = Number(left?.timestamp || 0);
      const rightTimestamp = Number(right?.timestamp || 0);
      if (leftTimestamp && rightTimestamp) return leftTimestamp - rightTimestamp;
      return 0;
    });
}
