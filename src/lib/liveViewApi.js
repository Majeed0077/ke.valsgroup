import { getCustomerAuthContext } from "@/lib/externalMasterApi";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";
import {
  formatExternalTimestampIso,
  parseExternalTimestampMs,
} from "@/lib/externalDateTime";

const EXTERNAL_BASE_URL = process.env.EXTERNAL_AUTH_API_URL || process.env.EXTERNAL_MAPVIEW_API_URL || "";
const EXTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 10000);

export const LIVE_VIEW_PATHS = {
  live: process.env.EXTERNAL_LIVE_VIEW_API_PATH || "/react/live-view",
  summary: process.env.EXTERNAL_LIVE_VIEW_SUMMARY_API_PATH || "/react/live-view/summary",
  objects: process.env.EXTERNAL_LIVE_VIEW_OBJECTS_LOV_API_PATH || "/react/live-view/filters/objects",
  groups: process.env.EXTERNAL_LIVE_VIEW_GROUPS_LOV_API_PATH || "/react/live-view/filters/groups",
  branches: process.env.EXTERNAL_LIVE_VIEW_BRANCHES_LOV_API_PATH || "/react/live-view/filters/branches",
};

function getBaseUrl() {
  const baseUrl = String(EXTERNAL_BASE_URL || "").trim();
  if (!baseUrl) {
    throw new Error("External live view API base URL is not configured.");
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

function readTimestampValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null || String(value).trim() === "") continue;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;

    const parsedValue = parseExternalTimestampMs(value);
    if (Number.isFinite(parsedValue) && parsedValue > 0) return parsedValue;
  }

  return 0;
}

function readTimestampMs(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null || String(value).trim() === "") continue;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;

    const parsedValue = parseExternalTimestampMs(value);
    if (Number.isFinite(parsedValue) && parsedValue > 0) return parsedValue;
  }

  return 0;
}

function formatTimestampValue(row, keys) {
  const timestamp = readTimestampMs(row, keys);
  return timestamp > 0 ? formatExternalTimestampIso(timestamp) : "";
}

function mapMovementStatus(row, speed) {
  const statusKey = getVehicleStatusKey({
    ...row,
    speed_kmh: Number.isFinite(Number(speed)) ? Number(speed) : readNumber(row, ["speed_kmh", "speed"], 0) || 0,
  });

  switch (statusKey) {
    case "running":
      return "RUNNING";
    case "idle":
      return "IDLE";
    case "inactive":
      return "INACTIVE";
    case "stopped":
    case "nodata":
    default:
      return "STOP";
  }
}

function buildSyntheticPath(latitude, longitude, speed, heading) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  const now = Date.now();
  if (!Number.isFinite(speed) || speed <= 0) {
    return [
      { latitude, longitude, timestamp: now - 10000 },
      { latitude, longitude, timestamp: now },
    ];
  }

  const angleRad = ((Number.isFinite(heading) ? heading : 0) * Math.PI) / 180;
  const distanceFactor = Math.min(Math.max(speed / 120, 0.0003), 0.0015);
  const latOffset = Math.cos(angleRad) * distanceFactor;
  const lngOffset = Math.sin(angleRad) * distanceFactor;

  return [
    {
      latitude: Number((latitude - latOffset * 2).toFixed(6)),
      longitude: Number((longitude - lngOffset * 2).toFixed(6)),
      timestamp: now - 20000,
    },
    {
      latitude: Number((latitude - latOffset).toFixed(6)),
      longitude: Number((longitude - lngOffset).toFixed(6)),
      timestamp: now - 10000,
    },
    {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      timestamp: now,
    },
  ];
}

function normalizePath(points, fallbackLatitude, fallbackLongitude, fallbackSpeed, fallbackHeading) {
  const normalized = (Array.isArray(points) ? points : [])
    .map((point) => {
      const latitude = Number(point?.latitude);
      const longitude = Number(point?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const timestamp = readTimestampValue(point, [
        "timestamp",
        "device_datetime",
        "device_time",
        "deviceTime",
        "gps_time",
        "gpsTime",
        "server_time",
        "serverTime",
        "updated_at",
        "updatedAt",
      ]);
      return {
        ...point,
        latitude,
        longitude,
        timestamp: timestamp || Number(point?.timestamp || Date.now()),
        movement_status: String(point?.movement_status || point?.movementStatus || "").trim(),
        ignition_status: String(point?.ignition_status || point?.ignitionStatus || "").trim(),
        speed: readNumber(point, ["speed_kmh", "speed"], Number.isFinite(fallbackSpeed) ? fallbackSpeed : 0) || 0,
        angle_name: readNumber(point, ["angle_name", "angle", "heading", "course"], fallbackHeading) || 0,
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;
  return buildSyntheticPath(fallbackLatitude, fallbackLongitude, fallbackSpeed, fallbackHeading);
}

export function normalizeLiveVehicleRow(row) {
  const latitude = readNumber(row, ["latitude", "lat"]);
  const longitude = readNumber(row, ["longitude", "lng", "lon"]);
  const speed = readNumber(row, ["speed_kmh", "speed"], 0) || 0;
  const heading = readNumber(row, ["angle_name", "angle", "heading", "course"], 0) || 0;
  const sourceTimestamp = formatTimestampValue(row, [
    "sourceTimestamp",
    "device_datetime",
    "deviceDateTime",
    "device_time",
    "deviceTime",
    "server_datetime",
    "serverDateTime",
    "lastPacketTime",
    "last_packet_time",
    "lastLocationTime",
    "last_location_time",
    "timestamp",
    "server_time",
    "servertime",
    "updated_at",
    "updatedAt",
    "gpstime",
    "gps_time",
  ]);
  const lastPacketTime = formatTimestampValue(row, [
    "lastPacketTime",
    "last_packet_time",
    "last_packet",
    "lastPacket",
    "packetTime",
    "packet_time",
    "server_datetime",
    "serverDateTime",
    "timestamp",
    "server_time",
    "servertime",
    "updated_at",
    "updatedAt",
  ]);
  const lastLocationTime = formatTimestampValue(row, [
    "lastLocationTime",
    "last_location_time",
    "lastLocation",
    "last_location",
    "locationTime",
    "location_time",
    "server_datetime",
    "serverDateTime",
    "timestamp",
    "server_time",
    "servertime",
    "updated_at",
    "updatedAt",
  ]);
  const imeiId = readString(row, [
    "imei_id",
    "imeiId",
    "imei",
    "imeino",
    "imei_no",
    "device_id",
    "deviceId",
    "unit_id",
    "unitId",
  ]);
  const vehicleNo = readString(row, [
    "vehicle_no",
    "obj_reg_no",
    "reg_no",
    "registration_no",
    "vehicle_reg_no",
    "plate_no",
  ]);
  const vehicleName = readString(row, ["obj_name", "vehicle_name", "name", "obj_alias"]);
  const vehicleType = readString(row, ["vehicle_type", "obj_type", "object_type"]) || "default";

  const serverDatetime = formatTimestampValue(row, [
    "server_datetime",
    "serverDateTime",
    "server_time",
    "servertime",
    "timestamp",
  ]);
  const deviceDatetime = formatTimestampValue(row, [
    "device_datetime",
    "deviceDateTime",
    "device_time",
    "deviceTime",
    "timestamp",
  ]);

  return {
    ...row,
    id: imeiId || vehicleNo || vehicleName,
    imei_id: imeiId,
    vehicle_no: vehicleNo || vehicleName || imeiId,
    vehicle_name: vehicleName || vehicleNo || imeiId,
    vehicle_type: vehicleType,
    latitude,
    longitude,
    speed,
    angle_name: heading,
    movement_status: mapMovementStatus(row, speed),
    ignition_status: readString(row, ["ignition_status", "ignitionStatus"]),
    gps_fix_status: readString(row, ["gps_fix_status", "gpsFixStatus"]),
    sos_status: readString(row, ["sos_status", "sosStatus"]),
    obj_name: vehicleName,
    obj_reg_no: vehicleNo,
    group1: readString(row, ["group1", "group"]),
    branch: readString(row, ["branch"]),
    company: readString(row, ["company"]),
    organizations: readString(row, ["organizations", "organization"]),
    path: normalizePath(row?.path, latitude, longitude, speed, heading),
    sourceTimestamp: sourceTimestamp || String(row?.sourceTimestamp || ""),
    lastPacketTime: lastPacketTime || String(row?.lastPacketTime || ""),
    lastLocationTime: lastLocationTime || String(row?.lastLocationTime || ""),
    device_datetime: deviceDatetime || String(row?.device_datetime || row?.deviceDateTime || ""),
    server_datetime: serverDatetime || String(row?.server_datetime || row?.serverDateTime || ""),
    updatedAt: String(row?.updatedAt || row?.updated_at || sourceTimestamp || ""),
    timestamp: String(row?.timestamp || sourceTimestamp || lastPacketTime || lastLocationTime || ""),
  };
}

export function normalizeLiveViewRows(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeLiveVehicleRow(item))
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

export async function externalLiveViewFetch(path, query = {}) {
  const { loginFor, loginKey, accessToken } = await getCustomerAuthContext();
  const url = new URL(`${getBaseUrl()}${path}`);

  Object.entries({
    login_for: loginFor,
    login_key: loginKey,
    ...query,
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT_MS);
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
      const timeoutError = new Error("Live view request timed out.");
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
      data?.detail || data?.error || data?.message || `Live view request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}
