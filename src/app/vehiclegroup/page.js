"use client";

import MasterCrudPage from "@/components/MasterCrudPage";

export default function VehicleGroupPage() {
  return (
    <MasterCrudPage
      title="VehicleGroup"
      description="Manage vehicle group masters for customer panel."
      apiBase="/api/vehicle-groups"
      menuKey="settings.vehiclegroup"
      optionSources={{
        organizations: { url: "/api/organizations", labelField: "name" },
        branches: {
          url: "/api/branches",
          labelField: "name",
          includeFields: ["organizationId"],
        },
      }}
      fields={[
        {
          name: "name",
          label: "Name",
          required: true,
          validate: (value) =>
            String(value || "").length < 2 ? "Name must be at least 2 characters." : "",
        },
        {
          name: "code",
          label: "Code",
          required: true,
          validate: (value) =>
            /^[A-Za-z0-9-]{3,20}$/.test(String(value || ""))
              ? ""
              : "Code must be 3-20 chars (letters, numbers, -).",
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
          name: "description",
          label: "Description",
          validate: (value) =>
            String(value || "").length > 120 ? "Description must be 120 characters or less." : "",
        },
        { name: "status", label: "Status", type: "select", defaultValue: "Active", required: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "organizationName", label: "Organization" },
        { key: "branchName", label: "Branch" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
