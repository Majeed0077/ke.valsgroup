import { getCustomerSettingsMenuKeyForRoute } from "@/lib/customerSettingsModules";

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function isAllowAll(source) {
  return Boolean(source?.__allowAll);
}

function isClientManagementMenuKey(menuKey) {
  return normalizeMenuKey(menuKey).startsWith("client-management");
}

function isAuthenticatedSession(source) {
  return Boolean(
    source &&
      (source?.isLoggedIn ||
        source?.externalUserId ||
        source?.userId ||
        source?.username ||
        source?.email)
  );
}

function readMenuAccess(source) {
  if (Array.isArray(source)) return source;
  return Array.isArray(source?.menuAccess) ? source.menuAccess : [];
}

function readAssignedRoleKeys(source) {
  if (Array.isArray(source?.assignedRoleKeys)) return source.assignedRoleKeys;
  return [];
}

function normalizeRoute(route) {
  const value = String(route || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  return value === "/vehicle-group" ? "/vehiclegroup" : value;
}

export function normalizeMenuKey(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[\\/]+/g, ".")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function normalizeMenuAccess(items) {
  return readMenuAccess(items)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const key = normalizeMenuKey(item.key);
      if (!key) return null;
      return {
        key,
        label: String(item.label || key),
        route: normalizeRoute(item.route),
        group: String(item.group || "main").trim().toLowerCase(),
        parentKey: normalizeMenuKey(item.parentKey),
        order: Number(item.order || 0),
        actions:
          item.actions && typeof item.actions === "object"
            ? Object.fromEntries(
                Object.entries(item.actions).map(([actionKey, allowed]) => [
                  normalizeMenuKey(actionKey),
                  Boolean(allowed),
                ])
              )
            : {},
        roleKeys: uniqueStrings(item.roleKeys),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

export function getMenuAccessItem(source, menuKey) {
  const targetKey = normalizeMenuKey(menuKey);
  if (!targetKey) return null;
  return normalizeMenuAccess(source).find((item) => item.key === targetKey) || null;
}

export function hasAssignedRoles(source) {
  return uniqueStrings(readAssignedRoleKeys(source)).length > 0;
}

export function hasClientManagementPreview(source, menuKey) {
  const targetKey = normalizeMenuKey(menuKey);
  if (!targetKey.startsWith("client-management")) return false;
  return false;
}

export function getAllowedActions(source, menuKey, options = {}) {
  if (isAllowAll(source)) {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      export_excel: true,
      export_word: true,
    };
  }

  if (isClientManagementMenuKey(menuKey)) {
    return {};
  }

  if (isAuthenticatedSession(source)) {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      export_excel: true,
      export_word: true,
    };
  }

  const item = getMenuAccessItem(source, menuKey);
  if (item) return item.actions || {};
  if (normalizeMenuKey(menuKey) === "tracking" && isAuthenticatedSession(source)) {
    return { view: true };
  }
  if (options.allowClientManagementPreview && hasClientManagementPreview(source, menuKey)) {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
    };
  }
  return {};
}

export function hasMenuAction(source, menuKey, action = "view", options = {}) {
  if (isAllowAll(source)) return true;

  const targetKey = normalizeMenuKey(menuKey);
  const targetAction = normalizeMenuKey(action || "view");
  if (!targetKey) return false;
  if (targetKey.startsWith("client-management")) return false;
  if (targetKey === "tracking" && targetAction === "view" && isAuthenticatedSession(source)) {
    return true;
  }

  if (isAuthenticatedSession(source)) {
    return true;
  }

  const actions = getAllowedActions(source, targetKey, options);
  if (targetAction in actions) return Boolean(actions[targetAction]);

  if (targetAction === "view" && options.allowParentView) {
    return normalizeMenuAccess(source).some((item) => item.key.startsWith(`${targetKey}.`) && Boolean(item.actions?.view));
  }

  return false;
}

export function hasAnyMenuAction(source, menuKeys, action = "view", options = {}) {
  if (isAllowAll(source)) return true;
  return (Array.isArray(menuKeys) ? menuKeys : []).some((menuKey) => hasMenuAction(source, menuKey, action, options));
}

export function routeToMenuKey(route) {
  const normalizedRoute = normalizeRoute(route);
  if (!normalizedRoute || normalizedRoute === "/") return "";

  if (normalizedRoute === "/tracking") return "tracking";
  if (normalizedRoute === "/settings") return "settings";
  const mappedSettingsMenuKey = getCustomerSettingsMenuKeyForRoute(normalizedRoute);
  if (mappedSettingsMenuKey) return mappedSettingsMenuKey;
  if (normalizedRoute === "/client-management") return "client-management.overview";

  const parts = normalizedRoute.split("/").filter(Boolean);
  if (!parts.length) return "";

  if (parts[0] === "client-management") {
    return `client-management.${normalizeMenuKey(parts[1] || "overview")}`;
  }

  if (["report", "chart", "complain"].includes(parts[0])) {
    return parts.map((part) => normalizeMenuKey(part)).join(".");
  }

  return normalizeMenuKey(parts.join("."));
}

function filterMenuNode(item, source, options = {}) {
  const subItems = (Array.isArray(item?.subItems) ? item.subItems : [])
    .map((subItem) => filterMenuNode(subItem, source, options))
    .filter(Boolean);
  const itemMenuKey = item?.menuKey || routeToMenuKey(item?.href);
  const directAccess = itemMenuKey ? hasMenuAction(source, itemMenuKey, "view", options) : false;

  if (!directAccess && !subItems.length) return null;

  return {
    ...item,
    subItems,
  };
}

export function filterMenuItemsByAccess(items, source, options = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => filterMenuNode(item, source, options))
    .filter(Boolean);
}
