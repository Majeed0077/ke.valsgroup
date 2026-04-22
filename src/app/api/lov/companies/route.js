import { NextResponse } from "next/server";
import {
  EXTERNAL_MASTER_PATHS,
  externalMasterFetch,
  getCustomerAuthContext,
  normalizeCompanyRow,
} from "@/lib/externalMasterApi";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = String(searchParams.get("org_id") || "").trim();
    const { loginFor, loginKey } = await getCustomerAuthContext();

    const [lovRows, gridRows] = await Promise.allSettled([
      externalMasterFetch(EXTERNAL_MASTER_PATHS.companyLov, {
        query: {
          login_for: loginFor,
          login_key: loginKey,
          org_id: orgId || undefined,
        },
      }),
      externalMasterFetch(EXTERNAL_MASTER_PATHS.companyGrid, {
        query: {
          login_for: loginFor,
          login_key: loginKey,
        },
      }),
    ]);

    const lovSource = lovRows.status === "fulfilled" && Array.isArray(lovRows.value) ? lovRows.value : [];
    const gridSource = gridRows.status === "fulfilled" && Array.isArray(gridRows.value) ? gridRows.value : [];

    const normalizedLov = lovSource
      .map(normalizeCompanyRow)
      .filter((row) => String(row._id || "").trim() && String(row.name || "").trim());
    const normalizedGrid = gridSource
      .map(normalizeCompanyRow)
      .filter((row) => String(row._id || "").trim() && String(row.name || "").trim());
    const normalized = (normalizedLov.length ? normalizedLov : normalizedGrid)
      .filter((row) => !orgId || String(row.organizationId) === orgId);

    return NextResponse.json(
      normalized.map((row) => ({
        _id: row._id,
        id: row._id,
        name: row.name,
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        status: row.status,
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch company options." },
      { status: error.status || 500 }
    );
  }
}
