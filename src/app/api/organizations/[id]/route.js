import { NextResponse } from "next/server";
import {
  denormalizeStatus,
  EXTERNAL_MASTER_PATHS,
  externalMasterFetch,
  getCustomerAuthContext,
} from "@/lib/externalMasterApi";
import { authorizeRequestAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function PUT(request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.organization", "update");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const resolvedParams = await params;
    const orgId = String(resolvedParams?.id || "").trim();
    const { loginFor, loginKey, entryUser } = await getCustomerAuthContext();

    if (!orgId) {
      return NextResponse.json({ error: "Organization id is required." }, { status: 400 });
    }

    const payload = {
      action: "U",
      login_for: loginFor,
      login_key: loginKey,
      org_id: orgId,
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

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update organization." },
      { status: error.status || 400 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.organization", "delete");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const resolvedParams = await params;
    const orgId = String(resolvedParams?.id || "").trim();
    const { loginFor, loginKey, entryUser } = await getCustomerAuthContext();

    if (!orgId) {
      return NextResponse.json({ error: "Organization id is required." }, { status: 400 });
    }

    const data = await externalMasterFetch(EXTERNAL_MASTER_PATHS.organizationUpdate, {
      method: "POST",
      body: {
        action: "D",
        login_for: loginFor,
        login_key: loginKey,
        org_id: orgId,
        entry_user: entryUser || "SYSTEM",
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete organization." },
      { status: error.status || 400 }
    );
  }
}
