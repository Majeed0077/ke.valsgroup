import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import { getCustomerAuthContext } from "@/lib/externalMasterApi";
import { PlaybackHistoryCache } from "@/lib/models/PlaybackHistoryCache";

const PLAYBACK_HISTORY_CACHE_TTL_MS = Math.max(
  60000,
  Number(process.env.PLAYBACK_HISTORY_CACHE_TTL_MS || 5 * 60 * 1000)
);
const PLAYBACK_HISTORY_CACHE_SCHEMA_VERSION = 1;
const PLAYBACK_HISTORY_MEMORY_CACHE_MAX_ENTRIES = Math.max(
  20,
  Number(process.env.PLAYBACK_HISTORY_MEMORY_CACHE_MAX_ENTRIES || 200)
);

const globalForPlaybackHistoryCache = globalThis;
if (!globalForPlaybackHistoryCache.__vtpPlaybackHistoryMemoryCache) {
  globalForPlaybackHistoryCache.__vtpPlaybackHistoryMemoryCache = new Map();
}

function getMemoryCache() {
  return globalForPlaybackHistoryCache.__vtpPlaybackHistoryMemoryCache;
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function stableQueryEntries(query = {}) {
  return Object.entries(query || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => [String(key), String(value)])
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
}

function serializeQuery(query = {}) {
  return JSON.stringify(Object.fromEntries(stableQueryEntries(query)));
}

function normalizeLookup(query = {}) {
  const candidates = ["imei_id", "obj_reg_no", "obj_name"];
  for (const key of candidates) {
    const value = String(query?.[key] || "").trim();
    if (value) {
      return { lookupType: key, lookupValue: value };
    }
  }
  return { lookupType: "", lookupValue: "" };
}

function pruneMemoryCache() {
  const cache = getMemoryCache();
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      cache.delete(key);
    }
  }

  if (cache.size <= PLAYBACK_HISTORY_MEMORY_CACHE_MAX_ENTRIES) return;

  const oldestKeys = [...cache.entries()]
    .sort((left, right) => Number(left[1]?.storedAt || 0) - Number(right[1]?.storedAt || 0))
    .slice(0, cache.size - PLAYBACK_HISTORY_MEMORY_CACHE_MAX_ENTRIES)
    .map(([key]) => key);
  oldestKeys.forEach((key) => cache.delete(key));
}

export function buildPlaybackHistoryScopeKey(authContext = {}) {
  const userIdentity = String(
    authContext?.externalUserId ||
      authContext?.entryUser ||
      authContext?.userId ||
      authContext?.username ||
      ""
  ).trim();
  const loginFor = String(authContext?.loginFor || "").trim().toUpperCase();
  const loginKey = String(authContext?.loginKey || "").trim();
  const ownershipScopeType = String(authContext?.ownershipScopeType || "").trim();
  const ownershipScopeId = String(authContext?.ownershipScopeId || "").trim();

  return hashValue(
    [userIdentity || "anonymous", loginFor, loginKey, ownershipScopeType, ownershipScopeId].join("|")
  );
}

export function buildPlaybackHistoryCacheContext(query = {}, authContext = {}) {
  const normalizedQuery = Object.fromEntries(stableQueryEntries(query));
  const scopeKey = buildPlaybackHistoryScopeKey(authContext);
  const querySerialized = serializeQuery(normalizedQuery);
  const queryHash = hashValue(querySerialized);
  const { lookupType, lookupValue } = normalizeLookup(normalizedQuery);
  const cacheKey = hashValue(`${scopeKey}|${queryHash}`);

  return {
    scopeKey,
    queryHash,
    cacheKey,
    normalizedQuery,
    lookupType,
    lookupValue,
    fromDate: String(normalizedQuery.from_date || ""),
    toDate: String(normalizedQuery.to_date || ""),
  };
}

function readMemoryCache(cacheKey) {
  pruneMemoryCache();
  const entry = getMemoryCache().get(cacheKey);
  if (!entry) return null;
  if (Number(entry.expiresAt || 0) <= Date.now()) {
    getMemoryCache().delete(cacheKey);
    return null;
  }
  entry.lastAccessedAt = Date.now();
  entry.hits = Number(entry.hits || 0) + 1;
  return Array.isArray(entry.rows) ? entry.rows : null;
}

function writeMemoryCache(cacheKey, rows) {
  const now = Date.now();
  getMemoryCache().set(cacheKey, {
    rows: Array.isArray(rows) ? rows : [],
    storedAt: now,
    lastAccessedAt: now,
    expiresAt: now + PLAYBACK_HISTORY_CACHE_TTL_MS,
    hits: 1,
  });
  pruneMemoryCache();
}

export async function readPlaybackHistoryCache(query = {}, authContext = null) {
  const resolvedAuthContext = authContext || (await getCustomerAuthContext());
  const context = buildPlaybackHistoryCacheContext(query, resolvedAuthContext);

  const memoryRows = readMemoryCache(context.cacheKey);
  if (memoryRows) {
    return {
      rows: memoryRows,
      source: "memory",
      context,
      authContext: resolvedAuthContext,
    };
  }

  try {
    await dbConnect();
  } catch {
    return {
      rows: null,
      source: "miss",
      context,
      authContext: resolvedAuthContext,
    };
  }

  const doc = await PlaybackHistoryCache.findOne({
    cacheKey: context.cacheKey,
    scopeKey: context.scopeKey,
    schemaVersion: PLAYBACK_HISTORY_CACHE_SCHEMA_VERSION,
  }).lean();

  if (!doc?.expiresAt || new Date(doc.expiresAt).getTime() <= Date.now()) {
    return {
      rows: null,
      source: "miss",
      context,
      authContext: resolvedAuthContext,
    };
  }

  const rows = Array.isArray(doc.rows) ? doc.rows : [];
  writeMemoryCache(context.cacheKey, rows);
  void PlaybackHistoryCache.updateOne(
    { cacheKey: context.cacheKey },
    {
      $set: { lastAccessedAt: new Date() },
      $inc: { hits: 1 },
    }
  ).catch(() => {});

  return {
    rows,
    source: "mongo",
    context,
    authContext: resolvedAuthContext,
  };
}

export async function writePlaybackHistoryCache(query = {}, rows = [], authContext = null) {
  const resolvedAuthContext = authContext || (await getCustomerAuthContext());
  const context = buildPlaybackHistoryCacheContext(query, resolvedAuthContext);
  const normalizedRows = Array.isArray(rows) ? rows : [];
  writeMemoryCache(context.cacheKey, normalizedRows);

  try {
    await dbConnect();
  } catch {
    return { ok: false, source: "memory-only", context };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PLAYBACK_HISTORY_CACHE_TTL_MS);
  await PlaybackHistoryCache.updateOne(
    { cacheKey: context.cacheKey },
    {
      $set: {
        cacheKey: context.cacheKey,
        scopeKey: context.scopeKey,
        schemaVersion: PLAYBACK_HISTORY_CACHE_SCHEMA_VERSION,
        lookupType: context.lookupType,
        lookupValue: context.lookupValue,
        fromDate: context.fromDate,
        toDate: context.toDate,
        queryHash: context.queryHash,
        rowCount: normalizedRows.length,
        rows: normalizedRows,
        lastFetchedAt: now,
        lastAccessedAt: now,
        expiresAt,
      },
      $inc: { hits: 1 },
    },
    { upsert: true }
  );

  return { ok: true, source: "mongo", context };
}
