import { getCustomerAuthContext } from "@/lib/externalMasterApi";

const EXTERNAL_BASE_URL = process.env.EXTERNAL_AUTH_API_URL || process.env.EXTERNAL_MAPVIEW_API_URL || "";
const EXTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 10000);

export const ALERT_PATHS = {
  list: process.env.EXTERNAL_ALERTS_API_PATH || "/react/alerts/",
  summary: process.env.EXTERNAL_ALERTS_SUMMARY_API_PATH || "/react/alerts/summary/stats",
  unacknowledged:
    process.env.EXTERNAL_ALERTS_UNACKNOWLEDGED_API_PATH || "/react/alerts/unacknowledged",
  acknowledge: process.env.EXTERNAL_ALERTS_ACKNOWLEDGE_API_PATH || "/react/alerts/acknowledge",
};

function getBaseUrl() {
  const baseUrl = String(EXTERNAL_BASE_URL || "").trim();
  if (!baseUrl) {
    throw new Error("External alerts API base URL is not configured.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function toErrorMessage(status, payload, fallback) {
  const detail = payload?.detail;
  const nestedPayload = payload?.payload;
  const nestedData = payload?.data;
  return (
    (typeof detail === "string" ? detail : null) ||
    detail?.message ||
    detail?.detail ||
    payload?.error ||
    payload?.message ||
    nestedPayload?.message ||
    nestedPayload?.detail ||
    nestedData?.message ||
    nestedData?.detail ||
    fallback ||
    `Alert API request failed with status ${status}.`
  );
}

export async function externalAlertFetch(path, { method = "GET", query, body } = {}) {
  const { loginFor, loginKey, accessToken } = await getCustomerAuthContext();
  const url = new URL(`${getBaseUrl()}${path}`);

  const params = {
    login_for: loginFor,
    login_key: loginKey,
    ...(query || {}),
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = { Accept: "application/json" };
  if (method !== "GET") headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Alert API request timed out.");
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
    const error = new Error(toErrorMessage(response.status, data));
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export function normalizeAlertSeverity(value) {
  const severity = String(value || "").trim().toUpperCase();
  if (!severity) return "LOW";
  if (severity === "HIGH" || severity === "MEDIUM" || severity === "LOW") return severity;

  if (
    severity === "3" ||
    severity === "HIGH ALERT" ||
    severity === "CRITICAL" ||
    severity === "SEVERE" ||
    severity === "URGENT" ||
    severity === "EMERGENCY"
  ) {
    return "HIGH";
  }

  if (
    severity === "2" ||
    severity === "MED" ||
    severity === "MODERATE" ||
    severity === "WARNING" ||
    severity === "WARN"
  ) {
    return "MEDIUM";
  }

  if (
    severity === "1" ||
    severity === "INFO" ||
    severity === "INFORMATION" ||
    severity === "NORMAL" ||
    severity === "MINOR"
  ) {
    return "LOW";
  }

  return "LOW";
}

export function normalizeAlertRow(row) {
  const rawSeverity =
    row?.severity ??
    row?.level ??
    row?.priority ??
    row?.priority_level ??
    row?.severity_level ??
    row?.alert_level ??
    row?.class ??
    row?.type ??
    row?.category;

  return {
    id: Number(row?.id || 0),
    level: normalizeAlertSeverity(rawSeverity),
    message: String(row?.message || row?.rule_name || "Alert received"),
    time: String(row?.created_at || row?.inapps_at || ""),
    vehicleName: String(row?.obj_name || row?.obj_reg_no || row?.imei || "Unknown vehicle"),
    acknowledged: Number(row?.acknowledged || 0) === 1,
    remarks: String(row?.remarks || ""),
    raw: row,
  };
}

export function normalizeAlertSummary(payload) {
  const source = payload?.data || payload?.payload || payload || {};
  const bySeverity =
    source?.by_severity ||
    source?.bySeverity ||
    source?.severity_counts ||
    source?.severityCounts ||
    {};

  const high =
    bySeverity?.HIGH ??
    bySeverity?.high ??
    source?.HIGH ??
    source?.high ??
    source?.high_severity ??
    source?.highSeverity ??
    0;

  const medium =
    bySeverity?.MEDIUM ??
    bySeverity?.medium ??
    source?.MEDIUM ??
    source?.medium ??
    source?.medium_severity ??
    source?.mediumSeverity ??
    0;

  const low =
    bySeverity?.LOW ??
    bySeverity?.low ??
    source?.LOW ??
    source?.low ??
    source?.info ??
    source?.information ??
    source?.low_severity ??
    source?.lowSeverity ??
    0;

  return {
    total: Number(source?.total_alerts || source?.total || 0),
    unacknowledged: Number(source?.unacknowledged || source?.unacknowledged_count || 0),
    acknowledgedToday: Number(source?.acknowledged_today || source?.acknowledgedToday || 0),
    high: Number(high || source?.critical || source?.urgent || 0),
    medium: Number(medium || source?.warning || source?.warn || 0),
    low: Number(low || 0),
  };
}
