"use client";

import MasterCrudPage from "@/components/MasterCrudPage";

export default function BranchPage() {
  return (
    <MasterCrudPage
      title="Branch"
      description="Manage branch masters for customer panel."
      apiBase="/api/branches"
      menuKey="settings.branch"
      optionSources={{
        organizations: { url: "/api/organizations", labelField: "name" },
        companies: {
          url: "/api/companies",
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
          name: "companyId",
          label: "Company",
          type: "select",
          optionsKey: "companies",
          dependsOn: { organizationId: "organizationId" },
          required: true,
        },
        {
          name: "location",
          label: "Location",
          validate: (value) =>
            String(value || "").length > 60 ? "Location must be 60 characters or less." : "",
        },
        { name: "status", label: "Status", type: "select", defaultValue: "Active", required: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "organizationName", label: "Organization" },
        { key: "companyName", label: "Company" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
