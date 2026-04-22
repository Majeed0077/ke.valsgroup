import { cookies } from "next/headers";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";
import { getAllowedActions, hasMenuAction } from "@/lib/rbacAccess";

const COOKIE_NAMES = buildCookieNames("customer");

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

export function buildSessionIdentity(raw) {
  if (!raw || typeof raw !== "object") {
    return { externalUserId: "", username: "", email: "" };
  }

  return {
    externalUserId: String(raw.externalUserId || raw.userId || raw.userid || "").trim(),
    username: String(raw.username || raw.name || "").trim(),
    email: String(raw.email || "").trim().toLowerCase(),
  };
}

export async function resolveAccessForIdentity(rawIdentity) {
  const identity = buildSessionIdentity(rawIdentity);
  return {
    identity,
    assignedRoleKeys: [],
    assignedRoles: [],
    rightsCatalog: [],
    menuAccess: [],
  };
}

export async function enrichSessionWithRbac(rawSession) {
  if (!rawSession || typeof rawSession !== "object") return rawSession;

  try {
    const resolved = await resolveAccessForIdentity(rawSession);
    return {
      ...rawSession,
      externalUserId: resolved.identity.externalUserId || String(rawSession.externalUserId || rawSession.userId || ""),
      assignedRoleKeys: resolved.assignedRoleKeys,
      assignedRoles: resolved.assignedRoles,
      rightsCatalog: resolved.rightsCatalog,
      menuAccess: resolved.menuAccess,
    };
  } catch (error) {
    return {
      ...rawSession,
      externalUserId: String(rawSession.externalUserId || rawSession.userId || ""),
      assignedRoleKeys: uniqueStrings(rawSession.assignedRoleKeys),
      assignedRoles: Array.isArray(rawSession.assignedRoles) ? rawSession.assignedRoles : [],
      rightsCatalog: Array.isArray(rawSession.rightsCatalog) ? rawSession.rightsCatalog : [],
      menuAccess: Array.isArray(rawSession.menuAccess) ? rawSession.menuAccess : [],
      rbacError: error?.message || "Unable to resolve RBAC access.",
    };
  }
}

export function canAccessMenu(session, menuKey, action = "view") {
  return hasMenuAction(session, menuKey, action);
}

export async function getResolvedSessionFromRequest() {
  const cookieStore = await cookies();
  const rawSession = decodeSessionCookie(
    cookieStore.get(COOKIE_NAMES.session)?.value,
    cookieStore.get(COOKIE_NAMES.token)?.value
  );
  if (!rawSession) return null;

  const resolved = await resolveAccessForIdentity({
    externalUserId: rawSession.externalUserId || rawSession.userId || "",
    username: rawSession.username || "",
    email: rawSession.email || "",
  });

  return {
    ...rawSession,
    externalUserId: resolved.identity.externalUserId || String(rawSession.externalUserId || rawSession.userId || ""),
    assignedRoleKeys: resolved.assignedRoleKeys,
    assignedRoles: resolved.assignedRoles,
    rightsCatalog: resolved.rightsCatalog,
    menuAccess: resolved.menuAccess,
  };
}

export async function authorizeRequestAccess(menuKey, action = "view", options = {}) {
  try {
    const session = await getResolvedSessionFromRequest();
    if (!session) {
      return {
        ok: false,
        status: 401,
        error: "Authentication required.",
        session: null,
        allowedActions: {},
      };
    }

    if (String(menuKey || "").trim().startsWith("client-management.")) {
      return {
        ok: false,
        status: 410,
        error: "Client management is disabled in the customer panel.",
        session,
        allowedActions: {},
      };
    }

    if (!hasMenuAction(session, menuKey, action, options)) {
      return {
        ok: false,
        status: 403,
        error: `You do not have ${action} access for ${menuKey}.`,
        session,
        allowedActions: getAllowedActions(session, menuKey, options),
      };
    }

    return {
      ok: true,
      status: 200,
      error: "",
      session,
      allowedActions: getAllowedActions(session, menuKey, options),
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error?.message || "Unable to resolve access rights.",
      session: null,
      allowedActions: {},
    };
  }
}
