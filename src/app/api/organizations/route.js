import { NextResponse } from "next/server";
import {
  denormalizeStatus,
  EXTERNAL_MASTER_PATHS,
  externalMasterFetch,
  getCustomerAuthContext,
  normalizeOrganizationRow,
} from "@/lib/externalMasterApi";
import { authorizeRequestAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await authorizeRequestAccess("settings.organization", "view");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { loginFor, loginKey } = await getCustomerAuthContext();
    const data = await externalMasterFetch(EXTERNAL_MASTER_PATHS.organizationGrid, {
      query: {
        login_for: loginFor,
        login_key: loginKey,
      },
    });

    return NextResponse.json(Array.isArray(data) ? data.map(normalizeOrganizationRow) : []);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to fetch organizations." }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const access = await authorizeRequestAccess("settings.organization", "create");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const { loginFor, loginKey, entryUser } = await getCustomerAuthContext();

    const payload = {
      action: "I",
      login_for: loginFor,
      login_key: loginKey,
      org_name: String(body?.name || "").trim(),
      org_email: String(body?.email || "").trim() || null,
      mobile: String(body?.mobile || "").trim() || null,
      status: denormalizeStatus(body?.status),
      entry_user: entryUser || "SYSTEM",
    };

    if (!payload.org_name) {
      return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    }

    const data = await externalMasterFetch(EXTERNAL_MASTER_PATHS.organizationUpdate, {
      method: "POST",
      body: payload,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to create organization." },
      { status: error.status || 400 }
    );
  }
}
