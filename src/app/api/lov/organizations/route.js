import { NextResponse } from "next/server";
import {
  EXTERNAL_MASTER_PATHS,
  externalMasterFetch,
  getCustomerAuthContext,
  normalizeOrganizationRow,
} from "@/lib/externalMasterApi";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { loginFor, loginKey } = await getCustomerAuthContext();
    const [lovRows, gridRows] = await Promise.allSettled([
      externalMasterFetch(EXTERNAL_MASTER_PATHS.organizationLov, {
        query: {
          login_for: loginFor,
          login_key: loginKey,
        },
      }),
      externalMasterFetch(EXTERNAL_MASTER_PATHS.organizationGrid, {
        query: {
          login_for: loginFor,
          login_key: loginKey,
        },
      }),
    ]);

    const lovSource = lovRows.status === "fulfilled" && Array.isArray(lovRows.value) ? lovRows.value : [];
    const gridSource = gridRows.status === "fulfilled" && Array.isArray(gridRows.value) ? gridRows.value : [];

    const normalizedLov = lovSource
      .map(normalizeOrganizationRow)
      .filter((row) => String(row._id || "").trim() && String(row.name || "").trim());
    const normalizedGrid = gridSource
      .map(normalizeOrganizationRow)
      .filter((row) => String(row._id || "").trim() && String(row.name || "").trim());
    const normalized = normalizedLov.length ? normalizedLov : normalizedGrid;

    return NextResponse.json(
      normalized.map((row) => ({
        _id: row._id,
        id: row._id,
        name: row.name,
        email: row.email,
        mobile: row.mobile,
        status: row.status,
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch organization options." },
      { status: error.status || 500 }
    );
  }
}
