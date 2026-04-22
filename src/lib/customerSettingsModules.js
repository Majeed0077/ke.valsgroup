export const customerSettingsModuleGroups = [
  {
    key: "distributor-menu",
    sectionLabel: "Distributor",
    items: [
      {
        key: "distributor-dashboard",
        label: "Dashboard",
        href: "/distributor-dashboard",
        menuKey: "settings.distributor-dashboard",
        description: "Open distributor-level operational overview.",
      },
      {
        key: "distributor",
        label: "Distributor",
        href: "/distributor",
        menuKey: "settings.distributor",
        description: "Manage distributor records and profile details.",
      },
      {
        key: "sub-distributor",
        label: "Sub Distributor",
        href: "/sub-distributor",
        menuKey: "settings.sub-distributor",
        description: "Maintain linked sub-distributor accounts.",
      },
    ],
  },
  {
    key: "organization-menu",
    sectionLabel: "Organization",
    items: [
      {
        key: "organization-dashboard",
        label: "Dashboard",
        href: "/organization-dashboard",
        menuKey: "settings.organization-dashboard",
        description: "Open organization-level setup overview.",
      },
      {
        key: "organization",
        label: "Organization",
        href: "/organization",
        menuKey: "settings.organization",
        description: "Manage organization-level structure.",
      },
      {
        key: "company",
        label: "Company",
        href: "/company",
        menuKey: "settings.company",
        description: "Manage company-level setup.",
      },
      {
        key: "branch",
        label: "Branch",
        href: "/branch",
        menuKey: "settings.branch",
        description: "Manage branch-level setup.",
      },
      {
        key: "object-group",
        label: "Object Group",
        href: "/object-group",
        menuKey: "settings.object-group",
        description: "Organize related objects into working groups.",
      },
      {
        key: "object",
        label: "Object",
        href: "/object",
        menuKey: "settings.object",
        description: "Maintain master object records and assignments.",
      },
      {
        key: "staff",
        label: "Staff",
        href: "/staff",
        menuKey: "settings.staff",
        description: "Manage staff members and internal access.",
      },
      {
        key: "user",
        label: "User",
        href: "/user",
        menuKey: "settings.user",
        description: "Manage primary customer users.",
      },
      {
        key: "sub-user",
        label: "Sub User",
        href: "/sub-user",
        menuKey: "settings.sub-user",
        description: "Manage restricted or delegated sub-user access.",
      },
    ],
  },
  {
    key: "fleet-menu",
    sectionLabel: "Fleet",
    items: [
      {
        key: "fleet-tire-menu",
        label: "Tire",
        subItems: [
          {
            key: "tire",
            label: "Tire",
            href: "/tire",
            menuKey: "settings.tire",
            description: "Manage tire master and linked fleet tire setup.",
          },
          {
            key: "define-axle",
            label: "Define Axle",
            href: "/define-axle",
            menuKey: "settings.define-axle",
            description: "Configure axle definitions for fleet objects.",
          },
          {
            key: "tire-operation",
            label: "Tire Opration",
            href: "/tire-operation",
            menuKey: "settings.tire-operation",
            description: "Review and configure tire operational workflows.",
          },
          {
            key: "pressure-sensor",
            label: "Pressure Sensor",
            href: "/pressure-sensor",
            menuKey: "settings.pressure-sensor",
            description: "Maintain pressure sensor devices and mapping.",
          },
          {
            key: "tire-inspection",
            label: "Tire Inspection",
            href: "/tire-inspection",
            menuKey: "settings.tire-inspection",
            description: "Open tire inspection module and forms.",
          },
          {
            key: "tire-pressure-log",
            label: "Tire Pressure Log",
            href: "/tire-pressure-log",
            menuKey: "settings.tire-pressure-log",
            description: "Track pressure history and related logs.",
          },
          {
            key: "tire-tread-depth-log",
            label: "Tire Tread Depth Log",
            href: "/tire-tread-depth-log",
            menuKey: "settings.tire-tread-depth-log",
            description: "Track tread depth readings and service checks.",
          },
        ],
      },
      {
        key: "fleet-trailer-menu",
        label: "Trailer",
        subItems: [
          {
            key: "trailer",
            label: "Trailer",
            href: "/trailer",
            menuKey: "settings.trailer",
            description: "Manage trailer master records.",
          },
          {
            key: "trailer-group",
            label: "Trailer Group",
            href: "/trailer-group",
            menuKey: "settings.trailer-group",
            description: "Group trailers by operation or ownership.",
          },
          {
            key: "manage-trailer",
            label: "Mange Trailer",
            href: "/manage-trailer",
            menuKey: "settings.manage-trailer",
            description: "Assign and monitor trailer usage.",
          },
        ],
      },
      {
        key: "fleet-documents-menu",
        label: "Documents",
        subItems: [
          {
            key: "document-reminder",
            label: "Document Reminder",
            href: "/document-reminder",
            menuKey: "settings.document-reminder",
            description: "Set reminders for expiring fleet documents.",
          },
        ],
      },
      {
        key: "eco-driving",
        label: "Eco Driving",
        href: "/eco-driving",
        menuKey: "settings.eco-driving",
        description: "Open eco-driving configuration and tracking.",
      },
    ],
  },
  {
    key: "dispatch-management-menu",
    sectionLabel: "Dispatch Managment",
    items: [
      {
        key: "dispatch-dashboard",
        label: "Dashboard",
        href: "/dispatch-dashboard",
        menuKey: "settings.dispatch-dashboard",
        description: "Open dispatch management overview.",
      },
      {
        key: "jobs",
        label: "Jobs",
        href: "/jobs",
        menuKey: "settings.jobs",
        description: "Manage jobs and dispatch assignments.",
      },
      {
        key: "expenses",
        label: "Expenses",
        href: "/expenses",
        menuKey: "settings.expenses",
        description: "Maintain dispatch-related expense records.",
      },
      {
        key: "classify-trips",
        label: "Classify Trips",
        href: "/classify-trips",
        menuKey: "settings.classify-trips",
        description: "Classify trip types for dispatch workflows.",
      },
    ],
  },
  {
    key: "maintenance-menu",
    sectionLabel: "Maintanance",
    items: [
      {
        key: "reminder-rules",
        label: "Reminder Rules",
        href: "/reminder-rules",
        menuKey: "settings.reminder-rules",
        description: "Configure reminder rules and service schedules.",
      },
      {
        key: "alerts",
        label: "Alerts",
        href: "/alerts",
        menuKey: "settings.alerts",
        description: "Manage maintenance-related alert definitions.",
      },
      {
        key: "address",
        label: "Address",
        href: "/address",
        menuKey: "settings.address",
        description: "Maintain address master data for operations.",
      },
      {
        key: "geofence",
        label: "Geofence",
        href: "/geofence",
        menuKey: "settings.geofence",
        description: "Manage geofence boundaries and place markers.",
      },
      {
        key: "send-commands",
        label: "Send Commands",
        href: "/send-commands",
        menuKey: "settings.send-commands",
        description: "Dispatch device commands from a single workspace.",
      },
      {
        key: "fuel-price",
        label: "Fuel Price",
        href: "/fuel-price",
        menuKey: "settings.fuel-price",
        description: "Maintain fuel price references and history.",
      },
      {
        key: "bulk-object-update",
        label: "Bulk Object Update",
        href: "/bulk-object-update",
        menuKey: "settings.bulk-object-update",
        description: "Apply bulk updates across objects and fleet units.",
      },
      {
        key: "manage-ivr",
        label: "Manage DVIR",
        href: "/manage-ivr",
        menuKey: "settings.manage-ivr",
        description: "Configure DVIR prompts and action mappings.",
      },
    ],
  },
  {
    key: "app-settings-menu",
    sectionLabel: "App Settings",
    items: [
      {
        key: "announcements",
        label: "Announcements",
        href: "/announcements",
        menuKey: "settings.announcements",
        description: "Publish customer-facing announcements.",
      },
      {
        key: "more-apps",
        label: "More Apps",
        href: "/more-apps",
        menuKey: "settings.more-apps",
        description: "Open additional customer applications.",
      },
      {
        key: "image-overlay",
        label: "Image Overlay",
        href: "/image-overlay",
        menuKey: "settings.image-overlay",
        description: "Manage custom map/image overlay assets.",
      },
      {
        key: "form",
        label: "Form",
        href: "/form",
        menuKey: "settings.form",
        description: "Configure reusable application forms.",
      },
      {
        key: "user-customized-api",
        label: "User Customized API",
        href: "/user-customized-api",
        menuKey: "settings.user-customized-api",
        description: "Maintain customer-specific API integrations.",
      },
      {
        key: "template",
        label: "Template",
        href: "/template",
        menuKey: "settings.template",
        description: "Manage messaging and document templates.",
      },
    ],
  },
  {
    key: "billing-menu",
    sectionLabel: "Billing",
    items: [
      {
        key: "tariff-plan",
        label: "Traff Plan",
        href: "/tariff-plan",
        menuKey: "settings.tariff-plan",
        description: "Open tariff and billing plan configuration.",
      },
    ],
  },
];

function flattenCustomerSettingsItems(items, lineage = []) {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const nextLineage = [...lineage, item.label];
    const directItem = item.href
      ? [
          {
            ...item,
            sectionLabel: lineage[0] || item.sectionLabel || "",
            lineage: nextLineage,
          },
        ]
      : [];

    return [...directItem, ...flattenCustomerSettingsItems(item.subItems, lineage)];
  });
}

export const customerSettingsModuleItems = customerSettingsModuleGroups.flatMap((group) =>
  flattenCustomerSettingsItems(group.items, [group.sectionLabel])
);

export const customerSettingsModuleRouteMap = Object.fromEntries(
  customerSettingsModuleItems.map((item) => [item.href, item])
);

export function getCustomerSettingsMenuKeyForRoute(route) {
  return customerSettingsModuleRouteMap[String(route || "").trim()]?.menuKey || "";
}

export function getCustomerSettingsModuleBySlug(slug) {
  return (
    customerSettingsModuleItems.find(
      (item) => item.href.replace(/^\//, "") === String(slug || "").trim()
    ) || null
  );
}
