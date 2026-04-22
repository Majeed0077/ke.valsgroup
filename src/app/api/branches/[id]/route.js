import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Branch, MasterVehicle, VehicleGroup } from "@/lib/models/MasterData";
import { parseMongoError } from "@/lib/masterApi";
import { authorizeRequestAccess } from "@/lib/rbac";
import {
  getBranchDependencySummaryMock,
  removeMock,
  shouldUseMasterMockData,
  updateMock,
} from "@/lib/masterMockStore";

export async function PUT(request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.branch", "update");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json();
    const { id } = await params;

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
      const updated = updateMock("branches", id, payload, ["code"]);
      if (!updated) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
      return NextResponse.json(updated);
    }

    await dbConnect();
    const updated = await Branch.findByIdAndUpdate(
      id,
      payload,
      { new: true, runValidators: true }
    );
    if (!updated) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || parseMongoError(error, "Failed to update branch.") },
      { status: 400 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const access = await authorizeRequestAccess("settings.branch", "delete");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;

    if (shouldUseMasterMockData()) {
      const { groupCount, vehicleCount } = getBranchDependencySummaryMock(id);
      if (groupCount || vehicleCount) {
        return NextResponse.json(
          {
            error:
              "Cannot delete branch. Remove related vehicle groups and vehicles first.",
          },
          { status: 409 }
        );
      }
      const deleted = removeMock("branches", id);
      if (!deleted) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    await dbConnect();
    const [groupCount, vehicleCount] = await Promise.all([
      VehicleGroup.countDocuments({ branchId: id }),
      MasterVehicle.countDocuments({ branchId: id }),
    ]);
    if (groupCount || vehicleCount) {
      return NextResponse.json(
        {
          error:
            "Cannot delete branch. Remove related vehicle groups and vehicles first.",
        },
        { status: 409 }
      );
    }
    const deleted = await Branch.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete branch." }, { status: 400 });
  }
}
