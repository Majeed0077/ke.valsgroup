"use client";

import MasterCrudPage from "@/components/MasterCrudPage";

export default function CompanyPage() {
  const companyIdTypes = [
    "CNIC",
    "SCNIC",
    "NICOP",
    "POR",
    "BOR",
    "Registration No",
    "NTN",
    "STRB",
    "PRA",
    "BRA",
    "KPRA",
    "AJKRA",
    "ISRA",
  ];

  return (
    <MasterCrudPage
      title="Company"
      description="Manage company records from the live backend."
      apiBase="/api/companies"
      menuKey="settings.company"
      optionSources={{
        organizations: { url: "/api/lov/organizations", labelField: "name" },
      }}
      autoFillSources={{
        organizationId: {
          getUrl: (value) => `/api/companies/autofill?organizationId=${encodeURIComponent(String(value || ""))}`,
          fieldMap: {
            name: "name",
            email: "email",
            mobile: "mobile",
            phone: "phone",
            url: "url",
            idType: "idType",
            idValue: "idValue",
            status: "status",
          },
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
          name: "email",
          label: "Email",
          placeholder: "company@example.com",
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
        {
          name: "phone",
          label: "Phone",
          placeholder: "021-xxxxxxx",
        },
        {
          name: "url",
          label: "Website",
          placeholder: "https://example.com",
        },
        {
          name: "idType",
          label: "ID Type",
          type: "select",
          options: companyIdTypes,
          placeholder: "Select ID Type",
        },
        {
          name: "idValue",
          label: "ID Value",
          placeholder: "Registration / NTN / CNIC",
        },
        {
          name: "organizationId",
          label: "Organization",
          type: "select",
          optionsKey: "organizations",
          required: true,
        },
        { name: "status", label: "Status", type: "select", defaultValue: "Active", required: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "mobile", label: "Mobile" },
        { key: "organizationName", label: "Organization" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
