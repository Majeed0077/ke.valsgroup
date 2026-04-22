import dbConnect from "@/lib/mongodb";
import { getCustomerAuthContext } from "@/lib/externalMasterApi";
import { buildAlertScopeKey } from "@/lib/alertScope";
import { resolveOwnershipScope } from "@/lib/ownershipScope";
import {
  externalLiveViewFetch,
  LIVE_VIEW_PATHS,
  normalizeLiveVehicleRow,
  normalizeLiveViewRows,
} from "@/lib/liveViewApi";
import { parseExternalTimestamp } from "@/lib/externalDateTime";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";
import {
  LiveVehicleCacheEntry,
  LiveVehicleCacheState,
} from "@/lib/models/LiveVehicleCache";

const LIVE_VEHICLE_CACHE_SYNC_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.LIVE_VEHICLE_CACHE_SYNC_INTERVAL_MS || 15000)
);
function isEnvFlagEnabled(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

const LIVE_VEHICLE_SYNC_MAX_RECORDS = Math.max(
  100,
  Number(
    process.env.LIVE_VEHICLE_SYNC_MAX_RECORDS ||
      process.env.EXTERNAL_LIVE_VIEW_DEFAULT_LIMIT ||
      5000
  )
);
const LIVE_VEHICLE_SYNC_PAGE_SIZE = Math.max(
  100,
  Math.min(
    LIVE_VEHICLE_SYNC_MAX_RECORDS,
    Number(process.env.EXTERNAL_LIVE_VIEW_PAGE_SIZE || 1000)
  )
);
const LIVE_VEHICLE_QUERY_LIMIT = Math.max(
  100,
  Number(process.env.LIVE_VEHICLE_QUERY_LIMIT || 5000)
);
const LIVE_VEHICLE_DB_RETRY_COOLDOWN_MS = Math.max(
  5000,
  Number(process.env.LIVE_VEHICLE_DB_RETRY_COOLDOWN_MS || 30000)
);
const LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS = Math.max(
  250,
  Number(process.env.LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS || 5000)
);
const LIVE_VEHICLE_CACHE_SCHEMA_VERSION = 2;
const LIVE_VEHICLE_STATUS_DEBUG = String(process.env.LIVE_VEHICLE_STATUS_DEBUG || "").trim() === "1";
const LIVE_VEHICLE_CACHE_READ_ONLY_MODE = isEnvFlagEnabled(
  process.env.LIVE_VEHICLE_CACHE_READ_ONLY_MODE,
  true
);
const LIVE_VEHICLE_ALLOW_DIRECT_EXTERNAL_FALLBACK = isEnvFlagEnabled(
  process.env.LIVE_VEHICLE_ALLOW_DIRECT_EXTERNAL_FALLBACK,
  false
);

const DEFAULT_VEHICLE_SUMMARY = {
  total: 0,
  running: 0,
  idle: 0,
  stopped: 0,
  inactive: 0,
  nodata: 0,
};

const globalForLiveVehicleCache = globalThis;
if (!globalForLiveVehicleCache.__vtpLiveVehicleSyncMap) {
  globalForLiveVehicleCache.__vtpLiveVehicleSyncMap = new Map();
}
if (!globalForLiveVehicleCache.__vtpLiveVehicleMemoryEntries) {
  globalForLiveVehicleCache.__vtpLiveVehicleMemoryEntries = new Map();
}
if (!globalForLiveVehicleCache.__vtpLiveVehicleMemoryState) {
  globalForLiveVehicleCache.__vtpLiveVehicleMemoryState = new Map();
}
if (!globalForLiveVehicleCache.__vtpLiveVehicleDbStatus) {
  globalForLiveVehicleCache.__vtpLiveVehicleDbStatus = {
    available: null,
    lastCheckedAt: 0,
    lastError: "",
  };
}
if (!globalForLiveVehicleCache.__vtpLiveVehicleDebugStats) {
  globalForLiveVehicleCache.__vtpLiveVehicleDebugStats = new Map();
}
if (!globalForLiveVehicleCache.__vtpLiveVehicleIndexInitPromise) {
  globalForLiveVehicleCache.__vtpLiveVehicleIndexInitPromise = null;
}

function getSyncMap() {
  return globalForLiveVehicleCache.__vtpLiveVehicleSyncMap;
}

function getMemoryEntryMap() {
  return globalForLiveVehicleCache.__vtpLiveVehicleMemoryEntries;
}

function getMemoryStateMap() {
  return globalForLiveVehicleCache.__vtpLiveVehicleMemoryState;
}

function getDbStatus() {
  return globalForLiveVehicleCache.__vtpLiveVehicleDbStatus;
}

function getDebugStatsMap() {
  return globalForLiveVehicleCache.__vtpLiveVehicleDebugStats;
}

function getLiveVehicleIndexInitPromise() {
  return globalForLiveVehicleCache.__vtpLiveVehicleIndexInitPromise;
}

function setLiveVehicleIndexInitPromise(promise) {
  globalForLiveVehicleCache.__vtpLiveVehicleIndexInitPromise = promise;
}

function normalizeSyncError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "Live vehicle sync failed.").trim();
  const isTimeout =
    status === 504 ||
    code === "ETIMEDOUT" ||
    /timed out/i.test(message);

  return {
    message,
    status,
    code,
    isTimeout,
    category: isTimeout ? "upstream-timeout" : "sync-failure",
    cause: error || null,
  };
}

function createSingleFlightSyncJob(scopeKey, runSync) {
  const syncMap = getSyncMap();
  const completion = Promise.resolve()
    .then(() => runSync())
    .then(
      (summary) => ({
        ok: true,
        summary,
        error: null,
      }),
      (error) => ({
        ok: false,
        summary: null,
        error: normalizeSyncError(error),
      })
    )
    .finally(() => {
      syncMap.delete(scopeKey);
    });

  const job = {
    promise: completion,
  };
  syncMap.set(scopeKey, job);
  return job;
}

function readStateSummary(state) {
  return {
    total: Number(state?.total || 0),
    running: Number(state?.running || 0),
    idle: Number(state?.idle || 0),
    stopped: Number(state?.stopped || 0),
    inactive: Number(state?.inactive || 0),
    nodata: Number(state?.nodata || 0),
  };
}

function readStateLastSyncedAtMs(state) {
  const lastSyncedAt = state?.lastSyncedAt ? new Date(state.lastSyncedAt).getTime() : 0;
  return Number.isFinite(lastSyncedAt) && lastSyncedAt > 0 ? lastSyncedAt : 0;
}

function isStateSchemaCurrent(state) {
  return Number(state?.schemaVersion || 0) === LIVE_VEHICLE_CACHE_SCHEMA_VERSION;
}

function isStateFresh(state) {
  const lastSyncedAt = readStateLastSyncedAtMs(state);
  return isStateSchemaCurrent(state) && lastSyncedAt > 0 && Date.now() - lastSyncedAt < LIVE_VEHICLE_CACHE_SYNC_INTERVAL_MS;
}

function buildFreshnessMetadata(scopeKey, state, storage, extra = {}) {
  const lastSyncedAtMs = readStateLastSyncedAtMs(state);
  const staleAgeMs = lastSyncedAtMs > 0 ? Math.max(0, Date.now() - lastSyncedAtMs) : null;
  return {
    scopeKey,
    storage,
    cacheReadOnlyMode: LIVE_VEHICLE_CACHE_READ_ONLY_MODE,
    allowDirectExternalFallback: LIVE_VEHICLE_ALLOW_DIRECT_EXTERNAL_FALLBACK,
    hasSnapshot: Boolean(state && isStateSchemaCurrent(state)),
    isFresh: isStateFresh(state),
    isStale: Boolean(state && isStateSchemaCurrent(state) && !isStateFresh(state)),
    lastSyncedAt: state?.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : "",
    staleAgeMs,
    syncStatus: String(state?.status || "idle"),
    syncInFlight: getSyncMap().has(scopeKey),
    ...extra,
  };
}

function toDateOrNull(value) {
  if (!value) return null;
  return parseExternalTimestamp(value);
}

function toFiniteNumberOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const next = Number(text);
  return Number.isFinite(next) ? next : null;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withLiveVehicleDbTimeout(operation, message = "Live vehicle Mongo query timed out.") {
  let timeoutId = null;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(message);
        error.code = "ETIMEDOUT";
        reject(error);
      }, LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS);

      // Prevent the timer from keeping the event loop alive on the server.
      if (typeof timeoutId?.unref === "function") timeoutId.unref();
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
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

function buildLivePageSignature(rows = []) {
  return (Array.isArray(rows) ? rows : [])
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

function readVehicleCacheId(row, normalized) {
  const candidates = [
    row?.obj_id,
    row?.object_id,
    row?.objectId,
    row?.unit_id,
    row?.unitId,
    row?.device_id,
    row?.deviceId,
    normalized?.imei_id,
    row?.imeino,
    row?.imei_no,
    normalized?.vehicle_no,
    normalized?.obj_reg_no,
    normalized?.vehicle_name,
    normalized?.obj_name,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  const latitude = Number(normalized?.latitude);
  const longitude = Number(normalized?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(6)}:${longitude.toFixed(6)}:${String(normalized?.speed || 0)}`;
  }

  return "";
}

function getVehicleCacheStatusKey(row) {
  return getVehicleStatusKey({
    ...row,
    movement_status: row?.movementStatus || row?.movement_status || "",
    ignition_status: row?.ignitionStatus || row?.ignition_status || "",
    speed_kmh: Number(row?.speed || row?.speed_kmh || 0) || 0,
  });
}

function readPacketTimestampMs(packet) {
  const candidates = [
    packet?.timestamp,
    packet?.device_datetime,
    packet?.device_time,
    packet?.deviceTime,
    packet?.gps_time,
    packet?.gpsTime,
    packet?.server_time,
    packet?.serverTime,
    packet?.updated_at,
    packet?.updatedAt,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

function getPacketStatusKey(packet) {
  const movement = String(packet?.movement_status || packet?.movementStatus || "").trim().toLowerCase();
  const ignition = String(packet?.ignition_status || packet?.ignitionStatus || "").trim().toLowerCase();
  const speed = Number(packet?.speed_kmh ?? packet?.speed ?? 0) || 0;

  if (movement.includes("idle")) return "idle";
  if (movement.includes("inactive") || movement.includes("in active") || movement === "off") return "inactive";
  if (movement.includes("run") || movement.includes("mov")) return "running";
  if (movement.includes("stop")) return "stopped";

  if (ignition.includes("on")) return speed > 0 ? "running" : "idle";
  if (ignition.includes("off")) return "inactive";
  if (speed > 0) return "running";
  return "stopped";
}

function readExplicitStatusChangedAt(row) {
  const candidates = [
    row?.lastStatusChangeTime,
    row?.last_status_change_time,
    row?.statusChangedAt,
    row?.status_changed_at,
    row?.lastStateChangeAt,
    row?.last_state_change_at,
    row?.stateChangedAt,
    row?.state_changed_at,
  ];

  for (const candidate of candidates) {
    const parsed = toDateOrNull(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function readServerDatetime(row, normalized) {
  const candidates = [
    row?.server_datetime,
    row?.serverDateTime,
    normalized?.server_datetime,
    normalized?.serverDateTime,
  ];

  for (const candidate of candidates) {
    const parsed = toDateOrNull(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function readDeviceDatetime(row, normalized) {
  const candidates = [
    row?.device_datetime,
    row?.deviceDateTime,
    row?.device_time,
    row?.deviceTime,
    normalized?.device_datetime,
    normalized?.deviceDateTime,
  ];

  for (const candidate of candidates) {
    const parsed = toDateOrNull(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function getDebugVehicleLabel(row, normalized) {
  return (
    normalized?.vehicle_no ||
    normalized?.vehicle_name ||
    normalized?.obj_name ||
    normalized?.imei_id ||
    row?.vehicle_no ||
    row?.obj_reg_no ||
    row?.obj_name ||
    row?.imei_id ||
    row?.imeiId ||
    "unknown-vehicle"
  );
}

function extractPacketSeries(row, normalized) {
  const candidates = [
    row?.packets,
    row?.packetHistory,
    row?.history,
    row?.samples,
    row?.events,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }

  return [];
}

function buildPacketStatusTimeline(row, normalized) {
  const packets = extractPacketSeries(row, normalized);
  if (!packets.length) return null;

  const ordered = packets
    .map((packet) => ({
      packet,
      timestamp: readPacketTimestampMs(packet),
      statusKey: getPacketStatusKey(packet),
    }))
    .filter((entry) => entry.timestamp > 0 && entry.statusKey)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (!ordered.length) return null;

  const current = ordered[ordered.length - 1];
  let firstCurrentIndex = ordered.length - 1;
  while (firstCurrentIndex > 0 && ordered[firstCurrentIndex - 1].statusKey === current.statusKey) {
    firstCurrentIndex -= 1;
  }

  return {
    currentStatusKey: current.statusKey,
    statusChangedAt: new Date(ordered[firstCurrentIndex].timestamp),
    firstPacketAt: new Date(ordered[0].timestamp),
    lastPacketAt: new Date(current.timestamp),
  };
}

function resolveVehicleStatusChangedAt({
  currentStatusKey,
  previousRow,
  packetTimeline,
  explicitStatusChangedAt,
  deviceDatetime,
  sourceTimestamp,
  serverDatetime,
}) {
  const previousStatusKey = String(previousRow?.statusKey || previousRow?.status || "").trim();
  const previousStatusChangedAt = toDateOrNull(previousRow?.statusChangedAt);
  const explicitTimestamp = toDateOrNull(explicitStatusChangedAt);
  const timelineStatusChangedAt = toDateOrNull(packetTimeline?.statusChangedAt);
  const currentPacketTimestamp =
    toDateOrNull(deviceDatetime) ||
    toDateOrNull(sourceTimestamp) ||
    toDateOrNull(packetTimeline?.lastPacketAt) ||
    toDateOrNull(serverDatetime);

  if (!previousRow) {
    return explicitTimestamp || timelineStatusChangedAt || currentPacketTimestamp;
  }

  if (previousStatusKey && previousStatusKey === currentStatusKey && previousStatusChangedAt) {
    return previousStatusChangedAt;
  }

  if (explicitTimestamp) return explicitTimestamp;
  if (timelineStatusChangedAt) return timelineStatusChangedAt;
  if (currentPacketTimestamp) return currentPacketTimestamp;
  return previousStatusChangedAt || null;
}

function buildVehicleDocument(scopeKey, authContext, row) {
  const normalized = normalizeLiveVehicleRow(row);
  const packetTimeline = buildPacketStatusTimeline(row, normalized);
  const explicitStatusChangedAt = readExplicitStatusChangedAt(row);
  const deviceDatetime = readDeviceDatetime(row, normalized);
  const serverDatetime = readServerDatetime(row, normalized);
  const sourceTimestamp = toDateOrNull(
    row?.sourceTimestamp ||
      row?.device_datetime ||
      row?.deviceDateTime ||
      row?.device_time ||
      row?.deviceTime ||
      row?.timestamp ||
      row?.server_time ||
      row?.servertime ||
      row?.gpstime ||
      row?.gps_time ||
      row?.device_time
  );
  const lastPacketTime = toDateOrNull(
    row?.lastPacketTime ||
      row?.last_packet_time ||
      row?.packet_time ||
      row?.packetTime ||
      row?.timestamp ||
      row?.server_time ||
      row?.servertime ||
      row?.updated_at
  );
  const lastLocationTime = toDateOrNull(
    row?.lastLocationTime ||
      row?.last_location_time ||
      row?.location_time ||
      row?.locationTime ||
      row?.timestamp ||
      row?.server_time ||
      row?.servertime ||
      row?.updated_at
  );
  const searchText = [
    normalized.vehicle_no,
    normalized.vehicle_name,
    normalized.obj_name,
    normalized.obj_reg_no,
    normalized.imei_id,
    normalized.group1,
    normalized.branch,
    normalized.company,
    normalized.organizations,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (LIVE_VEHICLE_STATUS_DEBUG) {
    console.debug("[liveVehicleCache] buildVehicleDocument", {
      vehicle: getDebugVehicleLabel(row, normalized),
      statusKey: getVehicleCacheStatusKey(normalized),
      explicitStatusChangedAt: explicitStatusChangedAt ? explicitStatusChangedAt.toISOString() : null,
      sourceTimestamp: sourceTimestamp ? sourceTimestamp.toISOString() : null,
      lastPacketTime: lastPacketTime ? lastPacketTime.toISOString() : null,
      lastLocationTime: lastLocationTime ? lastLocationTime.toISOString() : null,
      packetTimeline: packetTimeline
        ? {
            currentStatusKey: packetTimeline.currentStatusKey,
            statusChangedAt: packetTimeline.statusChangedAt ? packetTimeline.statusChangedAt.toISOString() : null,
            firstPacketAt: packetTimeline.firstPacketAt ? packetTimeline.firstPacketAt.toISOString() : null,
            lastPacketAt: packetTimeline.lastPacketAt ? packetTimeline.lastPacketAt.toISOString() : null,
          }
        : null,
    });
  }

  return {
    scopeKey,
    schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
    loginFor: authContext.loginFor,
    vehicleId: readVehicleCacheId(row, normalized),
    imeiId: String(normalized.imei_id || ""),
    vehicleNo: String(normalized.vehicle_no || ""),
    vehicleName: String(normalized.vehicle_name || normalized.obj_name || ""),
    vehicleType: String(normalized.vehicle_type || ""),
    latitude: Number(normalized.latitude),
    longitude: Number(normalized.longitude),
    speed: Number(normalized.speed || 0),
    angleName: Number(normalized.angle_name || 0),
    movementStatus: String(normalized.movement_status || ""),
    ignitionStatus: String(normalized.ignition_status || ""),
    gpsFixStatus: String(normalized.gps_fix_status || ""),
    sosStatus: String(normalized.sos_status || ""),
    branch: String(normalized.branch || ""),
    company: String(normalized.company || ""),
    organizations: String(normalized.organizations || ""),
    group1: String(normalized.group1 || ""),
    path: Array.isArray(normalized.path) ? normalized.path : [],
    sourceTimestamp,
    lastPacketTime,
    lastLocationTime,
    deviceDatetime,
    serverDatetime,
    explicitStatusChangedAt,
    statusKey: getVehicleCacheStatusKey(normalized),
    packetTimeline,
    searchText,
    raw: normalized,
  };
}

function buildMongoQuery(scopeKey, query = {}) {
  const mongoQuery = { scopeKey, schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION };
  const andConditions = [];

  const stringFilters = [
    ["obj_name", ["vehicleName", "vehicleNo"]],
    ["obj_reg_no", ["vehicleNo"]],
    ["group1", ["group1"]],
    ["branch", ["branch"]],
    ["company", ["company"]],
    ["organizations", ["organizations"]],
    ["imei_id", ["imeiId"]],
  ];

  stringFilters.forEach(([queryKey, fields]) => {
    const value = String(query[queryKey] || "").trim();
    if (!value) return;
    andConditions.push({
      $or: fields.map((field) => ({
        [field]: { $regex: escapeRegex(value), $options: "i" },
      })),
    });
  });

  const minSpeed = toFiniteNumberOrNull(query.min_speed);
  const maxSpeed = toFiniteNumberOrNull(query.max_speed);
  if (minSpeed !== null || maxSpeed !== null) {
    mongoQuery.speed = {};
    if (minSpeed !== null) mongoQuery.speed.$gte = minSpeed;
    if (maxSpeed !== null) mongoQuery.speed.$lte = maxSpeed;
  }

  const statusFilters = [
    ["movement_status", "movementStatus"],
    ["ignition_status", "ignitionStatus"],
    ["gps_fix_status", "gpsFixStatus"],
    ["sos_status", "sosStatus"],
  ];

  statusFilters.forEach(([queryKey, field]) => {
    const value = String(query[queryKey] || "").trim();
    if (!value) return;
    mongoQuery[field] = value;
  });

  const fromDate = toDateOrNull(query.from_date);
  const toDate = toDateOrNull(query.to_date);
  if (fromDate || toDate) {
    mongoQuery.sourceTimestamp = {};
    if (fromDate) mongoQuery.sourceTimestamp.$gte = fromDate;
    if (toDate) mongoQuery.sourceTimestamp.$lte = toDate;
  }

  if (andConditions.length > 0) {
    mongoQuery.$and = andConditions;
  }

  return mongoQuery;
}

function buildLegacyMongoQuery(scopeKey, query = {}) {
  const mongoQuery = buildMongoQuery(scopeKey, query);
  delete mongoQuery.schemaVersion;
  return mongoQuery;
}

function buildMemoryQueryLimit(query = {}) {
  if (query.limit === undefined || query.limit === null || query.limit === "") {
    return LIVE_VEHICLE_QUERY_LIMIT;
  }

  const numericLimit = Number(query.limit || LIVE_VEHICLE_QUERY_LIMIT);
  return Math.max(1, Math.min(LIVE_VEHICLE_QUERY_LIMIT, numericLimit));
}

function matchesText(value, expected) {
  const haystack = String(value || "").toLowerCase();
  const needle = String(expected || "").trim().toLowerCase();
  if (!needle) return true;
  return haystack.includes(needle);
}

function matchesVehicleQuery(row, query = {}) {
  const stringFilters = [
    ["obj_name", [row?.vehicleName, row?.vehicleNo]],
    ["obj_reg_no", [row?.vehicleNo]],
    ["group1", [row?.group1]],
    ["branch", [row?.branch]],
    ["company", [row?.company]],
    ["organizations", [row?.organizations]],
    ["imei_id", [row?.imeiId]],
  ];

  for (const [queryKey, candidates] of stringFilters) {
    const value = String(query?.[queryKey] || "").trim();
    if (!value) continue;
    if (!candidates.some((candidate) => matchesText(candidate, value))) {
      return false;
    }
  }

  const minSpeed = toFiniteNumberOrNull(query?.min_speed);
  if (minSpeed !== null && Number(row?.speed || 0) < minSpeed) {
    return false;
  }

  const maxSpeed = toFiniteNumberOrNull(query?.max_speed);
  if (maxSpeed !== null && Number(row?.speed || 0) > maxSpeed) {
    return false;
  }

  const statusFilters = [
    ["movement_status", row?.movementStatus],
    ["ignition_status", row?.ignitionStatus],
    ["gps_fix_status", row?.gpsFixStatus],
    ["sos_status", row?.sosStatus],
  ];

  for (const [queryKey, candidate] of statusFilters) {
    const value = String(query?.[queryKey] || "").trim();
    if (value && String(candidate || "") !== value) {
      return false;
    }
  }

  const fromDate = toDateOrNull(query?.from_date);
  const toDate = toDateOrNull(query?.to_date);
  const sourceTimestamp = toDateOrNull(row?.sourceTimestamp);
  if (fromDate && (!sourceTimestamp || sourceTimestamp < fromDate)) {
    return false;
  }
  if (toDate && (!sourceTimestamp || sourceTimestamp > toDate)) {
    return false;
  }

  return true;
}

function sortVehicleRows(rows = []) {
  return [...rows].sort((left, right) => {
    const updatedDiff =
      new Date(right?.updatedAt || right?.sourceTimestamp || 0).getTime() -
      new Date(left?.updatedAt || left?.sourceTimestamp || 0).getTime();
    if (updatedDiff !== 0) return updatedDiff;

    const speedDiff = Number(right?.speed || 0) - Number(left?.speed || 0);
    if (speedDiff !== 0) return speedDiff;

    return String(left?.vehicleNo || "").localeCompare(String(right?.vehicleNo || ""));
  });
}

function toNormalizedVehicle(row) {
  const sourceTimestamp = row?.sourceTimestamp ? new Date(row.sourceTimestamp).toISOString() : "";
  const updatedAt = row?.updatedAt ? new Date(row.updatedAt).toISOString() : "";
  const lastPacketTime = row?.lastPacketTime ? new Date(row.lastPacketTime).toISOString() : "";
  const lastLocationTime = row?.lastLocationTime ? new Date(row.lastLocationTime).toISOString() : "";
  const deviceDatetime = row?.deviceDatetime ? new Date(row.deviceDatetime).toISOString() : "";
  const serverDatetime = row?.serverDatetime ? new Date(row.serverDatetime).toISOString() : "";
  const statusChangedAt = row?.statusChangedAt ? new Date(row.statusChangedAt).toISOString() : "";

  if (LIVE_VEHICLE_STATUS_DEBUG) {
    console.debug("[liveVehicleCache] toNormalizedVehicle", {
      vehicle: row?.vehicleNo || row?.vehicleName || row?.imeiId || row?.vehicleId || "unknown-vehicle",
      statusKey: row?.statusKey || row?.status || "",
      statusChangedAt: statusChangedAt || null,
      sourceTimestamp,
      lastPacketTime,
      lastLocationTime,
    });
  }

  return normalizeLiveVehicleRow({
    ...(row?.raw || {}),
    id: row?.vehicleId,
    imei_id: row?.imeiId,
    vehicle_no: row?.vehicleNo,
    vehicle_name: row?.vehicleName,
    vehicle_type: row?.vehicleType,
    latitude: row?.latitude,
    longitude: row?.longitude,
    speed: row?.speed,
    angle_name: row?.angleName,
    movement_status: row?.movementStatus,
    ignition_status: row?.ignitionStatus,
    gps_fix_status: row?.gpsFixStatus,
    sos_status: row?.sosStatus,
    branch: row?.branch,
    company: row?.company,
    organizations: row?.organizations,
    group1: row?.group1,
    path: row?.path,
    sourceTimestamp,
    lastPacketTime,
    lastLocationTime,
    device_datetime: deviceDatetime,
    server_datetime: serverDatetime,
    statusKey: row?.statusKey || row?.status || "",
    statusChangedAt,
    updatedAt,
    timestamp: sourceTimestamp || updatedAt,
  });
}

function summarizeSyncRows(scopeKey, rows = []) {
  const documents = rows.map((row) => buildVehicleDocument(scopeKey, { loginFor: "" }, row));
  const validDocuments = documents.filter(
    (row) =>
      row.vehicleId &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude)
  );
  const uniqueVehicleIds = new Set(validDocuments.map((row) => row.vehicleId));

  return {
    externalRawCount: rows.length,
    validRowCount: validDocuments.length,
    uniqueVehicleIdCount: uniqueVehicleIds.size,
    droppedInvalidCount: documents.length - validDocuments.length,
    duplicateVehicleIdCount: Math.max(0, validDocuments.length - uniqueVehicleIds.size),
  };
}

function updateDebugStats(scopeKey, patch = {}) {
  const debugStatsMap = getDebugStatsMap();
  const current = debugStatsMap.get(scopeKey) || {};
  debugStatsMap.set(scopeKey, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

async function ensureLiveVehicleCacheIndexes() {
  const existingPromise = getLiveVehicleIndexInitPromise();
  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = Promise.all([
    LiveVehicleCacheEntry.collection.createIndex(
      { scopeKey: 1, schemaVersion: 1, updatedAt: -1, speed: -1, vehicleNo: 1 },
      { name: "live_vehicle_cache_read_v2" }
    ),
    LiveVehicleCacheEntry.collection.createIndex(
      { scopeKey: 1, updatedAt: -1, speed: -1, vehicleNo: 1 },
      { name: "live_vehicle_cache_read_legacy_v1" }
    ),
  ]).catch((error) => {
    setLiveVehicleIndexInitPromise(null);
    throw error;
  });

  setLiveVehicleIndexInitPromise(nextPromise);
  return nextPromise;
}

function hasOnlyPaginationQuery(query = {}) {
  return !Object.entries(query || {}).some(([key, value]) => {
    if (key === "limit" || key === "offset") return false;
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

async function canUseLiveVehicleDb() {
  const dbStatus = getDbStatus();
  const now = Date.now();

  if (
    dbStatus.available === false &&
    now - Number(dbStatus.lastCheckedAt || 0) < LIVE_VEHICLE_DB_RETRY_COOLDOWN_MS
  ) {
    return false;
  }

  if (
    dbStatus.available === true &&
    now - Number(dbStatus.lastCheckedAt || 0) < LIVE_VEHICLE_DB_RETRY_COOLDOWN_MS
  ) {
    return true;
  }

  try {
    await dbConnect();
    await ensureLiveVehicleCacheIndexes();
    dbStatus.available = true;
    dbStatus.lastCheckedAt = now;
    dbStatus.lastError = "";
    return true;
  } catch (error) {
    dbStatus.available = false;
    dbStatus.lastCheckedAt = now;
    dbStatus.lastError = error?.message || "MongoDB unavailable.";
    console.warn("[liveVehicleCache] DB unavailable, using memory cache.", dbStatus.lastError);
    return false;
  }
}

async function fetchExternalLiveViewPages() {
  const rows = [];
  let offset = 0;
  let reportedTotal = 0;
  let previousPageSignature = "";
  let pageCount = 0;

  while (offset < LIVE_VEHICLE_SYNC_MAX_RECORDS) {
    const limit = Math.min(
      LIVE_VEHICLE_SYNC_PAGE_SIZE,
      LIVE_VEHICLE_SYNC_MAX_RECORDS - offset
    );
    const payload = await externalLiveViewFetch(LIVE_VIEW_PATHS.live, { limit, offset });
    pageCount += 1;
    const pageRows = extractLiveRows(payload);
    const explicitTotal = readPayloadTotal(payload);
    if (explicitTotal > 0) {
      reportedTotal = explicitTotal;
    }

    if (pageRows.length === 0) break;

    const pageSignature = buildLivePageSignature(pageRows);
    if (offset > 0 && pageSignature && pageSignature === previousPageSignature) break;

    rows.push(...pageRows);
    offset += pageRows.length;
    previousPageSignature = pageSignature;

    if (reportedTotal > 0 && offset >= reportedTotal) break;
    if (pageRows.length < limit && reportedTotal <= 0) break;
  }

  return {
    rows,
    externalCallCount: pageCount,
  };
}

async function recalculateSummary(scopeKey) {
  const rows = await withLiveVehicleDbTimeout(
    () =>
      LiveVehicleCacheEntry.find({
        scopeKey,
        schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
      })
        .maxTimeMS(LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS)
        .lean(),
    "Live vehicle summary query timed out."
  );
  const summary = { ...DEFAULT_VEHICLE_SUMMARY };

  rows.forEach((row) => {
    summary.total += 1;
    const statusKey = getVehicleStatusKey({
      speed: row?.speed,
      movement_status: row?.movementStatus,
      ignition_status: row?.ignitionStatus,
      timestamp: row?.sourceTimestamp,
    });
    if (summary[statusKey] !== undefined) {
      summary[statusKey] += 1;
    } else {
      summary.nodata += 1;
    }
  });

  return summary;
}

function recalculateMemorySummary(rows = []) {
  const summary = { ...DEFAULT_VEHICLE_SUMMARY };

  rows.forEach((row) => {
    summary.total += 1;
    const statusKey = getVehicleStatusKey({
      speed: row?.speed,
      movement_status: row?.movementStatus,
      ignition_status: row?.ignitionStatus,
      timestamp: row?.sourceTimestamp,
    });
    if (summary[statusKey] !== undefined) {
      summary[statusKey] += 1;
    } else {
      summary.nodata += 1;
    }
  });

  return summary;
}

async function syncLiveVehicleCache(scopeKey, authContext) {
  const syncStartedAtMs = Date.now();
  await LiveVehicleCacheState.findOneAndUpdate(
    { scopeKey },
    {
      $set: {
        schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
        loginFor: authContext.loginFor,
        syncStartedAt: new Date(),
        status: "syncing",
        lastError: "",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    const { rows: externalRows, externalCallCount } = await fetchExternalLiveViewPages();
    const syncStats = summarizeSyncRows(scopeKey, externalRows);
    const previousRows = await LiveVehicleCacheEntry.find({
      scopeKey,
      schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
    }).lean();
    const previousRowByVehicleId = new Map(
      previousRows.map((row) => [String(row?.vehicleId || ""), row]).filter(([key]) => key)
    );
    const operations = externalRows
      .map((row) => {
        const doc = buildVehicleDocument(scopeKey, authContext, row);
        const previousRow = previousRowByVehicleId.get(String(doc.vehicleId || ""));
        const statusChangedAt = resolveVehicleStatusChangedAt({
          currentStatusKey: doc.statusKey,
          previousRow,
          packetTimeline: doc.packetTimeline,
          explicitStatusChangedAt: doc.explicitStatusChangedAt,
          deviceDatetime: doc.deviceDatetime,
          sourceTimestamp: doc.sourceTimestamp,
          serverDatetime: doc.serverDatetime,
        });
        return {
          ...doc,
          statusChangedAt,
        };
      })
      .filter(
        (row) =>
          row.vehicleId &&
          Number.isFinite(row.latitude) &&
          Number.isFinite(row.longitude)
      )
      .map((row) => ({
        updateOne: {
          filter: { scopeKey: row.scopeKey, vehicleId: row.vehicleId },
          update: { $set: row },
          upsert: true,
        },
      }));

    if (operations.length > 0) {
      await LiveVehicleCacheEntry.bulkWrite(operations, { ordered: false });
    }

    const currentVehicleIds = operations.map((item) => item.updateOne.filter.vehicleId);
    if (currentVehicleIds.length > 0) {
      await LiveVehicleCacheEntry.deleteMany({
        scopeKey,
        $or: [
          { vehicleId: { $nin: currentVehicleIds } },
          { schemaVersion: { $ne: LIVE_VEHICLE_CACHE_SCHEMA_VERSION } },
        ],
      });
    } else {
      await LiveVehicleCacheEntry.deleteMany({ scopeKey });
    }

    const summary = await recalculateSummary(scopeKey);
    await LiveVehicleCacheState.findOneAndUpdate(
      { scopeKey },
      {
        $set: {
          schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
          loginFor: authContext.loginFor,
          lastSyncedAt: new Date(),
          syncCompletedAt: new Date(),
          lastError: "",
          status: "ready",
          ...summary,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    updateDebugStats(scopeKey, {
      storage: "mongo",
      syncDurationMs: Math.max(0, Date.now() - syncStartedAtMs),
      ...syncStats,
      cacheStateTotal: Number(summary.total || 0),
      externalLiveCallCount: externalCallCount,
      syncCompletedAt: new Date().toISOString(),
      scopeKey,
    });

    return summary;
  } catch (error) {
    const syncError = normalizeSyncError(error);
    await LiveVehicleCacheState.findOneAndUpdate(
      { scopeKey },
      {
        $set: {
          schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
          syncCompletedAt: new Date(),
          lastError: syncError.message || "Live vehicle cache sync failed.",
          status: "degraded",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    updateDebugStats(scopeKey, {
      storage: "mongo",
      lastError: syncError.message || "Live vehicle cache sync failed.",
      syncDurationMs: Math.max(0, Date.now() - syncStartedAtMs),
      syncCompletedAt: new Date().toISOString(),
      syncErrorStatus: syncError.status || 0,
      syncErrorCode: syncError.code || "",
      syncErrorCategory: syncError.category,
      syncTimedOut: syncError.isTimeout,
      scopeKey,
    });
    throw error;
  }
}

async function resolveScopeContext() {
  const authContext = await getCustomerAuthContext();
  const ownershipScope = await resolveOwnershipScope(authContext).catch(() => null);
  const resolvedAuthContext = ownershipScope ? { ...authContext, ...ownershipScope } : authContext;
  const scopeKey = buildAlertScopeKey(resolvedAuthContext);
  return { authContext: resolvedAuthContext, scopeKey };
}

export async function resolveLiveVehicleScopeContext() {
  return resolveScopeContext();
}

function compactQueryForDebug(query = {}) {
  return Object.fromEntries(
    Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

async function syncLiveVehicleMemoryCache(scopeKey, authContext) {
  const syncStartedAtMs = Date.now();
  const memoryStateMap = getMemoryStateMap();
  const memoryEntryMap = getMemoryEntryMap();

  memoryStateMap.set(scopeKey, {
    ...(memoryStateMap.get(scopeKey) || {}),
    scopeKey,
    schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
    loginFor: authContext.loginFor,
    syncStartedAt: new Date(),
    status: "syncing",
    lastError: "",
  });

  try {
    const { rows: externalRows, externalCallCount } = await fetchExternalLiveViewPages();
    const syncStats = summarizeSyncRows(scopeKey, externalRows);
    const previousRows = memoryEntryMap.get(scopeKey) || [];
    const previousRowByVehicleId = new Map(
      previousRows.map((row) => [String(row?.vehicleId || ""), row]).filter(([key]) => key)
    );
    const nextRows = externalRows
      .map((row) => {
        const doc = buildVehicleDocument(scopeKey, authContext, row);
        const previousRow = previousRowByVehicleId.get(String(doc.vehicleId || ""));
        const statusChangedAt = resolveVehicleStatusChangedAt({
          currentStatusKey: doc.statusKey,
          previousRow,
          packetTimeline: doc.packetTimeline,
          explicitStatusChangedAt: doc.explicitStatusChangedAt,
          deviceDatetime: doc.deviceDatetime,
          sourceTimestamp: doc.sourceTimestamp,
          serverDatetime: doc.serverDatetime,
        });
        return {
          ...doc,
          statusChangedAt,
          updatedAt: new Date(),
        };
      })
      .filter(
        (row) =>
          row.vehicleId &&
          Number.isFinite(row.latitude) &&
          Number.isFinite(row.longitude)
      );

    memoryEntryMap.set(scopeKey, nextRows);
    const summary = recalculateMemorySummary(nextRows);
    memoryStateMap.set(scopeKey, {
      scopeKey,
      schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
      loginFor: authContext.loginFor,
      lastSyncedAt: new Date(),
      syncStartedAt: new Date(),
      syncCompletedAt: new Date(),
      lastError: "",
      status: "ready",
      ...summary,
    });
    updateDebugStats(scopeKey, {
      storage: "memory",
      syncDurationMs: Math.max(0, Date.now() - syncStartedAtMs),
      ...syncStats,
      cacheStateTotal: Number(summary.total || 0),
      externalLiveCallCount: externalCallCount,
      syncCompletedAt: new Date().toISOString(),
      scopeKey,
    });

    return summary;
  } catch (error) {
    const syncError = normalizeSyncError(error);
    const previousState = memoryStateMap.get(scopeKey) || {};
    memoryStateMap.set(scopeKey, {
      ...previousState,
      scopeKey,
      schemaVersion: LIVE_VEHICLE_CACHE_SCHEMA_VERSION,
      loginFor: authContext.loginFor,
      syncCompletedAt: new Date(),
      lastError: syncError.message || "Live vehicle memory cache sync failed.",
      status: "degraded",
    });
    updateDebugStats(scopeKey, {
      storage: "memory",
      lastError: syncError.message || "Live vehicle memory cache sync failed.",
      syncDurationMs: Math.max(0, Date.now() - syncStartedAtMs),
      syncCompletedAt: new Date().toISOString(),
      syncErrorStatus: syncError.status || 0,
      syncErrorCode: syncError.code || "",
      syncErrorCategory: syncError.category,
      syncTimedOut: syncError.isTimeout,
      scopeKey,
    });
    throw error;
  }
}

async function ensureLiveVehicleMemoryCacheFresh(scopeKey, authContext, { force = false } = {}) {
  const memoryStateMap = getMemoryStateMap();
  const state = memoryStateMap.get(scopeKey) || null;
  const isFresh = !force && isStateFresh(state);

  if (isFresh) {
    return {
      scopeKey,
      authContext,
      summary: {
        ...readStateSummary(state),
      },
      cacheState: state,
      storage: "memory",
    };
  }

  const syncMap = getSyncMap();
  let syncJob = syncMap.get(scopeKey);

  if (!syncJob) {
    syncJob = createSingleFlightSyncJob(scopeKey, () =>
      syncLiveVehicleMemoryCache(scopeKey, authContext)
    );
  }

  const syncResult = await syncJob.promise;
  if (!syncResult?.ok) {
    throw syncResult?.error?.cause || new Error(syncResult?.error?.message || "Live vehicle memory cache sync failed.");
  }

  const nextState = memoryStateMap.get(scopeKey) || null;
  return {
    scopeKey,
    authContext,
    summary: {
      total: Number(nextState?.total || 0),
      running: Number(nextState?.running || 0),
      idle: Number(nextState?.idle || 0),
      stopped: Number(nextState?.stopped || 0),
      inactive: Number(nextState?.inactive || 0),
      nodata: Number(nextState?.nodata || 0),
    },
    cacheState: nextState,
    storage: "memory",
  };
}

export async function ensureLiveVehicleCacheFresh({ force = false, scopeContext = null } = {}) {
  const { authContext, scopeKey } = scopeContext || (await resolveScopeContext());
  const dbAvailable = await canUseLiveVehicleDb();

  if (!dbAvailable) {
    return ensureLiveVehicleMemoryCacheFresh(scopeKey, authContext, { force });
  }

  try {
    const state = await LiveVehicleCacheState.findOne({ scopeKey }).lean();
    const isFresh = !force && isStateFresh(state);

    if (isFresh) {
      return {
        scopeKey,
        authContext,
        summary: { ...readStateSummary(state) },
        cacheState: state,
        storage: "mongo",
      };
    }

    const syncMap = getSyncMap();
    let syncJob = syncMap.get(scopeKey);

    if (!syncJob) {
      syncJob = createSingleFlightSyncJob(scopeKey, () =>
        syncLiveVehicleCache(scopeKey, authContext)
      );
    }

    const syncResult = await syncJob.promise;
    if (!syncResult?.ok) {
      throw syncResult?.error?.cause || new Error(syncResult?.error?.message || "Live vehicle cache sync failed.");
    }

    const nextState = await LiveVehicleCacheState.findOne({ scopeKey }).lean();
    return {
      scopeKey,
      authContext,
      summary: { ...readStateSummary(nextState) },
      cacheState: nextState,
      storage: "mongo",
    };
  } catch (error) {
    const dbStatus = getDbStatus();
    dbStatus.available = false;
    dbStatus.lastCheckedAt = Date.now();
    dbStatus.lastError = error?.message || "Live vehicle Mongo cache unavailable.";
    console.warn("[liveVehicleCache] Falling back to memory cache.", dbStatus.lastError);
    return ensureLiveVehicleMemoryCacheFresh(scopeKey, authContext, { force });
  }
}

async function readLiveVehicleCacheState(scopeKey, storageHint = "") {
  if (storageHint === "memory") {
    const state = getMemoryStateMap().get(scopeKey) || null;
    return {
      state,
      storage: "memory",
      meta: buildFreshnessMetadata(scopeKey, state, "memory"),
    };
  }

  if (storageHint === "mongo") {
    const state = await withLiveVehicleDbTimeout(
      () =>
        LiveVehicleCacheState.findOne({ scopeKey })
          .maxTimeMS(LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS)
          .lean(),
      "Live vehicle state query timed out."
    );
    return {
      state,
      storage: "mongo",
      meta: buildFreshnessMetadata(scopeKey, state, "mongo"),
    };
  }

  const dbAvailable = await canUseLiveVehicleDb();
  if (!dbAvailable) {
    return readLiveVehicleCacheState(scopeKey, "memory");
  }

  return readLiveVehicleCacheState(scopeKey, "mongo");
}

async function startLiveVehicleMemorySync(scopeKey, authContext, { force = false } = {}) {
  const state = getMemoryStateMap().get(scopeKey) || null;
  if (!force && isStateFresh(state)) {
    return {
      triggered: false,
      reused: false,
      promise: null,
      meta: buildFreshnessMetadata(scopeKey, state, "memory"),
      storage: "memory",
    };
  }

  const syncMap = getSyncMap();
  let syncJob = syncMap.get(scopeKey);
  const reused = Boolean(syncJob);

  if (!syncJob) {
    updateDebugStats(scopeKey, {
      syncTriggered: true,
      syncTriggeredAt: new Date().toISOString(),
      syncReusedSingleFlight: false,
      responseSource: "memory",
    });
    syncJob = createSingleFlightSyncJob(scopeKey, () =>
      syncLiveVehicleMemoryCache(scopeKey, authContext)
    );
  } else {
    updateDebugStats(scopeKey, {
      syncTriggered: true,
      syncTriggeredAt: new Date().toISOString(),
      syncReusedSingleFlight: true,
      responseSource: "memory",
    });
  }

  return {
    triggered: true,
    reused,
    promise: syncJob.promise,
    meta: buildFreshnessMetadata(scopeKey, state, "memory", { syncInFlight: true }),
    storage: "memory",
  };
}

async function startLiveVehicleMongoSync(scopeKey, authContext, { force = false } = {}) {
  const state = await withLiveVehicleDbTimeout(
    () =>
      LiveVehicleCacheState.findOne({ scopeKey })
        .maxTimeMS(LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS)
        .lean(),
    "Live vehicle sync state query timed out."
  );
  if (!force && isStateFresh(state)) {
    return {
      triggered: false,
      reused: false,
      promise: null,
      meta: buildFreshnessMetadata(scopeKey, state, "mongo"),
      storage: "mongo",
    };
  }

  const syncMap = getSyncMap();
  let syncJob = syncMap.get(scopeKey);
  const reused = Boolean(syncJob);

  if (!syncJob) {
    updateDebugStats(scopeKey, {
      syncTriggered: true,
      syncTriggeredAt: new Date().toISOString(),
      syncReusedSingleFlight: false,
      responseSource: "mongo",
    });
    syncJob = createSingleFlightSyncJob(scopeKey, () =>
      syncLiveVehicleCache(scopeKey, authContext)
    );
  } else {
    updateDebugStats(scopeKey, {
      syncTriggered: true,
      syncTriggeredAt: new Date().toISOString(),
      syncReusedSingleFlight: true,
      responseSource: "mongo",
    });
  }

  return {
    triggered: true,
    reused,
    promise: syncJob.promise,
    meta: buildFreshnessMetadata(scopeKey, state, "mongo", { syncInFlight: true }),
    storage: "mongo",
  };
}

export async function triggerLiveVehicleCacheRefresh({
  force = false,
  scopeContext = null,
  reason = "",
} = {}) {
  const { authContext, scopeKey } = scopeContext || (await resolveScopeContext());
  const dbAvailable = await canUseLiveVehicleDb();
  if (reason) {
    updateDebugStats(scopeKey, {
      syncReason: String(reason),
    });
  }

  if (!dbAvailable) {
    return startLiveVehicleMemorySync(scopeKey, authContext, { force });
  }

  try {
    return await startLiveVehicleMongoSync(scopeKey, authContext, { force });
  } catch (error) {
    const dbStatus = getDbStatus();
    dbStatus.available = false;
    dbStatus.lastCheckedAt = Date.now();
    dbStatus.lastError = error?.message || "Live vehicle Mongo cache unavailable.";
    console.warn("[liveVehicleCache] Falling back to memory cache.", dbStatus.lastError);
    return startLiveVehicleMemorySync(scopeKey, authContext, { force });
  }
}

export async function getLiveVehiclesFromCache(query = {}, { scopeContext = null } = {}) {
  const result = await getLiveVehiclesFromCacheDetailed(query, { scopeContext });
  return result.vehicles;
}

async function getLiveVehiclesFromCacheDetailed(query = {}, { scopeContext = null } = {}) {
  const { scopeKey } = scopeContext || (await resolveScopeContext());
  const dbAvailable = await canUseLiveVehicleDb();
  const limit = buildMemoryQueryLimit(query);
  const offset = Math.max(0, Number(query.offset || 0));
  const queryForDebug = compactQueryForDebug(query);

  if (!dbAvailable) {
    const bucketRows = getMemoryEntryMap().get(scopeKey) || [];
    const filteredRows = bucketRows.filter((row) => matchesVehicleQuery(row, query));
    const rows = sortVehicleRows(filteredRows);
    const slicedRows = rows.slice(offset, offset + limit);
    updateDebugStats(scopeKey, {
      readStorage: "memory",
      memoryBucketCount: bucketRows.length,
      memoryFilteredCount: filteredRows.length,
      readReturnedCount: slicedRows.length,
      readLimit: limit,
      readOffset: offset,
      readQuery: queryForDebug,
    });
    return {
      vehicles: slicedRows.map(toNormalizedVehicle),
      readStorage: "memory",
    };
  }

  try {
    const mongoQuery = buildMongoQuery(scopeKey, query);
    const legacyMongoQuery = buildLegacyMongoQuery(scopeKey, query);
    const useReadHint = hasOnlyPaginationQuery(query);
    const rows = await withLiveVehicleDbTimeout(
      () =>
        {
          const mongoReadQuery = LiveVehicleCacheEntry.find(mongoQuery)
            .sort({ updatedAt: -1, speed: -1, vehicleNo: 1 })
            .skip(offset)
            .limit(limit)
            .maxTimeMS(LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS)
            .lean();
          if (useReadHint) {
            mongoReadQuery.hint("live_vehicle_cache_read_v2");
          }
          return mongoReadQuery;
        },
      "Live vehicle cache read timed out."
    );

    let effectiveRows = rows;
    let readStorage = "mongo";

    if (rows.length === 0) {
      effectiveRows = await withLiveVehicleDbTimeout(
        () =>
          {
            const legacyReadQuery = LiveVehicleCacheEntry.find(legacyMongoQuery)
              .sort({ updatedAt: -1, speed: -1, vehicleNo: 1 })
              .skip(offset)
              .limit(limit)
              .maxTimeMS(LIVE_VEHICLE_DB_QUERY_TIMEOUT_MS)
              .lean();
            if (useReadHint) {
              legacyReadQuery.hint("live_vehicle_cache_read_legacy_v1");
            }
            return legacyReadQuery;
          },
        "Live vehicle legacy cache read timed out."
      );
      if (effectiveRows.length > 0) {
        readStorage = "mongo-legacy";
      }
    }

    updateDebugStats(scopeKey, {
      readStorage,
      readReturnedCount: effectiveRows.length,
      readLimit: limit,
      readOffset: offset,
      readQuery: queryForDebug,
    });
    return {
      vehicles: effectiveRows.map(toNormalizedVehicle),
      readStorage,
    };
  } catch (error) {
    const dbStatus = getDbStatus();
    dbStatus.available = false;
    dbStatus.lastCheckedAt = Date.now();
    dbStatus.lastError = error?.message || "Live vehicle Mongo query failed.";
    console.warn("[liveVehicleCache] Returning memory cache after Mongo query failure.", dbStatus.lastError);
    const bucketRows = getMemoryEntryMap().get(scopeKey) || [];
    const filteredRows = bucketRows.filter((row) => matchesVehicleQuery(row, query));
    const rows = sortVehicleRows(filteredRows);
    const slicedRows = rows.slice(offset, offset + limit);
    updateDebugStats(scopeKey, {
      readStorage: "memory-fallback",
      memoryBucketCount: bucketRows.length,
      memoryFilteredCount: filteredRows.length,
      readReturnedCount: slicedRows.length,
      readLimit: limit,
      readOffset: offset,
      readQuery: queryForDebug,
      lastError: dbStatus.lastError,
    });
    return {
      vehicles: slicedRows.map(toNormalizedVehicle),
      readStorage: "memory-fallback",
    };
  }
}

export async function getLiveVehicleCacheSnapshot(query = {}, { scopeContext = null } = {}) {
  const context = scopeContext || (await resolveScopeContext());
  const { scopeKey } = context;
  const stateSnapshot = await readLiveVehicleCacheState(scopeKey);
  const cacheRead = await getLiveVehiclesFromCacheDetailed(query, { scopeContext: context });
  const vehicles = cacheRead.vehicles;
  const actualReadStorage = String(cacheRead?.readStorage || stateSnapshot.storage || "unknown");
  const isReadFromStaleStorage = actualReadStorage.includes("fallback") || actualReadStorage.includes("legacy");
  const meta = buildFreshnessMetadata(scopeKey, stateSnapshot.state, stateSnapshot.storage, {
    responseSource: stateSnapshot.meta.hasSnapshot
      ? stateSnapshot.meta.isStale || isReadFromStaleStorage
        ? `${actualReadStorage}-stale`
        : actualReadStorage
      : `${actualReadStorage}-empty`,
    cacheHit: Array.isArray(vehicles) && vehicles.length > 0,
    readStorage: actualReadStorage,
  });
  return {
    vehicles,
    scopeKey,
    storage: stateSnapshot.storage,
    cacheState: stateSnapshot.state,
    meta,
  };
}

export async function getLiveVehicleDebugSnapshot({ scopeContext = null } = {}) {
  const { scopeKey } = scopeContext || (await resolveScopeContext());
  const memoryRows = getMemoryEntryMap().get(scopeKey) || [];
  return {
    scopeKey,
    memoryBucketCount: memoryRows.length,
    cacheReadOnlyMode: LIVE_VEHICLE_CACHE_READ_ONLY_MODE,
    allowDirectExternalFallback: LIVE_VEHICLE_ALLOW_DIRECT_EXTERNAL_FALLBACK,
    ...(getDebugStatsMap().get(scopeKey) || {}),
  };
}

export function isLiveVehicleCacheReadOnlyMode() {
  return LIVE_VEHICLE_CACHE_READ_ONLY_MODE;
}

export function isLiveVehicleDirectFallbackEnabled() {
  return LIVE_VEHICLE_ALLOW_DIRECT_EXTERNAL_FALLBACK;
}
