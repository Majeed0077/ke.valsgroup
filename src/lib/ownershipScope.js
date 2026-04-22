import crypto from "crypto";
import {
  EXTERNAL_MASTER_PATHS,
  externalMasterFetchWithAuthContext,
  normalizeCompanyRow,
  normalizeOrganizationRow,
} from "@/lib/externalMasterApi";

const OWNERSHIP_SCOPE_CACHE_TTL_MS = Math.max(
  60000,
  Number(process.env.OWNERSHIP_SCOPE_CACHE_TTL_MS || 10 * 60 * 1000)
);

const globalForOwnershipScope = globalThis;
if (!globalForOwnershipScope.__vtpOwnershipScopeCache) {
  globalForOwnershipScope.__vtpOwnershipScopeCache = new Map();
}

function getOwnershipCache() {
  return globalForOwnershipScope.__vtpOwnershipScopeCache;
}

function hashScopeValues(values) {
  return crypto.createHash("sha256").update(values.join("|")).digest("hex");
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function buildLoginCacheKey(authContext) {
  return `${String(authContext?.loginFor || "").toUpperCase()}:${String(authContext?.loginKey || "")}`;
}

function resolveDirectScope(authContext) {
  const scopeType = String(authContext?.ownershipScopeType || "").trim();
  const scopeId = String(authContext?.ownershipScopeId || "").trim();

  if (scopeType && scopeId) {
    return {
      ownershipScopeType: scopeType,
      ownershipScopeId: scopeId,
      distributorId: String(authContext?.distributorId || "").trim(),
      organizationId: String(authContext?.organizationId || "").trim(),
      companyId: String(authContext?.companyId || "").trim(),
    };
  }

  return null;
}

function buildResolvedScope({
  ownershipScopeType,
  ownershipScopeId,
  distributorId = "",
  organizationId = "",
  companyId = "",
}) {
  return {
    ownershipScopeType,
    ownershipScopeId,
    distributorId: String(distributorId || "").trim(),
    organizationId: String(organizationId || "").trim(),
    companyId: String(companyId || "").trim(),
  };
}

function resolveScopeFromRows(authContext, organizations, companies) {
  const distributorIds = uniqueStrings(organizations.map((row) => row.distributorId));
  const organizationIds = uniqueStrings([
    ...organizations.map((row) => row.id),
    ...companies.map((row) => row.organizationId),
  ]);
  const companyIds = uniqueStrings(companies.map((row) => row.id));

  if (distributorIds.length === 1) {
    return buildResolvedScope({
      ownershipScopeType: "distributor",
      ownershipScopeId: distributorIds[0],
      distributorId: distributorIds[0],
      organizationId: organizationIds[0] || "",
      companyId: companyIds[0] || "",
    });
  }

  if (companyIds.length === 1) {
    return buildResolvedScope({
      ownershipScopeType: "company",
      ownershipScopeId: companyIds[0],
      distributorId: distributorIds[0] || "",
      organizationId: organizationIds[0] || "",
      companyId: companyIds[0],
    });
  }

  if (organizationIds.length === 1) {
    return buildResolvedScope({
      ownershipScopeType: "organization",
      ownershipScopeId: organizationIds[0],
      distributorId: distributorIds[0] || "",
      organizationId: organizationIds[0],
      companyId: companyIds[0] || "",
    });
  }

  if (distributorIds.length > 1) {
    return buildResolvedScope({
      ownershipScopeType: "distributor-set",
      ownershipScopeId: hashScopeValues(distributorIds),
      distributorId: distributorIds[0] || "",
      organizationId: organizationIds[0] || "",
      companyId: companyIds[0] || "",
    });
  }

  if (companyIds.length > 1) {
    return buildResolvedScope({
      ownershipScopeType: "company-set",
      ownershipScopeId: hashScopeValues(companyIds),
      distributorId: distributorIds[0] || "",
      organizationId: organizationIds[0] || "",
      companyId: companyIds[0] || "",
    });
  }

  if (organizationIds.length > 1) {
    return buildResolvedScope({
      ownershipScopeType: "organization-set",
      ownershipScopeId: hashScopeValues(organizationIds),
      distributorId: distributorIds[0] || "",
      organizationId: organizationIds[0] || "",
      companyId: companyIds[0] || "",
    });
  }

  return buildResolvedScope({
    ownershipScopeType: "login",
    ownershipScopeId: buildLoginCacheKey(authContext),
  });
}

async function resolveScopeFromExternal(authContext) {
  const query = {
    login_for: authContext.loginFor,
    login_key: authContext.loginKey,
  };

  const [organizationsResult, companiesResult] = await Promise.allSettled([
    externalMasterFetchWithAuthContext(authContext, EXTERNAL_MASTER_PATHS.organizationGrid, { query }),
    externalMasterFetchWithAuthContext(authContext, EXTERNAL_MASTER_PATHS.companyGrid, { query }),
  ]);

  const organizations =
    organizationsResult.status === "fulfilled" && Array.isArray(organizationsResult.value)
      ? organizationsResult.value.map(normalizeOrganizationRow)
      : [];
  const companies =
    companiesResult.status === "fulfilled" && Array.isArray(companiesResult.value)
      ? companiesResult.value.map(normalizeCompanyRow)
      : [];

  return resolveScopeFromRows(authContext, organizations, companies);
}

export async function resolveOwnershipScope(authContext) {
  const directScope = resolveDirectScope(authContext);
  if (directScope) return directScope;

  const cacheKey = buildLoginCacheKey(authContext);
  const cache = getOwnershipCache();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.resolvedAt < OWNERSHIP_SCOPE_CACHE_TTL_MS) {
    return cached.value;
  }

  const value = await resolveScopeFromExternal(authContext);
  cache.set(cacheKey, {
    value,
    resolvedAt: Date.now(),
  });
  return value;
}
