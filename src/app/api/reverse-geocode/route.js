import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ReverseGeocodeCache } from "@/lib/models/ReverseGeocodeCache";

export const runtime = "nodejs";

const cache = globalThis.__vtpReverseGeocodeCache || new Map();
if (!globalThis.__vtpReverseGeocodeCache) {
  globalThis.__vtpReverseGeocodeCache = cache;
}

const inFlightRequests = globalThis.__vtpReverseGeocodeInflight || new Map();
if (!globalThis.__vtpReverseGeocodeInflight) {
  globalThis.__vtpReverseGeocodeInflight = inFlightRequests;
}

const failureCache = globalThis.__vtpReverseGeocodeFailures || new Map();
if (!globalThis.__vtpReverseGeocodeFailures) {
  globalThis.__vtpReverseGeocodeFailures = failureCache;
}

const upstreamState = globalThis.__vtpReverseGeocodeUpstreamState || {
  chain: Promise.resolve(),
  lastRunAt: 0,
};
if (!globalThis.__vtpReverseGeocodeUpstreamState) {
  globalThis.__vtpReverseGeocodeUpstreamState = upstreamState;
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MEMORY_CACHE_LIMIT = 1000;
const UPSTREAM_MIN_INTERVAL_MS = 1100;
const FAILURE_COOLDOWN_MS = 1000 * 60 * 10;
const USER_AGENT = process.env.REVERSE_GEOCODE_USER_AGENT || "VTPTrackingCustomerPanel/1.0";
const RESPONSE_LANGUAGE = "en";

const clampCoordinate = (value, min, max) => Math.min(max, Math.max(min, value));

const buildCoordinateKey = (latitude, longitude, language = RESPONSE_LANGUAGE) =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}:${language}`;

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const trimMemoryCache = () => {
  if (cache.size <= MEMORY_CACHE_LIMIT) return;
  const staleKeys = [...cache.entries()]
    .sort((left, right) => left[1].storedAt - right[1].storedAt)
    .slice(0, cache.size - MEMORY_CACHE_LIMIT)
    .map(([key]) => key);

  staleKeys.forEach((key) => cache.delete(key));
};

function readFailureCooldown(cacheKey) {
  const cachedEntry = failureCache.get(cacheKey);
  if (!cachedEntry) return null;
  if (cachedEntry.until <= Date.now()) {
    failureCache.delete(cacheKey);
    return null;
  }
  return cachedEntry;
}

function writeFailureCooldown(cacheKey, error) {
  const status = Number(error?.status || 500);
  if (status !== 429) return;

  failureCache.set(cacheKey, {
    status,
    message: "Reverse geocode upstream is cooling down.",
    until: Date.now() + FAILURE_COOLDOWN_MS,
  });
}

function runUpstreamWithThrottle(task) {
  const scheduled = upstreamState.chain
    .catch(() => undefined)
    .then(async () => {
      const waitMs = Math.max(0, upstreamState.lastRunAt + UPSTREAM_MIN_INTERVAL_MS - Date.now());
      if (waitMs > 0) {
        await delay(waitMs);
      }

      try {
        return await task();
      } finally {
        upstreamState.lastRunAt = Date.now();
      }
    });

  upstreamState.chain = scheduled.catch(() => undefined);
  return scheduled;
}

function readMemoryCache(cacheKey) {
  const cachedEntry = cache.get(cacheKey);
  if (!cachedEntry) return null;
  if (Date.now() - cachedEntry.storedAt > CACHE_TTL_MS) {
    cache.delete(cacheKey);
    return null;
  }
  return cachedEntry;
}

function writeMemoryCache(cacheKey, payload) {
  cache.set(cacheKey, {
    address: payload.address,
    provider: payload.provider || "nominatim",
    storedAt: Date.now(),
  });
  trimMemoryCache();
}

async function readMongoCache(cacheKey) {
  try {
    await dbConnect();
  } catch {
    return null;
  }

  const doc = await ReverseGeocodeCache.findOne({ coordinateKey: cacheKey }).lean();
  if (!doc?.address) return null;

  const updatedAtMs = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  if (updatedAtMs > 0 && Date.now() - updatedAtMs > CACHE_TTL_MS) {
    return null;
  }

  void ReverseGeocodeCache.updateOne(
    { coordinateKey: cacheKey },
    {
      $set: { lastAccessedAt: new Date() },
      $inc: { hits: 1 },
    }
  ).catch(() => {});

  return {
    address: doc.address,
    provider: doc.provider || "nominatim",
    cached: true,
  };
}

async function writeMongoCache({ cacheKey, latitude, longitude, address, provider, language }) {
  try {
    await dbConnect();
  } catch {
    return;
  }

  const now = new Date();
  await ReverseGeocodeCache.updateOne(
    { coordinateKey: cacheKey },
    {
      $set: {
        coordinateKey: cacheKey,
        latitude,
        longitude,
        language,
        address,
        provider,
        lastResolvedAt: now,
        lastAccessedAt: now,
      },
      $inc: { hits: 1 },
    },
    { upsert: true }
  );
}

async function fetchUpstreamReverseGeocode(latitude, longitude) {
  const upstreamUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  upstreamUrl.searchParams.set("format", "jsonv2");
  upstreamUrl.searchParams.set("lat", String(latitude));
  upstreamUrl.searchParams.set("lon", String(longitude));
  upstreamUrl.searchParams.set("zoom", "18");
  upstreamUrl.searchParams.set("addressdetails", "1");
  upstreamUrl.searchParams.set("accept-language", RESPONSE_LANGUAGE);

  const response = await fetch(upstreamUrl, {
    headers: {
      Accept: "application/json",
      "Accept-Language": RESPONSE_LANGUAGE,
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const error = new Error("Reverse geocode request failed.");
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const address = String(payload?.display_name || "").trim();

  if (!address) {
    const error = new Error("No location found for coordinates.");
    error.status = 404;
    throw error;
  }

  return {
    address,
    provider: "nominatim",
    cached: false,
  };
}

async function resolveAddress({ cacheKey, latitude, longitude }) {
  const memoryEntry = readMemoryCache(cacheKey);
  if (memoryEntry) {
    return {
      address: memoryEntry.address,
      provider: memoryEntry.provider,
      cached: true,
    };
  }

  const mongoEntry = await readMongoCache(cacheKey);
  if (mongoEntry) {
    writeMemoryCache(cacheKey, mongoEntry);
    return mongoEntry;
  }

  const failureEntry = readFailureCooldown(cacheKey);
  if (failureEntry) {
    const error = new Error(failureEntry.message);
    error.status = failureEntry.status;
    throw error;
  }

  let inFlight = inFlightRequests.get(cacheKey);
  if (!inFlight) {
    inFlight = (async () => {
      let upstreamEntry;
      try {
        upstreamEntry = await runUpstreamWithThrottle(() =>
          fetchUpstreamReverseGeocode(latitude, longitude)
        );
      } catch (error) {
        writeFailureCooldown(cacheKey, error);
        throw error;
      }

      writeMemoryCache(cacheKey, upstreamEntry);
      await writeMongoCache({
        cacheKey,
        latitude,
        longitude,
        address: upstreamEntry.address,
        provider: upstreamEntry.provider,
        language: RESPONSE_LANGUAGE,
      });
      return upstreamEntry;
    })().finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    inFlightRequests.set(cacheKey, inFlight);
  }

  return inFlight;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = Number(searchParams.get("lat"));
    const longitude = Number(searchParams.get("lng"));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Valid lat and lng are required." }, { status: 400 });
    }

    const normalizedLatitude = clampCoordinate(latitude, -90, 90);
    const normalizedLongitude = clampCoordinate(longitude, -180, 180);
    const cacheKey = buildCoordinateKey(normalizedLatitude, normalizedLongitude, RESPONSE_LANGUAGE);

    const resolved = await resolveAddress({
      cacheKey,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
    });

    return NextResponse.json(resolved, { status: 200 });
  } catch (error) {
    const status = Number(error?.status || 500);
    return NextResponse.json(
      {
        error: error?.message || "Unable to reverse geocode coordinates.",
      },
      { status }
    );
  }
}
