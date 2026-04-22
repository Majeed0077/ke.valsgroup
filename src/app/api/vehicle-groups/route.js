import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { VehicleGroup } from "@/lib/models/MasterData";
import { parseMongoError } from "@/lib/masterApi";
import { authorizeRequestAccess } from "@/lib/rbac";
import {
  createMock,
  getVehicleGroupMockRows,
  shouldUseMasterMockData,
} from "@/lib/masterMockStore";

export async function GET() {
  const access = await authorizeRequestAccess("settings.vehiclegroup", "view");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (shouldUseMasterMockData()) {
    return NextResponse.json(getVehicleGroupMockRows());
  }
  try {
    await dbConnect();
    const rows = await VehicleGroup.find({})
      .populate("organizationId", "name")
      .populate("branchId", "name")
      .sort({ createdAt: -1 })
      .lean();

    const data = rows.map((row) => ({
      ...row,
      organizationName: row.organizationId?.name || "",
      branchName: row.branchId?.name || "",
    }));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch vehicle groups." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await authorizeRequestAccess("settings.vehiclegroup", "create");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    if (!body?.name || !body?.code || !body?.organizationId || !body?.branchId) {
      return NextResponse.json(
        { error: "name, code, organizationId and branchId are required." },
        { status: 400 }
      );
    }

    const payload = {
      name: String(body.name).trim(),
      code: String(body.code).trim(),
      organizationId: body.organizationId,
      branchId: body.branchId,
      description: String(body.description || "").trim(),
      status: body.status === "Inactive" ? "Inactive" : "Active",
    };

    if (shouldUseMasterMockData()) {
      const created = createMock("vehicleGroups", payload, ["code"]);
      return NextResponse.json(created, { status: 201 });
    }

    await dbConnect();
    const created = await VehicleGroup.create(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || parseMongoError(error, "Failed to create vehicle group.") },
      { status: 400 }
    );
  }
}
