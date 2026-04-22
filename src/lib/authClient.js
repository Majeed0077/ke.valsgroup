"use client";

import {
  decodeAuthHandoff as decodeSharedAuthHandoff,
  encodeAuthHandoff as encodeSharedAuthHandoff,
  getAuthErrorMessage,
  normalizeAuthSession,
} from "@/lib/authCore";
import { clearAuthSessionCache, setCachedAuthSession } from "@/lib/authSessionCache";

export const RECENT_LOGIN_ID_KEY = "vtp_recent_login_id_v1";

const DEFAULT_PANEL_URL = "https://valsgroupadmininstration.vercel.app";
const REQUEST_TIMEOUT_MS = 15000;
const LOGIN_REQUEST_TIMEOUT_MS = 0;
const SESSION_REQUEST_TIMEOUT_MS = 0;
const LOGOUT_REQUEST_TIMEOUT_MS = 4000;

export function getAdminPanelUrl() {
  const configured = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL || "";
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:3001";
  }
  return DEFAULT_PANEL_URL;
}

async function apiRequest(path, payload, { method = "POST", timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const shouldTimeout = Number.isFinite(timeoutMs) && Number(timeoutMs) > 0;
  const timeout = shouldTimeout ? window.setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(path, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      credentials: "same-origin",
      signal: controller.signal,
      cache: "no-store",
    });

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = rawText ? { message: rawText } : {};
    }

    if (!response.ok) {
      const error = new Error(
        getAuthErrorMessage(
          response.status,
          data?.detail || data?.message || data?.error || `Request failed with status ${response.status}.`
        )
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    if (error instanceof TypeError) {
      throw new Error("Network error. Please check your connection and try again.");
    }
    throw error;
  } finally {
    if (timeout) {
      window.clearTimeout(timeout);
    }
  }
}

export function buildSessionFromAuthResponse(payload, options = {}) {
  return normalizeAuthSession({
    ...payload,
    ...options,
  });
}

export function encodeAuthHandoff(session) {
  return encodeSharedAuthHandoff(session);
}

export function decodeAuthHandoff(handoff) {
  return decodeSharedAuthHandoff(handoff);
}

export { getAuthErrorMessage };

export function loginRequest(payload) {
  clearAuthSessionCache();
  return apiRequest("/api/auth/login", payload, { timeoutMs: LOGIN_REQUEST_TIMEOUT_MS }).then((data) => {
    setCachedAuthSession(data);
    return data;
  });
}

export function forgotPasswordRequest(payload) {
  return apiRequest("/api/auth/forgot-password", payload);
}

export function resetPasswordRequest(payload) {
  return apiRequest("/api/auth/reset-password", payload);
}

export function fetchSessionRequest() {
  return apiRequest("/api/auth/session", undefined, {
    method: "GET",
    timeoutMs: SESSION_REQUEST_TIMEOUT_MS,
  }).then((data) => {
    setCachedAuthSession(data);
    return data;
  });
}

export function fetchRbacAccessRequest() {
  return apiRequest("/api/rbac/session", undefined, { method: "GET" });
}

export function importSessionRequest(payload) {
  clearAuthSessionCache();
  return apiRequest("/api/auth/session", payload, {
    timeoutMs: SESSION_REQUEST_TIMEOUT_MS,
  }).then((data) => {
    setCachedAuthSession(data);
    return data;
  });
}

export function logoutRequest() {
  clearAuthSessionCache();
  return apiRequest("/api/auth/logout", {}, { timeoutMs: LOGOUT_REQUEST_TIMEOUT_MS });
}

export function buildLogoutUrl(redirectTo = "/login") {
  const next = String(redirectTo || "/login").trim();
  const safeTarget = next.startsWith("/") && !next.startsWith("//") ? next : "/login";
  return `/api/auth/logout?redirect=${encodeURIComponent(safeTarget)}`;
}

export function redirectToLogout(redirectTo = "/login") {
  clearAuthSessionCache();
  if (typeof window !== "undefined") {
    const safeTarget = String(redirectTo || "/login").trim();
    const redirectPath = safeTarget.startsWith("/") && !safeTarget.startsWith("//") ? safeTarget : "/login";

    // Fire-and-forget logout so UI does not wait on a full redirect cycle.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LOGOUT_REQUEST_TIMEOUT_MS);

    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      signal: controller.signal,
    })
      .catch(() => {
        // Ignore network failures; local cache is already cleared.
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    window.location.replace(redirectPath);
    return;
  }
  return logoutRequest();
}
