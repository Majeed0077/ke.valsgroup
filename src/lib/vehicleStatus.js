export const VEHICLE_STATUS_COLORS = {
  running: "#66bb4d",
  stopped: "#ff4e47",
  idle: "#efbb2d",
  inactive: "#2f6fe4",
  nodata: "#787f91",
};

const vehicleMotionSnapshotCache = new Map();
const MAX_MOTION_COMPARISON_GAP_MS = 10 * 60 * 1000;
const INACTIVE_PACKET_AGE_MS = 24 * 60 * 60 * 1000;

const readVehicleStatusString = (vehicle, keys) => {
  for (const key of keys) {
    const value = vehicle?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const readVehicleStatusNumber = (vehicle, keys, fallback = 0) => {
  for (const key of keys) {
    const value = Number(vehicle?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const hasVehicleStatusNumber = (vehicle, keys) => {
  for (const key of keys) {
    const value = Number(vehicle?.[key]);
    if (Number.isFinite(value)) return true;
  }
  return false;
};

const readVehicleTimestampMs = (vehicle) => {
  const candidates = [
    "timestamp",
    "sourceTimestamp",
    "gps_time",
    "gpsTime",
    "device_time",
    "deviceTime",
    "server_time",
    "serverTime",
    "last_update",
    "lastUpdated",
    "updatedAt",
    "updated_at",
  ];

  for (const key of candidates) {
    const candidate = vehicle?.[key];
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
};

const readVehicleCoordinate = (vehicle, keyPairs) => {
  for (const keys of keyPairs) {
    for (const key of keys) {
      const value = Number(vehicle?.[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
};

const readVehicleCoordinates = (vehicle) => {
  const lat = readVehicleCoordinate(vehicle, [["latitude", "lat"]]);
  const lng = readVehicleCoordinate(vehicle, [["longitude", "lng", "lon"]]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const hasVehicleTelemetrySignal = (vehicle) => {
  const movementStatus = readVehicleStatusString(vehicle, ["movement_status", "movementStatus"]);
  const ignitionStatus = readVehicleStatusString(vehicle, ["ignition_status", "ignitionStatus"]);
  const movementDetected = readVehicleStatusString(vehicle, ["movement_detected", "movementDetected"]);
  const hasSpeed = hasVehicleStatusNumber(vehicle, ["speed_kmh", "speed", "speedKmh"]);
  const hasCoordinates = Boolean(readVehicleCoordinates(vehicle));

  return Boolean(
    movementStatus ||
      ignitionStatus ||
      movementDetected ||
      hasSpeed ||
      hasCoordinates
  );
};

const getVehicleIdentity = (vehicle) => {
  const candidates = [
    vehicle?.id,
    vehicle?.vehicle_id,
    vehicle?.vehicleId,
    vehicle?.imei_id,
    vehicle?.imeiId,
    vehicle?.imei,
    vehicle?.imeino,
    vehicle?.imei_no,
    vehicle?.device_id,
    vehicle?.deviceId,
    vehicle?.unit_id,
    vehicle?.unitId,
    vehicle?.vehicle_no,
    vehicle?.obj_reg_no,
    vehicle?.reg_no,
    vehicle?.registration_no,
    vehicle?.vehicle_reg_no,
    vehicle?.plate_no,
    vehicle?.vehicle_name,
    vehicle?.obj_name,
    vehicle?.name,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }

  return "";
};

const buildCoordinateKey = (coords) => {
  if (!coords) return "";
  return `${coords.lat.toFixed(6)}:${coords.lng.toFixed(6)}`;
};

const buildVehiclePacketKey = (vehicle, coords, timestamp) => {
  const speed = readVehicleStatusNumber(vehicle, ["speed_kmh", "speed", "speedKmh"], 0);
  const heading = readVehicleStatusNumber(vehicle, ["angle_name", "angle", "heading", "course"], 0);
  return [
    Number.isFinite(timestamp) ? timestamp : 0,
    coords ? coords.lat.toFixed(6) : "x",
    coords ? coords.lng.toFixed(6) : "y",
    Number.isFinite(speed) ? speed.toFixed(2) : "0",
    Number.isFinite(heading) ? heading.toFixed(2) : "0",
  ].join("|");
};

const hasActualVehicleMotion = (vehicle, movementDetected) => {
  if (movementDetected === "y") return true;

  const vehicleId = getVehicleIdentity(vehicle);
  const coords = readVehicleCoordinates(vehicle);
  if (!vehicleId || !coords) return false;

  const timestamp = readVehicleTimestampMs(vehicle);
  const packetKey = buildVehiclePacketKey(vehicle, coords, timestamp);
  const coordinateKey = buildCoordinateKey(coords);
  const previousSnapshot = vehicleMotionSnapshotCache.get(vehicleId);

  if (previousSnapshot?.packetKey === packetKey) {
    return Boolean(previousSnapshot.actualMotion);
  }

  const timestampGapMs =
    previousSnapshot?.timestamp > 0 && timestamp > 0
      ? Math.abs(timestamp - previousSnapshot.timestamp)
      : 0;
  const canCompareWithPrevious =
    !previousSnapshot || !timestampGapMs || timestampGapMs <= MAX_MOTION_COMPARISON_GAP_MS;
  const coordinateChanged = Boolean(
    canCompareWithPrevious &&
      previousSnapshot?.coordinateKey &&
      previousSnapshot.coordinateKey !== coordinateKey
  );

  const actualMotion = coordinateChanged;

  vehicleMotionSnapshotCache.set(vehicleId, {
    packetKey,
    coordinateKey,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    actualMotion,
  });

  return actualMotion;
};

export const getVehicleStatusKey = (vehicle) => {
  const timestamp = readVehicleTimestampMs(vehicle);
  const status = readVehicleStatusString(vehicle, ["movement_status", "movementStatus"]).toLowerCase();
  const ignition = readVehicleStatusString(vehicle, ["ignition_status", "ignitionStatus"]).toLowerCase();
  const movementDetected = readVehicleStatusString(vehicle, ["movement_detected", "movementDetected"]).toLowerCase();
  const speed = readVehicleStatusNumber(vehicle, ["speed_kmh", "speed", "speedKmh"], 0);

  if (!timestamp || !hasVehicleTelemetrySignal(vehicle)) return "nodata";

  const packetAgeMs = Math.max(Date.now() - timestamp, 0);
  if (packetAgeMs > INACTIVE_PACKET_AGE_MS) return "inactive";

  const hasActualMotion = hasActualVehicleMotion(vehicle, movementDetected);

  if (hasActualMotion) return "running";

  if (status.includes("idle")) return "idle";

  if (status.includes("run") || status.includes("mov")) {
    if (ignition.includes("on")) return "idle";
    if (ignition.includes("off")) return "stopped";
    return speed > 0 ? "idle" : "stopped";
  }

  if (status.includes("stop")) {
    if (ignition.includes("on")) return "idle";
    if (ignition.includes("off")) return "stopped";
    return "stopped";
  }

  if (movementDetected === "n" && ignition.includes("on")) return "idle";
  if (movementDetected === "n") {
    return "stopped";
  }

  if (speed > 0) {
    if (ignition.includes("on")) return "idle";
    if (ignition.includes("off")) return "stopped";
    return "stopped";
  }
  if (ignition.includes("on")) return "idle";
  if (ignition.includes("off")) return "stopped";
  return "nodata";
};

export const getVehicleDisplayIgnitionState = (vehicle) => {
  const explicitIgnition = readVehicleStatusString(vehicle, ["ignition_status", "ignitionStatus"]).toLowerCase();
  const statusKey = getVehicleStatusKey(vehicle);

  if (statusKey === "running" || statusKey === "idle") return "on";
  if (explicitIgnition.includes("on")) return "on";
  if (explicitIgnition.includes("off")) return "off";
  if (statusKey === "stopped" || statusKey === "inactive") return "off";
  return "off";
};

export const getVehicleStatusSummary = (vehicles) => {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const summary = {
    all: list.length,
    running: 0,
    idle: 0,
    stopped: 0,
    inactive: 0,
    nodata: 0,
  };

  list.forEach((vehicle) => {
    const key = getVehicleStatusKey(vehicle);
    if (summary[key] !== undefined) summary[key] += 1;
  });

  return summary;
};
