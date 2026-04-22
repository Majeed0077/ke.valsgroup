import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { MasterVehicle } from "@/lib/models/MasterData";
import { parseMongoError } from "@/lib/masterApi";
import { authorizeRequestAccess } from "@/lib/rbac";
import { removeMock, shouldUseMasterMockData, updateMock } from "@/lib/masterMockStore";

export async function PUT(request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.vehicle", "update");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const { id } = await params;
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
      const updated = updateMock("masterVehicles", id, payload, ["vehicleNo", "imei"]);
      if (!updated) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      return NextResponse.json(updated);
    }

    await dbConnect();
    const updated = await MasterVehicle.findByIdAndUpdate(
      id,
      payload,
      { new: true, runValidators: true }
    );
    if (!updated) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || parseMongoError(error, "Failed to update vehicle.") },
      { status: 400 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.vehicle", "delete");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;

    if (shouldUseMasterMockData()) {
      const deleted = removeMock("masterVehicles", id);
      if (!deleted) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    await dbConnect();
    const deleted = await MasterVehicle.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete vehicle." }, { status: 400 });
  }
}
