"use client";

import MasterCrudPage from "@/components/MasterCrudPage";

export default function OrganizationPage() {
  return (
    <MasterCrudPage
      title="Organization"
      description="Manage your organization details from the live backend."
      apiBase="/api/organizations"
      menuKey="settings.organization"
      canCreate={false}
      canEdit={true}
      canDelete={false}
      restrictedMessage="You can update your own organization details here. Insert and delete remain blocked by backend rules."
      fields={[
        {
          name: "name",
          label: "Name",
          required: true,
          validate: (value) =>
            String(value || "").length < 2 ? "Name must be at least 2 characters." : "",
        },
        {
          name: "email",
          label: "Email",
          placeholder: "organization@example.com",
          validate: (value) =>
            !String(value || "").trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""))
              ? ""
              : "Enter a valid email address.",
        },
        {
          name: "mobile",
          label: "Mobile",
          placeholder: "03xxxxxxxxx",
          validate: (value) =>
            !String(value || "").trim() || /^[0-9+\-\s]{7,20}$/.test(String(value || ""))
              ? ""
              : "Enter a valid mobile number.",
        },
        { name: "status", label: "Status", type: "select", defaultValue: "Active", required: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "mobile", label: "Mobile" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
