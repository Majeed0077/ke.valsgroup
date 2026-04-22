import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Branch } from "@/lib/models/MasterData";
import { parseMongoError } from "@/lib/masterApi";
import { authorizeRequestAccess } from "@/lib/rbac";
import {
  createMock,
  getBranchMockRows,
  shouldUseMasterMockData,
} from "@/lib/masterMockStore";

export async function GET() {
  const access = await authorizeRequestAccess("settings.branch", "view");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (shouldUseMasterMockData()) {
    return NextResponse.json(getBranchMockRows());
  }
  try {
    await dbConnect();
    const rows = await Branch.find({})
      .populate("organizationId", "name")
      .populate("companyId", "name")
      .sort({ createdAt: -1 })
      .lean();

    const data = rows.map((row) => ({
      ...row,
      organizationName: row.organizationId?.name || "",
      companyName: row.companyId?.name || "",
    }));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch branches." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await authorizeRequestAccess("settings.branch", "create");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    if (!body?.name || !body?.code || !body?.organizationId || !body?.companyId) {
      return NextResponse.json(
        { error: "name, code, organizationId and companyId are required." },
        { status: 400 }
      );
    }

    const payload = {
      name: String(body.name).trim(),
      code: String(body.code).trim(),
      organizationId: body.organizationId,
      companyId: body.companyId,
      location: String(body.location || "").trim(),
      status: body.status === "Inactive" ? "Inactive" : "Active",
    };

    if (shouldUseMasterMockData()) {
      const created = createMock("branches", payload, ["code"]);
      return NextResponse.json(created, { status: 201 });
    }

    await dbConnect();
    const created = await Branch.create(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || parseMongoError(error, "Failed to create branch.") },
      { status: 400 }
    );
  }
}
