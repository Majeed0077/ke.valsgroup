import {
  FaClipboardList,
  FaCommentDots,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaGasPump,
  FaListAlt,
  FaLock,
  FaMapMarkerAlt,
  FaRegClock,
  FaRegDotCircle,
  FaRoad,
  FaSatellite,
  FaShoppingBag,
  FaTachometerAlt,
  FaThermometerHalf,
  FaTools,
  FaUserShield,
  FaUsers,
} from "react-icons/fa";
import {
  chartMenuItems as baseChartMenuItems,
  complaintMenuItems as baseComplaintMenuItems,
  reportMenuItems as baseReportMenuItems,
} from "@/lib/customerMenus";
import { customerSettingsModuleGroups, customerSettingsModuleItems } from "@/lib/customerSettingsModules";

const SETTING_ROUTE_KEYS = new Set(["/settings", ...customerSettingsModuleItems.map((item) => item.href)]);

export const managementMenuItems = [
  { type: "section", sectionLabel: "Client Management" },
  {
    key: "client-management.overview",
    label: "Overview",
    description: "Open the role and rights workspace",
    Icon: FaUserShield,
    href: "/client-management",
  },
  {
    key: "client-management.roles",
    label: "Roles",
    description: "Create reusable project profiles",
    Icon: FaUserShield,
    href: "/client-management/roles",
  },
  {
    key: "client-management.menus",
    label: "Menus",
    description: "Register routes and menu labels",
    Icon: FaListAlt,
    href: "/client-management/menus",
  },
  {
    key: "client-management.rights",
    label: "Rights",
    description: "Define action-level permissions",
    Icon: FaLock,
    href: "/client-management/rights",
  },
  {
    key: "client-management.role-rights",
    label: "Role Rights",
    description: "Map menus and actions to roles",
    Icon: FaClipboardList,
    href: "/client-management/role-rights",
  },
  {
    key: "client-management.user-roles",
    label: "User Roles",
    description: "Assign one or more roles to a user",
    Icon: FaUsers,
    href: "/client-management/user-roles",
  },
];

export function normalizePathname(pathname) {
  return pathname === "/vehicle-group" ? "/vehiclegroup" : pathname;
}

export function isPathActive(currentPath, href) {
  const normalizedCurrent = normalizePathname(currentPath);
  const normalizedHref = normalizePathname(href);
  if (!normalizedHref) return false;
  return normalizedCurrent === normalizedHref || normalizedCurrent.startsWith(`${normalizedHref}/`);
}

function titleFromValue(value) {
  return String(value || "")
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function withSection(sectionLabel, items) {
  if (!items.length) return [];
  return [{ type: "section", sectionLabel }, ...items];
}

function getActionsSummary(actions) {
  const enabled = Object.entries(actions || {})
    .filter(([, allowed]) => Boolean(allowed))
    .map(([key]) => titleFromValue(key));
  if (!enabled.length) return "";
  return enabled.slice(0, 3).join(" • ");
}

export function normalizeMenuAccessItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const key = String(item.key || "").trim();
      if (!key) return null;
      return {
        key,
        label: String(item.label || key),
        route: String(item.route || ""),
        group: String(item.group || "").toLowerCase(),
        parentKey: String(item.parentKey || ""),
        order: Number(item.order || 0),
        actions:
          item.actions && typeof item.actions === "object"
            ? Object.fromEntries(
                Object.entries(item.actions).map(([actionKey, allowed]) => [
                  String(actionKey || "").trim(),
                  Boolean(allowed),
                ])
              )
            : {},
        roleKeys: Array.isArray(item.roleKeys) ? item.roleKeys : [],
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

export function inferGroup(item) {
  if (item.group) return item.group;
  const route = String(item.route || "");
  if (route.startsWith("/report")) return "report";
  if (route.startsWith("/chart")) return "chart";
  if (route.startsWith("/complain")) return "complain";
  if (route.startsWith("/client-management")) return "client-management";
  if (SETTING_ROUTE_KEYS.has(route) || item.key.startsWith("settings.")) return "settings";
  if (route.startsWith("/tracking")) return "main";
  return "main";
}

export function iconForValue(value, fallbackGroup = "") {
  const token = String(value || "").toLowerCase();
  if (token.includes("fuel")) return FaGasPump;
  if (token.includes("alert")) return FaExclamationTriangle;
  if (token.includes("geofence") || token.includes("address")) return FaMapMarkerAlt;
  if (token.includes("sensor")) return FaSatellite;
  if (token.includes("rpm")) return FaTachometerAlt;
  if (token.includes("temperature")) return FaThermometerHalf;
  if (token.includes("expense")) return FaFileInvoiceDollar;
  if (token.includes("complaint")) return FaCommentDots;
  if (token.includes("ticket")) return FaRegClock;
  if (token.includes("role")) return token.includes("user") ? FaUsers : FaUserShield;
  if (token.includes("right")) return FaLock;
  if (token.includes("menu")) return FaListAlt;
  if (token.includes("job")) return FaShoppingBag;
  if (token.includes("road") || token.includes("behavior")) return FaRoad;
  if (fallbackGroup === "client-management") return FaUserShield;
  return FaRegDotCircle;
}

export function buildLegacyReportMenu() {
  return withSection("Reports", baseReportMenuItems.map((item) => ({ ...item })));
}

export function buildLegacyChartMenu() {
  return withSection("Charts", baseChartMenuItems.map((item) => ({ ...item })));
}

export function buildLegacyComplaintMenu() {
  return withSection("Complaint", baseComplaintMenuItems.map((item) => ({ ...item })));
}

export function buildLegacySettingMenu() {
  const mapSettingItem = (item) => ({
    key: item.key,
    label: item.label,
    description: item.description || "",
    Icon: iconForValue(item.key || item.label, "settings"),
    href: item.href || "",
    subItems: Array.isArray(item.subItems) ? item.subItems.map(mapSettingItem) : [],
  });

  return [
    {
      key: "general",
      label: "General",
      description: "Application-level preferences",
      Icon: FaTools,
      href: "/settings",
      subItems: [],
    },
    ...customerSettingsModuleGroups.map((group) => ({
      key: group.key,
      label: group.sectionLabel,
      description: "",
      Icon: iconForValue(group.key || group.sectionLabel, "settings"),
      href: "",
      subItems: group.items.map(mapSettingItem),
    })),
  ];
}

export function buildDirectAccessMenu(items, sectionLabel, fallbackGroup) {
  return withSection(
    sectionLabel,
    items.map((item) => ({
      key: item.key,
      label: item.label,
      description: getActionsSummary(item.actions),
      Icon: iconForValue(item.key, fallbackGroup),
      href: item.route,
      actions: item.actions,
    }))
  );
}

export function buildNestedAccessMenu(items, sectionLabel, rootSegment) {
  if (!items.length) return [];

  const roots = new Map();
  items.forEach((item) => {
    const route = String(item.route || "");
    const parts = route.split("/").filter(Boolean);
    const fallbackSegment = String(item.key || "").split(".")[1] || item.label;
    const parentSegment = parts[1] || fallbackSegment;
    const parentKey = `${rootSegment}.${parentSegment}`;
    const parentRoute = `/${rootSegment}/${parentSegment}`;
    const parentLabel = titleFromValue(parentSegment);
    const parent = roots.get(parentKey) || {
      key: parentKey,
      label: parentLabel,
      description: "",
      Icon: iconForValue(parentSegment, rootSegment),
      href: "",
      subItems: [],
    };

    if (parts.length <= 2 || route === parentRoute) {
      parent.href = route || parentRoute;
      parent.description = getActionsSummary(item.actions);
    } else {
      parent.subItems.push({
        key: item.key,
        label: item.label,
        href: route,
      });
    }

    roots.set(parentKey, parent);
  });

  const itemsWithChildren = [...roots.values()]
    .map((item) => ({
      ...item,
      description:
        item.description ||
        (item.subItems.length
          ? `${item.subItems.length} allowed item${item.subItems.length > 1 ? "s" : ""}`
          : ""),
      subItems: item.subItems.sort((left, right) => left.label.localeCompare(right.label)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return withSection(sectionLabel, itemsWithChildren);
}

export function hasActionableItems(items) {
  return items.some((item) => item?.type !== "section");
}
