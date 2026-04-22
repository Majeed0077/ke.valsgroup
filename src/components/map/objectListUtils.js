import { getVehicleStatusKey } from "@/lib/vehicleStatus";

export const OBJECT_STATUS_LABELS = {
  running: "Running",
  stopped: "Stopped",
  idle: "Idle",
  inactive: "Inactive",
  nodata: "No Data",
};

export const getObjectListGroupLabel = (vehicle) =>
  vehicle?.organizations ||
  vehicle?.organization ||
  vehicle?.company ||
  vehicle?.branch ||
  vehicle?.group1 ||
  vehicle?.group ||
  "Other Vehicles";

export const getObjectListOrganizationLabel = (vehicle) =>
  vehicle?.organizations ||
  vehicle?.organization ||
  "Other Organizations";

export const getObjectListVehicleLabel = (vehicle) =>
  vehicle?.vehicle_no ||
  vehicle?.obj_reg_no ||
  vehicle?.obj_name ||
  vehicle?.vehicle_name ||
  vehicle?.imei_id ||
  "Vehicle";

export const getObjectListStatusKey = (vehicle) => {
  return getVehicleStatusKey(vehicle);
};

export const getObjectListSignalText = (vehicle) => {
  const rawTimestamp =
    Number(vehicle?.timestamp || 0) ||
    Number(vehicle?.datetime || 0) ||
    Number(vehicle?.gps_time || 0) ||
    Number(vehicle?.gpsTime || 0) ||
    Number(vehicle?.device_time || 0) ||
    Number(vehicle?.deviceTime || 0) ||
    Number(vehicle?.server_time || 0) ||
    Number(vehicle?.serverTime || 0) ||
    Number(new Date(vehicle?.updatedAt || vehicle?.updated_at || vehicle?.time || 0).getTime() || 0);

  if (!rawTimestamp) return "Last signal unavailable";

  const deltaMs = Math.max(0, Date.now() - rawTimestamp);
  const deltaMinutes = Math.round(deltaMs / 60000);

  if (deltaMinutes <= 0) return "Last signal just now";
  if (deltaMinutes === 1) return "Last signal 1 min ago";
  if (deltaMinutes < 60) return `Last signal ${deltaMinutes} min ago`;

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours === 1) return "Last signal 1 hour ago";
  if (deltaHours < 24) return `Last signal ${deltaHours} hours ago`;

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays === 1) return "Last signal 1 day ago";
  return `Last signal ${deltaDays} days ago`;
};
