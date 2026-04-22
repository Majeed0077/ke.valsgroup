const AUTH_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const AUTH_CACHE_STORAGE_KEY = "vtp_auth_session_cache_v1";

let cachedSession = null;
let cachedAt = 0;
let inflightSessionPromise = null;

function sanitizeSessionForClientCache(session) {
  if (!session || typeof session !== "object") return null;
  if (session.isLoggedIn === false) return null;
  const next = { ...session };
  delete next.accessToken;
  return next;
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isSessionExpired(session, storedAt = 0) {
  const expiresAt = Number(session?.expiresAt || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    return Date.now() >= expiresAt;
  }
  return !storedAt || Date.now() - storedAt > AUTH_CACHE_TTL_MS;
}

function readStoredSession() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const storedAt = Number(parsed?.cachedAt || 0);
    if (isSessionExpired(parsed?.session, storedAt)) {
      storage.removeItem(AUTH_CACHE_STORAGE_KEY);
      return null;
    }
    return {
      session: parsed?.session || null,
      cachedAt: storedAt,
    };
  } catch {
    return null;
  }
}

export function getCachedAuthSession() {
  if (cachedSession && !isSessionExpired(cachedSession, cachedAt)) {
    return cachedSession;
  }
  cachedSession = null;
  cachedAt = 0;
  const stored = readStoredSession();
  if (stored?.session) {
    cachedSession = stored.session;
    cachedAt = stored.cachedAt;
    return cachedSession;
  }
  return cachedSession;
}

export function setCachedAuthSession(session) {
  cachedSession = sanitizeSessionForClientCache(session);
  cachedAt = Date.now();
  const storage = getStorage();
  if (storage) {
    try {
      if (!cachedSession) {
        storage.removeItem(AUTH_CACHE_STORAGE_KEY);
      } else {
        storage.setItem(
          AUTH_CACHE_STORAGE_KEY,
          JSON.stringify({ session: cachedSession, cachedAt })
        );
      }
    } catch {
      // ignore storage failures
    }
  }
  return cachedSession;
}

export function getInflightAuthSessionPromise() {
  return inflightSessionPromise;
}

export function setInflightAuthSessionPromise(promise) {
  inflightSessionPromise = promise || null;
  return inflightSessionPromise;
}

export function clearAuthSessionCache() {
  cachedSession = null;
  cachedAt = 0;
  inflightSessionPromise = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(AUTH_CACHE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }
}
