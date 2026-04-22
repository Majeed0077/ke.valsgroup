const DEFAULT_SESSION_TTL_FALLBACK_MS = 1000 * 60 * 60 * 24 * 90;

export const DEFAULT_SESSION_TTL_MS = Number(
  process.env.AUTH_SESSION_TTL_MS || DEFAULT_SESSION_TTL_FALLBACK_MS
);
export const REMEMBER_DEVICE_SESSION_TTL_MS = Number(
  process.env.AUTH_REMEMBER_DEVICE_TTL_MS || DEFAULT_SESSION_TTL_MS || DEFAULT_SESSION_TTL_FALLBACK_MS
);
export const AUTH_CONTEXT_TTL_MS = 1000 * 60 * 60 * 24 * 365;

function resolveSameSitePolicy() {
  return process.env.NODE_ENV === "production" ? "none" : "lax";
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function sanitizeAssignedRoles(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const key = String(item.key || "").trim();
      if (!key) return null;
      return {
        key,
        name: String(item.name || key),
        description: String(item.description || ""),
      };
    })
    .filter(Boolean);
}

function sanitizeRightsCatalog(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const key = String(item.key || "").trim();
      if (!key) return null;
      return {
        key,
        label: String(item.label || key),
        description: String(item.description || ""),
      };
    })
    .filter(Boolean);
}

function sanitizeMenuAccess(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const key = String(item.key || "").trim();
      if (!key) return null;
      return {
        key,
        label: String(item.label || key),
        route: String(item.route || ""),
        group: String(item.group || "main"),
        parentKey: String(item.parentKey || ""),
        order: Number(item.order || 0),
        actions:
          item.actions && typeof item.actions === "object"
            ? Object.fromEntries(
                Object.entries(item.actions).map(([actionKey, allowed]) => [
                  String(actionKey || "").trim(),
                  Boolean(allowed),
                ])
              )
            : {},
        roleKeys: uniqueStrings(item.roleKeys),
      };
    })
    .filter(Boolean);
}

function buildSessionCookiePayload(session) {
  if (!session || typeof session !== "object") return null;

  const {
    assignedRoleKeys,
    assignedRoles,
    rightsCatalog,
    menuAccess,
    ...cookieSession
  } = session;

  return cookieSession;
}

export function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
  return atob(normalized);
}

export function parseJwtPayload(token) {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return null;
  }
}

export function resolveTokenExpiry(accessToken) {
  const exp = Number(parseJwtPayload(accessToken)?.exp || 0);
  if (Number.isFinite(exp) && exp > 0) return exp * 1000;
  return 0;
}

export function resolveSessionTtlMs(rememberMe = false) {
  const configuredTtl = rememberMe ? REMEMBER_DEVICE_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS;
  if (Number.isFinite(configuredTtl) && configuredTtl > 0) return configuredTtl;
  return DEFAULT_SESSION_TTL_FALLBACK_MS;
}

export function resolveSessionExpiry(rememberMe = false, now = Date.now()) {
  return now + resolveSessionTtlMs(rememberMe);
}

export function normalizeAuthSession(raw) {
  if (!raw || typeof raw !== "object") return null;

  const accessToken = String(raw.accessToken || raw.access_token || "");
  const loginFor = String(raw.loginFor || raw.login_for || raw.role || "").toUpperCase();
  const role = loginFor === "D" || raw.role === "admin" ? "admin" : "user";
  const rememberMe = Boolean(raw.rememberMe ?? raw.remember_me);
  const tokenExpiresAt = Number(raw.tokenExpiresAt || raw.token_expires_at || resolveTokenExpiry(accessToken) || 0);
  const requestedSessionExpiry = Number(raw.expiresAt || raw.sessionExpiresAt || 0);
  const appManagedSessionExpiry = resolveSessionExpiry(rememberMe);
  let expiresAt =
    Number.isFinite(requestedSessionExpiry) && requestedSessionExpiry > 0
      ? Math.max(requestedSessionExpiry, appManagedSessionExpiry)
      : appManagedSessionExpiry;

  if (!accessToken) return null;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  return {
    isLoggedIn: true,
    accessToken,
    tokenType: String(raw.tokenType || raw.token_type || "bearer"),
    userId: String(raw.userId || raw.userid || ""),
    externalUserId: String(raw.externalUserId || raw.userId || raw.userid || ""),
    username: String(raw.username || raw.name || ""),
    email: String(raw.email || ""),
    mobile: String(raw.mobile || ""),
    role,
    loginFor: role === "admin" ? "D" : "C",
    loginKey: String(raw.loginKey || raw.login_key || ""),
    loginDesc: String(raw.loginDesc || raw.login_desc || ""),
    distributorId: String(raw.distributorId || raw.distributor_id || raw.distributiors_id || ""),
    organizationId: String(raw.organizationId || raw.organization_id || raw.org_id || ""),
    companyId: String(raw.companyId || raw.company_id || raw.comp_id || raw.client_id || ""),
    ownershipScopeType: String(raw.ownershipScopeType || raw.ownership_scope_type || ""),
    ownershipScopeId: String(raw.ownershipScopeId || raw.ownership_scope_id || ""),
    status: String(raw.status || ""),
    loginAt: String(raw.loginAt || new Date().toISOString()),
    expiresAt,
    tokenExpiresAt: Number.isFinite(tokenExpiresAt) && tokenExpiresAt > 0 ? tokenExpiresAt : null,
    rememberMe,
    assignedRoleKeys: uniqueStrings(raw.assignedRoleKeys || raw.roleKeys),
    assignedRoles: sanitizeAssignedRoles(raw.assignedRoles),
    rightsCatalog: sanitizeRightsCatalog(raw.rightsCatalog),
    menuAccess: sanitizeMenuAccess(raw.menuAccess),
  };
}

export function extendAuthSession(raw, overrides = {}) {
  const rememberMe = Boolean(overrides.rememberMe ?? overrides.remember_me ?? raw?.rememberMe ?? raw?.remember_me);
  return normalizeAuthSession({
    ...raw,
    ...overrides,
    rememberMe,
    expiresAt: resolveSessionExpiry(rememberMe),
  });
}

export function toPublicSession(raw) {
  const session = normalizeAuthSession(raw);
  if (!session) return null;
  const { accessToken, ...publicSession } = session;
  return publicSession;
}

export function encodeAuthHandoff(raw) {
  const session = normalizeAuthSession(raw);
  if (!session) return "";
  return btoa(JSON.stringify(session));
}

export function decodeAuthHandoff(handoff) {
  if (!handoff) return null;
  try {
    return normalizeAuthSession(JSON.parse(atob(handoff)));
  } catch {
    return null;
  }
}

export function buildCookieNames(panel) {
  const prefix = panel === "admin" ? "vtp_admin" : "vtp_customer";
  return {
    token: `${prefix}_auth_token`,
    session: `${prefix}_auth_session`,
    loginFor: `${prefix}_login_for`,
    loginKey: `${prefix}_login_key`,
  };
}

export function encodeSessionCookie(raw) {
  const publicSession = toPublicSession(raw);
  if (!publicSession) return "";
  const cookieSession = buildSessionCookiePayload(publicSession);
  if (!cookieSession) return "";
  return Buffer.from(JSON.stringify(cookieSession)).toString("base64url");
}

export function decodeSessionCookie(value, accessToken = "") {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    return normalizeAuthSession({
      ...parsed,
      accessToken: String(accessToken || parsed?.accessToken || parsed?.access_token || ""),
    });
  } catch {
    return null;
  }
}

export function buildCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    sameSite: resolveSameSitePolicy(),
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Number(expiresAt)),
  };
}

export function buildContextCookieOptions() {
  return {
    httpOnly: true,
    sameSite: resolveSameSitePolicy(),
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + AUTH_CONTEXT_TTL_MS),
  };
}

export function buildExpiredCookieOptions() {
  return {
    httpOnly: true,
    sameSite: resolveSameSitePolicy(),
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };
}

export function toAuthContext(raw) {
  const session = normalizeAuthSession(raw);
  if (!session) return { loginFor: "", loginKey: "" };
  return {
    loginFor: String(session.loginFor || ""),
    loginKey: String(session.loginKey || ""),
    accessToken: String(session.accessToken || ""),
    distributorId: String(session.distributorId || ""),
    organizationId: String(session.organizationId || ""),
    companyId: String(session.companyId || ""),
    ownershipScopeType: String(session.ownershipScopeType || ""),
    ownershipScopeId: String(session.ownershipScopeId || ""),
  };
}

export function getAuthErrorMessage(status, fallback) {
  if (status === 401) return "Invalid credentials. Please check your login ID and password.";
  if (status === 403) return "Your account is inactive. Contact support or your administrator.";
  if (status >= 500) return "Temporary server issue. Please try again in a moment.";
  return fallback || "Unable to complete this request right now.";
}
