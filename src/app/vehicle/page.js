"use client";

import MasterCrudPage from "@/components/MasterCrudPage";

export default function VehiclePage() {
  return (
    <MasterCrudPage
      title="Vehicle"
      description="Manage vehicle masters for customer panel."
      apiBase="/api/master-vehicles"
      menuKey="settings.vehicle"
      optionSources={{
        organizations: { url: "/api/organizations", labelField: "name" },
        branches: {
          url: "/api/branches",
          labelField: "name",
          includeFields: ["organizationId"],
        },
        vehicleGroups: {
          url: "/api/vehicle-groups",
          labelField: "name",
          includeFields: ["organizationId", "branchId"],
        },
      }}
      fields={[
        {
          name: "vehicleNo",
          label: "Vehicle No",
          required: true,
          validate: (value) =>
            /^[A-Za-z0-9-]{3,20}$/.test(String(value || ""))
              ? ""
              : "Vehicle No must be 3-20 chars (letters, numbers, -).",
        },
        {
          name: "imei",
          label: "IMEI",
          validate: (value) =>
            !String(value || "").trim() || /^\d{10,20}$/.test(String(value || ""))
              ? ""
              : "IMEI must be 10-20 digits.",
        },
        {
          name: "vehicleType",
          label: "Vehicle Type",
          required: true,
          validate: (value) =>
            String(value || "").length < 2 ? "Vehicle Type must be at least 2 characters." : "",
        },
        { name: "organizationId", label: "Organization", type: "select", optionsKey: "organizations", required: true },
        {
          name: "branchId",
          label: "Branch",
          type: "select",
          optionsKey: "branches",
          dependsOn: { organizationId: "organizationId" },
          required: true,
        },
        {
          name: "vehicleGroupId",
          label: "Vehicle Group",
          type: "select",
          optionsKey: "vehicleGroups",
          dependsOn: { organizationId: "organizationId", branchId: "branchId" },
          required: true,
        },
        { name: "status", label: "Status", type: "select", defaultValue: "Active", required: true },
      ]}
      columns={[
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "imei", label: "IMEI" },
        { key: "vehicleType", label: "Type" },
        { key: "organizationName", label: "Organization" },
        { key: "branchName", label: "Branch" },
        { key: "vehicleGroupName", label: "Vehicle Group" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
