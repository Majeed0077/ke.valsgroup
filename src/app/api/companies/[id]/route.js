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
    const access = await authorizeRequestAccess("settings.company", "update");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const resolvedParams = await params;
    const companyId = String(resolvedParams?.id || "").trim();
    const { loginFor, loginKey, entryUser } = await getCustomerAuthContext();

    if (!companyId) {
      return NextResponse.json({ error: "Company id is required." }, { status: 400 });
    }

    const payload = {
      action: "U",
      login_for: loginFor,
      login_key: loginKey,
      comp_id: companyId,
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

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update company." },
      { status: error.status || 400 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.company", "delete");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const resolvedParams = await params;
    const companyId = String(resolvedParams?.id || "").trim();
    const { loginFor, loginKey, entryUser } = await getCustomerAuthContext();

    if (!companyId) {
      return NextResponse.json({ error: "Company id is required." }, { status: 400 });
    }

    const data = await externalMasterFetch(EXTERNAL_MASTER_PATHS.companyUpdate, {
      method: "POST",
      body: {
        action: "D",
        login_for: loginFor,
        login_key: loginKey,
        comp_id: companyId,
        entry_user: entryUser || "SYSTEM",
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete company." },
      { status: error.status || 400 }
    );
  }
}
