import dbConnect from "@/lib/mongodb";
import { getCustomerAuthContext } from "@/lib/externalMasterApi";
import {
  ALERT_PATHS,
  externalAlertFetch,
  normalizeAlertRow,
  normalizeAlertSeverity,
  normalizeAlertSummary,
} from "@/lib/alertApi";
import { buildAlertScopeKey } from "@/lib/alertScope";
import { AlertCacheEntry, AlertCacheState } from "@/lib/models/AlertCache";
import { resolveOwnershipScope } from "@/lib/ownershipScope";
import { broadcastAlertEvent } from "@/lib/server/alertSocketHub";

const DEFAULT_ALERT_SUMMARY = {
  total: 0,
  unacknowledged: 0,
  acknowledgedToday: 0,
  high: 0,
  medium: 0,
  low: 0,
};

const ALERT_CACHE_SYNC_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.ALERT_CACHE_SYNC_INTERVAL_MS || 60000)
);
const ALERT_CACHE_BATCH_SIZE = Math.max(100, Number(process.env.ALERT_CACHE_BATCH_SIZE || 500));
const ALERT_CACHE_MAX_RECORDS = Math.max(
  ALERT_CACHE_BATCH_SIZE,
  Number(process.env.ALERT_CACHE_MAX_RECORDS || 5000)
);

const globalForAlertCache = globalThis;
if (!globalForAlertCache.__vtpAlertCacheSyncMap) {
  globalForAlertCache.__vtpAlertCacheSyncMap = new Map();
}

function getSyncMap() {
  return globalForAlertCache.__vtpAlertCacheSyncMap;
}

function toDateOrNull(value) {
  if (!value) return null;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSummaryObject(source) {
  return {
    total: Number(source?.total || 0),
    unacknowledged: Number(source?.unacknowledged || 0),
    acknowledgedToday: Number(source?.acknowledgedToday || 0),
    high: Number(source?.high || 0),
    medium: Number(source?.medium || 0),
    low: Number(source?.low || 0),
  };
}

function buildAlertDocument(scopeKey, authContext, row) {
  const normalized = normalizeAlertRow(row);
  const alertTime = toDateOrNull(normalized.time);
  const sourceUpdatedAt = toDateOrNull(row?.updated_at || row?.acknowledged_at || normalized.time);
  const vehicleNumber = String(row?.obj_reg_no || row?.vehicle_no || normalized.vehicleName || "").trim();
  const imei = String(row?.imei || row?.imei_id || "").trim();
  const ruleName = String(row?.rule_name || row?.rule || "").trim();
  const searchText = [
    normalized.message,
    normalized.vehicleName,
    vehicleNumber,
    imei,
    ruleName,
    normalized.remarks,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    scopeKey,
    loginFor: authContext.loginFor,
    alertId: normalized.id,
    severity: normalizeAlertSeverity(normalized.level),
    message: normalized.message,
    ruleName,
    vehicleName: normalized.vehicleName,
    vehicleNumber,
    imei,
    acknowledged: Boolean(normalized.acknowledged),
    remarks: normalized.remarks,
    alertTime,
    sourceUpdatedAt,
    searchText,
    raw: row,
  };
}

function buildMongoQuery(scopeKey, query = {}) {
  const mongoQuery = { scopeKey };

  if (query.acknowledged === "0" || query.acknowledged === "1") {
    mongoQuery.acknowledged = query.acknowledged === "1";
  }

  const severity = String(query.severity || "").trim().toUpperCase();
  if (severity === "HIGH" || severity === "MEDIUM" || severity === "LOW") {
    mongoQuery.severity = severity;
  }

  const timeRange = {};
  const fromDate = toDateOrNull(query.from_date);
  const toDate = toDateOrNull(query.to_date);
  if (fromDate) timeRange.$gte = fromDate;
  if (toDate) timeRange.$lte = toDate;
  if (Object.keys(timeRange).length > 0) {
    mongoQuery.alertTime = timeRange;
  }

  const andConditions = [];
  const imei = String(query.imei || "").trim();
  if (imei) {
    andConditions.push({ imei: { $regex: escapeRegex(imei), $options: "i" } });
  }

  const vehicleName = String(query.obj_name || "").trim();
  if (vehicleName) {
    andConditions.push({
      $or: [
        { vehicleName: { $regex: escapeRegex(vehicleName), $options: "i" } },
        { vehicleNumber: { $regex: escapeRegex(vehicleName), $options: "i" } },
      ],
    });
  }

  const ruleName = String(query.rule_name || "").trim();
  if (ruleName) {
    andConditions.push({ ruleName: { $regex: escapeRegex(ruleName), $options: "i" } });
  }

  const search = String(query.search || "").trim().toLowerCase();
  if (search) {
    andConditions.push({ searchText: { $regex: escapeRegex(search), $options: "i" } });
  }

  if (andConditions.length > 0) {
    mongoQuery.$and = andConditions;
  }

  return mongoQuery;
}

async function fetchExternalAlertPages() {
  const rows = [];
  let offset = 0;
  let reportedTotal = 0;

  while (offset < ALERT_CACHE_MAX_RECORDS) {
    const limit = Math.min(ALERT_CACHE_BATCH_SIZE, ALERT_CACHE_MAX_RECORDS - offset);
    const payload = await externalAlertFetch(ALERT_PATHS.list, {
      query: {
        limit,
        offset,
      },
    });

    const pageRows = Array.isArray(payload?.alerts) ? payload.alerts : [];
    reportedTotal = Number(payload?.total || reportedTotal || pageRows.length);

    if (pageRows.length === 0) break;

    rows.push(...pageRows);
    offset += pageRows.length;

    if (pageRows.length < limit) break;
    if (reportedTotal > 0 && offset >= reportedTotal) break;
  }

  return rows;
}

async function recalculateCacheSummary(scopeKey, acknowledgedToday = null) {
  const buckets = await AlertCacheEntry.aggregate([
    { $match: { scopeKey } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unacknowledged: {
          $sum: {
            $cond: [{ $eq: ["$acknowledged", false] }, 1, 0],
          },
        },
        high: {
          $sum: {
            $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0],
          },
        },
        medium: {
          $sum: {
            $cond: [{ $eq: ["$severity", "MEDIUM"] }, 1, 0],
          },
        },
        low: {
          $sum: {
            $cond: [{ $eq: ["$severity", "LOW"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const bucket = buckets[0] || DEFAULT_ALERT_SUMMARY;
  return {
    total: Number(bucket.total || 0),
    unacknowledged: Number(bucket.unacknowledged || 0),
    acknowledgedToday: Number(acknowledgedToday ?? 0),
    high: Number(bucket.high || 0),
    medium: Number(bucket.medium || 0),
    low: Number(bucket.low || 0),
  };
}

async function syncAlertCache(scopeKey, authContext) {
  const stateUpdateBase = {
    loginFor: authContext.loginFor,
    syncStartedAt: new Date(),
    status: "syncing",
    lastError: "",
  };

  await AlertCacheState.findOneAndUpdate(
    { scopeKey },
    { $set: stateUpdateBase },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    const [externalRows, rawSummary] = await Promise.all([
      fetchExternalAlertPages(),
      externalAlertFetch(ALERT_PATHS.summary).catch(() => null),
    ]);

    const operations = externalRows
      .map((row) => buildAlertDocument(scopeKey, authContext, row))
      .filter((item) => item.alertId > 0)
      .map((item) => ({
        updateOne: {
          filter: { scopeKey: item.scopeKey, alertId: item.alertId },
          update: { $set: item },
          upsert: true,
        },
      }));

    if (operations.length > 0) {
      await AlertCacheEntry.bulkWrite(operations, { ordered: false });
    }

    const normalizedExternalSummary = rawSummary ? normalizeAlertSummary(rawSummary) : DEFAULT_ALERT_SUMMARY;
    const summary = await recalculateCacheSummary(
      scopeKey,
      normalizedExternalSummary.acknowledgedToday
    );

    await AlertCacheState.findOneAndUpdate(
      { scopeKey },
      {
        $set: {
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

    return summary;
  } catch (error) {
    await AlertCacheState.findOneAndUpdate(
      { scopeKey },
      {
        $set: {
          syncCompletedAt: new Date(),
          lastError: error?.message || "Alert cache sync failed.",
          status: "degraded",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    throw error;
  }
}

async function resolveScopeContext() {
  const authContext = await getCustomerAuthContext();
  await dbConnect();
  const ownershipScope = await resolveOwnershipScope(authContext).catch(() => null);
  const resolvedAuthContext = ownershipScope ? { ...authContext, ...ownershipScope } : authContext;
  const scopeKey = buildAlertScopeKey(resolvedAuthContext);
  return { authContext: resolvedAuthContext, scopeKey };
}

async function resolveScopeContextFromAuthContext(authContext) {
  await dbConnect();
  const ownershipScope = await resolveOwnershipScope(authContext).catch(() => null);
  const resolvedAuthContext = ownershipScope ? { ...authContext, ...ownershipScope } : authContext;
  const scopeKey = buildAlertScopeKey(resolvedAuthContext);
  return { authContext: resolvedAuthContext, scopeKey };
}

export async function ensureAlertCacheFresh() {
  const { authContext, scopeKey } = await resolveScopeContext();
  return ensureAlertCacheFreshForAuthContext(authContext, { scopeKey });
}

export async function ensureAlertCacheFreshForAuthContext(
  authContext,
  { force = false, scopeKey: providedScopeKey } = {}
) {
  const { scopeKey } = await resolveScopeContextFromAuthContext(authContext);
  const state = await AlertCacheState.findOne({ scopeKey }).lean();
  const lastSyncedAt = state?.lastSyncedAt ? new Date(state.lastSyncedAt).getTime() : 0;
  const isFresh =
    !force && lastSyncedAt > 0 && Date.now() - lastSyncedAt < ALERT_CACHE_SYNC_INTERVAL_MS;

  if (isFresh) {
    return {
      scopeKey,
      authContext,
      summary: toSummaryObject(state),
      cacheState: state,
    };
  }

  const syncMap = getSyncMap();
  let syncPromise = syncMap.get(scopeKey);

  if (!syncPromise) {
    syncPromise = syncAlertCache(scopeKey, authContext)
      .finally(() => {
        syncMap.delete(scopeKey);
      });
    syncMap.set(scopeKey, syncPromise);
  }

  await syncPromise;

  const nextState = await AlertCacheState.findOne({ scopeKey }).lean();
  const summary = toSummaryObject(nextState);
  broadcastAlertEvent(scopeKey, {
    type: "alerts.refresh",
    scopeKey: providedScopeKey || scopeKey,
    summary,
    syncedAt: nextState?.lastSyncedAt || new Date().toISOString(),
  });

  return {
    scopeKey,
    authContext,
    summary,
    cacheState: nextState,
  };
}

export async function getCachedAlertSummary() {
  const { scopeKey } = await resolveScopeContext();
  const state = await AlertCacheState.findOne({ scopeKey }).lean();
  return {
    scopeKey,
    summary: state ? toSummaryObject(state) : { ...DEFAULT_ALERT_SUMMARY },
    cacheState: state || null,
  };
}

export async function getAlertsFromCache(query = {}) {
  const { scopeKey } = await resolveScopeContext();
  const mongoQuery = buildMongoQuery(scopeKey, query);
  const limit = Math.max(1, Math.min(500, Number(query.limit || 8)));
  const offset = Math.max(0, Number(query.offset || 0));

  const [rows, total, state] = await Promise.all([
    AlertCacheEntry.find(mongoQuery).sort({ alertTime: -1, updatedAt: -1 }).skip(offset).limit(limit).lean(),
    AlertCacheEntry.countDocuments(mongoQuery),
    AlertCacheState.findOne({ scopeKey }).lean(),
  ]);

  return {
    alerts: rows.map((row) => ({
      id: Number(row?.alertId || 0),
      level: normalizeAlertSeverity(
        row?.severity ||
          row?.raw?.severity ||
          row?.raw?.level ||
          row?.raw?.priority ||
          row?.raw?.priority_level ||
          row?.raw?.severity_level ||
          row?.raw?.alert_level ||
          row?.raw?.class ||
          row?.raw?.type ||
          row?.raw?.category
      ),
      message: String(row?.message || row?.ruleName || "Alert received"),
      time: row?.alertTime ? new Date(row.alertTime).toISOString() : "",
      vehicleName: String(row?.vehicleName || row?.vehicleNumber || row?.imei || "Unknown vehicle"),
      acknowledged: Boolean(row?.acknowledged),
      remarks: String(row?.remarks || ""),
      raw: row?.raw || {},
    })),
    total,
    unacknowledged_count: Number(state?.unacknowledged || 0),
    summary: state ? toSummaryObject(state) : { ...DEFAULT_ALERT_SUMMARY },
    cacheState: state || null,
  };
}

export async function markCachedAlertAcknowledged(alertId, remarks = "") {
  const { scopeKey } = await resolveScopeContext();
  await AlertCacheEntry.updateOne(
    { scopeKey, alertId: Number(alertId) },
    {
      $set: {
        acknowledged: true,
        remarks: String(remarks || ""),
        sourceUpdatedAt: new Date(),
      },
    }
  );

  const currentState = await AlertCacheState.findOne({ scopeKey }).lean();
  const summary = await recalculateCacheSummary(
    scopeKey,
    currentState?.acknowledgedToday ?? DEFAULT_ALERT_SUMMARY.acknowledgedToday
  );

  await AlertCacheState.findOneAndUpdate(
    { scopeKey },
    {
      $set: {
        ...summary,
        status: currentState?.status || "ready",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  broadcastAlertEvent(scopeKey, {
    type: "alerts.refresh",
    scopeKey,
    summary,
    syncedAt: new Date().toISOString(),
  });

  return summary;
}
