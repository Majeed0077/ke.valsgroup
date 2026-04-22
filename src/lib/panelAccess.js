function normalizeMenuAccess(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item && typeof item === "object");
}

export function hasAdminPanelAccess(access) {
  return normalizeMenuAccess(access?.menuAccess).some(
    (item) => String(item?.key || "").startsWith("client-management.") && Boolean(item?.actions?.view)
  );
}

export function resolvePanelTarget(_session, access) {
  return hasAdminPanelAccess(access) ? "admin" : "customer";
}
