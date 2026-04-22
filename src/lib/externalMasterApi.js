import { cookies } from "next/headers";
import { buildCookieNames, decodeSessionCookie } from "@/lib/authCore";

const EXTERNAL_BASE_URL = process.env.EXTERNAL_AUTH_API_URL || process.env.EXTERNAL_MAPVIEW_API_URL || "";
const EXTERNAL_REQUEST_TIMEOUT_MS = Number(process.env.EXTERNAL_REQUEST_TIMEOUT_MS || 10000);
export const EXTERNAL_MASTER_PATHS = {
  organizationGrid: process.env.EXTERNAL_ORGANIZATION_GRID_API_PATH || "/react/org-grid",
  organizationLov: process.env.EXTERNAL_ORGANIZATION_LOV_API_PATH || "/react/org-lov",
  organizationUpdate: process.env.EXTERNAL_ORGANIZATION_UPDATE_API_PATH || "/react/org-update",
  companyGrid: process.env.EXTERNAL_COMPANY_GRID_API_PATH || "/react/comp-grid",
  companyLov: process.env.EXTERNAL_COMPANY_LOV_API_PATH || "/react/comp-lov",
  companyUpdate: process.env.EXTERNAL_COMPANY_UPDATE_API_PATH || "/react/comp-update",
};

function getBaseUrl() {
  const baseUrl = String(EXTERNAL_BASE_URL || "").trim();
  if (!baseUrl) {
    throw new Error("External API base URL is not configured.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function appendQueryParams(url, query = {}) {
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
}

export async function getCustomerAuthContext() {
  const cookieStore = await cookies();
  const names = buildCookieNames("customer");
  const session = decodeSessionCookie(
    cookieStore.get(names.session)?.value,
    cookieStore.get(names.token)?.value
  );
  const loginFor = String(cookieStore.get(names.loginFor)?.value || session?.loginFor || "").toUpperCase();
  const loginKey = String(cookieStore.get(names.loginKey)?.value || session?.loginKey || "");
  const tokenExpiresAt = Number(session?.tokenExpiresAt || 0);
  const accessToken =
    Number.isFinite(tokenExpiresAt) && tokenExpiresAt > 0 && tokenExpiresAt <= Date.now()
      ? ""
      : String(session?.accessToken || "");
  const entryUser = String(session?.userId || session?.username || "");
  const externalUserId = String(session?.externalUserId || session?.userId || "");
  const username = String(session?.username || "");
  const distributorId = String(session?.distributorId || "");
  const organizationId = String(session?.organizationId || "");
  const companyId = String(session?.companyId || "");
  const ownershipScopeType = String(session?.ownershipScopeType || "");
  const ownershipScopeId = String(session?.ownershipScopeId || "");

  if (!loginFor || !loginKey) {
    throw new Error("Missing login context. Please sign in again.");
  }

  return {
    loginFor,
    loginKey,
    accessToken,
    entryUser,
    externalUserId,
    username,
    distributorId,
    organizationId,
    companyId,
    ownershipScopeType,
    ownershipScopeId,
  };
}

export async function externalMasterFetchWithAuthContext(
  authContext,
  path,
  { method = "GET", query, body } = {}
) {
  const accessToken = String(authContext?.accessToken || "");
  const url = new URL(`${getBaseUrl()}${path}`);

  appendQueryParams(url, query);

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
      const timeoutError = new Error("External API request timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail || data?.error || data?.message || `External API request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export async function externalMasterFetch(path, { method = "GET", query, body } = {}) {
  const authContext = await getCustomerAuthContext();
  return externalMasterFetchWithAuthContext(authContext, path, { method, query, body });
}

export function normalizeExternalStatus(value) {
  const status = String(value || "").toUpperCase();
  if (status === "Y" || status === "ACTIVE") return "Active";
  if (status === "N" || status === "INACTIVE") return "Inactive";
  if (status === "D" || status === "DELETED") return "Deleted";
  return status || "Active";
}

export function denormalizeStatus(value) {
  const status = String(value || "").toLowerCase();
  if (status === "inactive" || status === "n") return "N";
  if (status === "deleted" || status === "d") return "D";
  return "Y";
}

function readExternalValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

export function normalizeOrganizationRow(row) {
  return {
    _id: String(readExternalValue(row, ["org_id", "id", "_id", "organizationId"])),
    id: String(readExternalValue(row, ["org_id", "id", "_id", "organizationId"])),
    name: String(readExternalValue(row, ["org_name", "name", "organizationName"])),
    email: String(readExternalValue(row, ["org_email", "email"])),
    mobile: String(readExternalValue(row, ["mobile", "phone"])),
    code: String(readExternalValue(row, ["org_code", "code"])),
    status: normalizeExternalStatus(row?.status),
    distributorId: String(readExternalValue(row, ["distributiors_id", "distributorId"])),
    updatedAt: String(readExternalValue(row, ["updated_at", "updatedAt"])),
    updatedBy: String(readExternalValue(row, ["updated_by", "updatedBy"])),
  };
}

export function normalizeCompanyRow(row) {
  return {
    _id: String(readExternalValue(row, ["comp_id", "id", "_id", "companyId"])),
    id: String(readExternalValue(row, ["comp_id", "id", "_id", "companyId"])),
    name: String(readExternalValue(row, ["comp_name", "name", "companyName"])),
    email: String(readExternalValue(row, ["comp_email", "email"])),
    mobile: String(readExternalValue(row, ["mobile"])),
    phone: String(readExternalValue(row, ["phone"])),
    url: String(readExternalValue(row, ["url"])),
    code: String(readExternalValue(row, ["comp_code", "code"])),
    organizationId: String(readExternalValue(row, ["org_id", "organizationId"])),
    organizationName: String(readExternalValue(row, ["org_name", "organizationName"])),
    idType: String(readExternalValue(row, ["id_type", "idType"])),
    idValue: String(readExternalValue(row, ["id_value", "idValue"])),
    status: normalizeExternalStatus(row?.status),
    updatedAt: String(readExternalValue(row, ["updated_at", "updatedAt"])),
    updatedBy: String(readExternalValue(row, ["updated_by", "updatedBy"])),
  };
}
