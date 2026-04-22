"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRbacAccessRequest } from "@/lib/authClient";
import { getAllowedActions, hasAssignedRoles, hasMenuAction } from "@/lib/rbacAccess";

const EMPTY_RBAC_SESSION = {
  isLoggedIn: false,
  externalUserId: "",
  assignedRoleKeys: [],
  assignedRoles: [],
  rightsCatalog: [],
  menuAccess: [],
  rbacError: "",
};

const RBAC_CACHE_TTL_MS = 1000 * 60 * 5;
const RBAC_CACHE_STORAGE_KEY = "vtp_rbac_session_cache_v1";

let cachedSession = null;
let cachedError = "";
let inflightPromise = null;

function readStoredRbacSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RBAC_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const storedAt = Number(parsed?.cachedAt || 0);
    if (!storedAt || Date.now() - storedAt > RBAC_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(RBAC_CACHE_STORAGE_KEY);
      return null;
    }
    return {
      session: parsed?.session || EMPTY_RBAC_SESSION,
      error: String(parsed?.error || ""),
    };
  } catch {
    return null;
  }
}

function persistRbacSession(session, error = "") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      RBAC_CACHE_STORAGE_KEY,
      JSON.stringify({
        session: session || EMPTY_RBAC_SESSION,
        error: String(error || ""),
        cachedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage failures
  }
}

async function loadRbacSession() {
  if (cachedSession?.isLoggedIn && !cachedError) {
    return { session: cachedSession, error: cachedError };
  }

  const stored = readStoredRbacSession();
  if (stored?.session) {
    cachedSession = {
      ...EMPTY_RBAC_SESSION,
      ...stored.session,
    };
    cachedError = stored.error || "";
    return { session: cachedSession, error: cachedError };
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = fetchRbacAccessRequest()
    .then((data) => {
      cachedSession = {
        ...EMPTY_RBAC_SESSION,
        ...data,
        assignedRoleKeys: Array.isArray(data?.assignedRoleKeys) ? data.assignedRoleKeys : [],
        assignedRoles: Array.isArray(data?.assignedRoles) ? data.assignedRoles : [],
        rightsCatalog: Array.isArray(data?.rightsCatalog) ? data.rightsCatalog : [],
        menuAccess: Array.isArray(data?.menuAccess) ? data.menuAccess : [],
      };
      cachedError = String(data?.rbacError || "");
      persistRbacSession(cachedSession, cachedError);
      return { session: cachedSession, error: cachedError };
    })
    .catch((error) => {
      if (Number(error?.status || 0) === 401) {
        cachedSession = { ...EMPTY_RBAC_SESSION };
        cachedError = "";
        persistRbacSession(cachedSession, cachedError);
        return { session: cachedSession, error: cachedError };
      }

      cachedSession = { ...EMPTY_RBAC_SESSION, rbacError: String(error?.message || "") };
      cachedError = String(error?.message || "Unable to resolve access rights.");
      persistRbacSession(cachedSession, cachedError);
      return { session: cachedSession, error: cachedError };
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function invalidateRbacSessionCache() {
  cachedSession = null;
  cachedError = "";
  inflightPromise = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(RBAC_CACHE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }
}

export function useRbacSession() {
  const [session, setSession] = useState(cachedSession || EMPTY_RBAC_SESSION);
  const [ready, setReady] = useState(Boolean(cachedSession));
  const [error, setError] = useState(cachedError);

  useEffect(() => {
    let cancelled = false;

    loadRbacSession().then((resolved) => {
      if (cancelled) return;
      setSession(resolved.session || EMPTY_RBAC_SESSION);
      setError(resolved.error || "");
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    session,
    ready,
    error,
    hasAssignedRoles: hasAssignedRoles(session),
  };
}

export function useMenuAccess(menuKey, options = {}) {
  const { session, ready, error, hasAssignedRoles: userHasAssignedRoles } = useRbacSession();
  const allowClientManagementPreview = Boolean(options.allowClientManagementPreview);

  const allowedActions = useMemo(
    () => (menuKey ? getAllowedActions(session, menuKey, { allowClientManagementPreview }) : {}),
    [allowClientManagementPreview, menuKey, session]
  );

  return {
    session,
    ready,
    error,
    hasAssignedRoles: userHasAssignedRoles,
    allowedActions,
    canView: menuKey ? hasMenuAction(session, menuKey, "view", { allowClientManagementPreview, allowParentView: true }) : true,
    canCreate: menuKey ? hasMenuAction(session, menuKey, "create", { allowClientManagementPreview }) : true,
    canUpdate: menuKey ? hasMenuAction(session, menuKey, "update", { allowClientManagementPreview }) : true,
    canDelete: menuKey ? hasMenuAction(session, menuKey, "delete", { allowClientManagementPreview }) : true,
    canExportExcel: menuKey ? hasMenuAction(session, menuKey, "export_excel", { allowClientManagementPreview }) : true,
    canExportWord: menuKey ? hasMenuAction(session, menuKey, "export_word", { allowClientManagementPreview }) : true,
  };
}
