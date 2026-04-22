import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { MasterVehicle, VehicleGroup } from "@/lib/models/MasterData";
import { parseMongoError } from "@/lib/masterApi";
import { authorizeRequestAccess } from "@/lib/rbac";
import {
  getVehicleGroupDependencySummaryMock,
  removeMock,
  shouldUseMasterMockData,
  updateMock,
} from "@/lib/masterMockStore";

export async function PUT(request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.vehiclegroup", "update");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const { id } = await params;

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
      const updated = updateMock("vehicleGroups", id, payload, ["code"]);
      if (!updated) return NextResponse.json({ error: "VehicleGroup not found." }, { status: 404 });
      return NextResponse.json(updated);
    }

    await dbConnect();
    const updated = await VehicleGroup.findByIdAndUpdate(
      id,
      payload,
      { new: true, runValidators: true }
    );
    if (!updated) return NextResponse.json({ error: "VehicleGroup not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || parseMongoError(error, "Failed to update vehicle group.") },
      { status: 400 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.vehiclegroup", "delete");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;

    if (shouldUseMasterMockData()) {
      const { vehicleCount } = getVehicleGroupDependencySummaryMock(id);
      if (vehicleCount) {
        return NextResponse.json(
          {
            error: "Cannot delete vehicle group. Remove related vehicles first.",
          },
          { status: 409 }
        );
      }
      const deleted = removeMock("vehicleGroups", id);
      if (!deleted) return NextResponse.json({ error: "VehicleGroup not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    await dbConnect();
    const vehicleCount = await MasterVehicle.countDocuments({ vehicleGroupId: id });
    if (vehicleCount) {
      return NextResponse.json(
        {
          error: "Cannot delete vehicle group. Remove related vehicles first.",
        },
        { status: 409 }
      );
    }
    const deleted = await VehicleGroup.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "VehicleGroup not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete vehicle group." }, { status: 400 });
  }
}
