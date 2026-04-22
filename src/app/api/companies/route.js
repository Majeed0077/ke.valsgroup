import { NextResponse } from "next/server";
import {
  denormalizeStatus,
  EXTERNAL_MASTER_PATHS,
  externalMasterFetch,
  getCustomerAuthContext,
  normalizeCompanyRow,
  normalizeOrganizationRow,
} from "@/lib/externalMasterApi";
import { authorizeRequestAccess } from "@/lib/rbac";

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

export async function GET() {
  try {
    const access = await authorizeRequestAccess("settings.company", "view");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
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
    const withOrgName = normalized.map((row) => ({
      ...row,
      organizationName: row.organizationName || organizationMap.get(String(row.organizationId)) || "",
    }));

    return NextResponse.json(withOrgName);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to fetch companies." }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const access = await authorizeRequestAccess("settings.company", "create");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const { loginFor, loginKey, entryUser } = await getCustomerAuthContext();

    const payload = {
      action: "I",
      login_for: loginFor,
      login_key: loginKey,
      org_id: String(body?.organizationId || "").trim() || null,
      comp_name: String(body?.name || "").trim(),
      comp_email: String(body?.email || "").trim() || null,
      mobile: String(body?.mobile || "").trim() || null,
      phone: String(body?.phone || "").trim() || null,
      url: String(body?.url || "").trim() || null,
      id_type: String(body?.idType || "").trim() || null,
      id_value: String(body?.idValue || "").trim() || null,
      status: denormalizeStatus(body?.status),
      entry_user: entryUser || "SYSTEM",
    };

    if (!payload.comp_name) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    const data = await externalMasterFetch(EXTERNAL_MASTER_PATHS.companyUpdate, {
      method: "POST",
      body: payload,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to create company." },
      { status: error.status || 400 }
    );
  }
}
