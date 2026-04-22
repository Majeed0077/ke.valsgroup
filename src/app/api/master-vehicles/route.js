import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { MasterVehicle } from "@/lib/models/MasterData";
import { parseMongoError } from "@/lib/masterApi";
import { authorizeRequestAccess } from "@/lib/rbac";
import {
  createMock,
  getMasterVehicleMockRows,
  shouldUseMasterMockData,
} from "@/lib/masterMockStore";

export async function GET() {
  const access = await authorizeRequestAccess("settings.vehicle", "view");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (shouldUseMasterMockData()) {
    return NextResponse.json(getMasterVehicleMockRows());
  }
  try {
    await dbConnect();
    const rows = await MasterVehicle.find({})
      .populate("organizationId", "name")
      .populate("branchId", "name")
      .populate("vehicleGroupId", "name")
      .sort({ createdAt: -1 })
      .lean();

    const data = rows.map((row) => ({
      ...row,
      organizationName: row.organizationId?.name || "",
      branchName: row.branchId?.name || "",
      vehicleGroupName: row.vehicleGroupId?.name || "",
    }));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch vehicles." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await authorizeRequestAccess("settings.vehicle", "create");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    if (
      !body?.vehicleNo ||
      !body?.vehicleType ||
      !body?.organizationId ||
      !body?.branchId ||
      !body?.vehicleGroupId
    ) {
      return NextResponse.json(
        {
          error:
            "vehicleNo, vehicleType, organizationId, branchId and vehicleGroupId are required.",
        },
        { status: 400 }
      );
    }

    const payload = {
      vehicleNo: String(body.vehicleNo).trim(),
      vehicleType: String(body.vehicleType).trim(),
      imei: body.imei ? String(body.imei).trim() : null,
      organizationId: body.organizationId,
      branchId: body.branchId,
      vehicleGroupId: body.vehicleGroupId,
      status: body.status === "Inactive" ? "Inactive" : "Active",
    };

    if (shouldUseMasterMockData()) {
      const created = createMock("masterVehicles", payload, ["vehicleNo", "imei"]);
      return NextResponse.json(created, { status: 201 });
    }

    await dbConnect();
    const created = await MasterVehicle.create(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || parseMongoError(error, "Failed to create vehicle.") },
      { status: 400 }
    );
  }
}
