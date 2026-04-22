import { NextResponse } from "next/server";
import {
  EXTERNAL_MASTER_PATHS,
  externalMasterFetch,
  getCustomerAuthContext,
  normalizeCompanyRow,
  normalizeOrganizationRow,
} from "@/lib/externalMasterApi";

export const runtime = "nodejs";

async function getOrganizationMap() {
  const { loginFor, loginKey } = await getCustomerAuthContext();
  const rows = await externalMasterFetch(EXTERNAL_MASTER_PATHS.organizationGrid, {
    query: {
      login_for: loginFor,
      login_key: loginKey,
    },
  });

  const normalizedRows = Array.isArray(rows) ? rows.map(normalizeOrganizationRow) : [];
  return new Map(normalizedRows.map((row) => [String(row._id), row.name]));
}

function rankCompanyRows(rows) {
  return [...rows].sort((left, right) => {
    const leftActive = left.status === "Active" ? 1 : 0;
    const rightActive = right.status === "Active" ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;

    const leftUpdated = Date.parse(String(left.updatedAt || ""));
    const rightUpdated = Date.parse(String(right.updatedAt || ""));
    const leftTimestamp = Number.isFinite(leftUpdated) ? leftUpdated : 0;
    const rightTimestamp = Number.isFinite(rightUpdated) ? rightUpdated : 0;
    return rightTimestamp - leftTimestamp;
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = String(searchParams.get("organizationId") || searchParams.get("org_id") || "").trim();

    if (!organizationId) {
      return NextResponse.json({ error: "Organization id is required." }, { status: 400 });
    }

    const { loginFor, loginKey } = await getCustomerAuthContext();
    const [data, organizationMap] = await Promise.all([
      externalMasterFetch(EXTERNAL_MASTER_PATHS.companyGrid, {
        query: {
          login_for: loginFor,
          login_key: loginKey,
        },
      }),
      getOrganizationMap(),
    ]);

    const normalized = Array.isArray(data) ? data.map(normalizeCompanyRow) : [];
    const matches = rankCompanyRows(
      normalized
        .filter((row) => String(row.organizationId) === organizationId)
        .map((row) => ({
          ...row,
          organizationName: row.organizationName || organizationMap.get(String(row.organizationId)) || "",
        }))
    );

    if (!matches.length) {
      return NextResponse.json({ error: "No company found for the selected organization." }, { status: 404 });
    }

    return NextResponse.json(matches[0]);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load company auto-fill data." },
      { status: error.status || 500 }
    );
  }
}
