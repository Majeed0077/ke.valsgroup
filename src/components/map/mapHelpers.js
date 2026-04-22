import L from "leaflet";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";

export const normalizeAngle = (deg) => {
  let next = deg % 360;
  if (next < 0) next += 360;
  return next;
};

export const shortestAngleDelta = (from, to) => {
  let delta = normalizeAngle(to) - normalizeAngle(from);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
};

export const smoothHeading = (from, to, alpha = 0.1) =>
  normalizeAngle(from + shortestAngleDelta(from, to) * alpha);

const toRad = (deg) => (deg * Math.PI) / 180;
export const haversineMeters = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const getBearing = (start, end) => {
  const [lat1, lon1] = start;
  const [lat2, lon2] = end;
  const toDegrees = (rad) => rad * (180 / Math.PI);

  const startLat = toRad(lat1);
  const startLng = toRad(lon1);
  const destLat = toRad(lat2);
  const destLng = toRad(lon2);

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x =
    Math.cos(startLat) * Math.sin(destLat) -
    Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

export const formatDateTimeLocalInputValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatPlaybackApiDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const buildDefaultCustomPlaybackRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
  return {
    start: formatDateTimeLocalInputValue(start),
    end: formatDateTimeLocalInputValue(end),
  };
};

export const getPlaybackWindowMs = (preset) => {
  switch (preset) {
    case "Last 24 Hour":
      return 24 * 60 * 60 * 1000;
    case "Yesterday":
      return 24 * 60 * 60 * 1000;
    case "This Week":
      return 7 * 24 * 60 * 60 * 1000;
    case "Last Week":
      return 7 * 24 * 60 * 60 * 1000;
    case "This Month":
      return 31 * 24 * 60 * 60 * 1000;
    case "Last Month":
      return 31 * 24 * 60 * 60 * 1000;
    case "Custom":
      return 12 * 60 * 60 * 1000;
    case "Today":
    default:
      return 24 * 60 * 60 * 1000;
  }
};

export const resolvePlaybackPresetDateRange = (preset, customRange = null) => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(now);

  switch (preset) {
    case "Today":
      break;
    case "Last 24 Hour":
      start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "Yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
      break;
    case "This Week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      break;
    }
    case "Last Week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff - 7);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "This Month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "Last Month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "Custom": {
      const customStart = customRange?.start ? new Date(customRange.start) : null;
      const customEnd = customRange?.end ? new Date(customRange.end) : null;
      if (!customStart || Number.isNaN(customStart.getTime()) || !customEnd || Number.isNaN(customEnd.getTime())) {
        return { fromDate: "", toDate: "" };
      }
      return {
        fromDate: formatPlaybackApiDateTime(customStart),
        toDate: formatPlaybackApiDateTime(customEnd),
      };
    }
    default:
      break;
  }

  return {
    fromDate: formatPlaybackApiDateTime(start),
    toDate: formatPlaybackApiDateTime(end),
  };
};

export const getRecentPlaybackSamples = (samples) => {
  if (!Array.isArray(samples) || samples.length <= 2) return samples || [];

  const latestTimestamp = Number(samples[samples.length - 1]?.timestamp || 0);
  const recentWindowMs = 5 * 60 * 1000;
  const withinRecentWindow =
    latestTimestamp > 0
      ? samples.filter((sample) => {
          const ts = Number(sample?.timestamp || 0);
          return !ts || latestTimestamp - ts <= recentWindowMs;
        })
      : samples;

  const source = withinRecentWindow.length >= 2 ? withinRecentWindow : samples;
  return source.slice(-4);
};

export const getPlaybackSamplesForPreset = (samples, preset, customRange = null) => {
  if (!Array.isArray(samples) || samples.length === 0) return [];
  if (!preset) return getRecentPlaybackSamples(samples);

  const latestTimestamp = Number(samples[samples.length - 1]?.timestamp || 0);
  if (!latestTimestamp) return samples.slice(-Math.min(samples.length, 24));

  const now = new Date(latestTimestamp);
  const start = new Date(now);
  const end = new Date(now);

  switch (preset) {
    case "Today":
      start.setHours(0, 0, 0, 0);
      break;
    case "Last 24 Hour":
      start.setTime(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "Yesterday": {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "This Week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "Last Week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff - 7);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      break;
    }
    case "This Month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "Last Month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "Custom":
      if (customRange?.start && customRange?.end) {
        const customStart = new Date(customRange.start);
        const customEnd = new Date(customRange.end);
        if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
          start.setTime(customStart.getTime());
          end.setTime(customEnd.getTime());
          break;
        }
      }
      start.setTime(end.getTime() - 12 * 60 * 60 * 1000);
      break;
    default:
      break;
  }

  const filtered = samples.filter((sample) => {
    const timestamp = Number(sample?.timestamp || 0);
    return !timestamp || (timestamp >= start.getTime() && timestamp <= end.getTime());
  });

  if (filtered.length >= 2) return filtered;

  const fallbackWindow = getPlaybackWindowMs(preset);
  const fallbackSamples = samples.filter((sample) => {
    const timestamp = Number(sample?.timestamp || 0);
    return !timestamp || latestTimestamp - timestamp <= fallbackWindow;
  });

  return fallbackSamples.length >= 2
    ? fallbackSamples
    : samples.slice(-Math.min(samples.length, 12));
};

export const formatPlaybackStamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export const formatPlaybackBadgeStamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("day")}-${pick("month")}-${pick("year")} ${pick("hour")}:${pick("minute")}:${pick("second")} ${pick("dayPeriod")}`;
};

export const formatPlaybackDuration = (durationMs) => {
  const totalMinutes = Math.max(0, Math.round(Number(durationMs || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const formatPlaybackDistance = (distanceMeters) => {
  const km = Number(distanceMeters || 0) / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
};

export const formatPlaybackOdometer = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && Number.isNaN(Number(value))) return value.trim();
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return `${numericValue.toFixed(numericValue >= 100 ? 0 : 1)} km`;
};

export const formatPlaybackCoords = (lat, lng) => {
  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);
  if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) return "-";
  return `${normalizedLat.toFixed(5)}, ${normalizedLng.toFixed(5)}`;
};

export const formatPlaybackSpeed = (speedKmh) => `${Math.max(0, Math.round(Number(speedKmh) || 0))}`;

export const buildChartPolyline = (values, width = 960, height = 172, padding = 16) => {
  const safeValues = Array.isArray(values) && values.length > 0 ? values : [0, 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);

  return safeValues
    .map((value, index) => {
      const ratio = safeValues.length <= 1 ? 0 : index / (safeValues.length - 1);
      const x = padding + ratio * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
};

export const getPlaybackProgressTimestamp = (samples, progress) => {
  const firstTimestamp = Number(samples?.[0]?.timestamp || 0);
  const lastTimestamp = Number(samples?.[samples.length - 1]?.timestamp || 0);
  if (!firstTimestamp || !lastTimestamp || lastTimestamp < firstTimestamp) return "";
  const clamped = Math.max(0, Math.min(1, Number(progress || 0)));
  return formatPlaybackStamp(firstTimestamp + (lastTimestamp - firstTimestamp) * clamped);
};

export const getPlaybackEventIndexes = (pathLength, fractions) => {
  if (!Number.isFinite(pathLength) || pathLength < 2 || !Array.isArray(fractions)) return [];
  const lastIndex = pathLength - 1;
  return fractions
    .map((fraction) => Math.max(1, Math.min(lastIndex - 1, Math.round(lastIndex * fraction))))
    .filter((index, position, list) => list.indexOf(index) === position);
};

export const createPlaybackEventIcon = (
  label,
  tone = "blue",
  shape = "dot",
  { scale = 1, showLabel = true, rotateDegrees = 0 } = {}
) => {
  const normalizedScale = Math.max(0.62, Number(scale) || 1);
  const baseSize = showLabel ? (shape === "triangle" ? 24 : 22) : shape === "triangle" ? 24 : 18;
  const scaledSize = Math.round(baseSize * normalizedScale);
  const anchor = Math.round(scaledSize / 2);
  const normalizedRotation = Number.isFinite(Number(rotateDegrees)) ? Number(rotateDegrees) : 0;

  return L.divIcon({
    html: `<span class="vtp-playback-event-scale" style="--vtp-playback-event-scale:${normalizedScale};--vtp-playback-event-rotate:${normalizedRotation}deg;"><span class="vtp-playback-event-marker ${showLabel ? "" : "is-compact"} vtp-playback-event-${tone} vtp-playback-event-${shape}">${showLabel ? `<span class="vtp-playback-event-label">${label}</span>` : ""}</span></span>`,
    className: "vtp-playback-event-wrap",
    iconSize: [scaledSize, scaledSize],
    iconAnchor: [anchor, anchor],
  });
};

export const createPlaybackCustomColorIcon = (
  label,
  color,
  shape = "square",
  { scale = 1, showLabel = true, rotateDegrees = 0 } = {}
) => {
  const normalizedScale = Math.max(0.62, Number(scale) || 1);
  const baseSize = showLabel ? 22 : 16;
  const scaledSize = Math.round(baseSize * normalizedScale);
  const anchor = Math.round(scaledSize / 2);
  const normalizedRotation = Number.isFinite(Number(rotateDegrees)) ? Number(rotateDegrees) : 0;

  return L.divIcon({
    html: `<span class="vtp-playback-event-scale" style="--vtp-playback-event-scale:${normalizedScale};--vtp-playback-event-rotate:${normalizedRotation}deg;"><span class="vtp-playback-event-marker ${showLabel ? "" : "is-compact"} vtp-playback-event-${shape}" style="background:${color};">${showLabel ? `<span class="vtp-playback-event-label">${label}</span>` : ""}</span></span>`,
    className: "vtp-playback-event-wrap",
    iconSize: [scaledSize, scaledSize],
    iconAnchor: [anchor, anchor],
  });
};

export const createRotatedDivIcon = (leafletIcon, rotation, vehicle) => {
  const { iconUrl, iconSize } = leafletIcon.options;
  if (!iconUrl || !iconSize) return L.Icon.Default();
  const normalizedRotation = normalizeAngle(rotation - 90);
  const wrapperWidth = iconSize[0] + 10;
  const wrapperHeight = iconSize[1] + 10;
  const vehicleLabel = String(
    vehicle?.vehicle_no || vehicle?.obj_reg_no || vehicle?.obj_name || vehicle?.imei_id || "Vehicle"
  ).trim();
  const safeVehicleLabel = vehicleLabel.replace(/"/g, "&quot;");
  const statusKey = getVehicleStatusKey(vehicle);
  const statusShadow =
    statusKey === "running"
      ? "0 3px 7px rgba(35, 124, 34, 0.28)"
      : statusKey === "idle"
        ? "0 3px 7px rgba(177, 123, 18, 0.28)"
        : statusKey === "stopped" || statusKey === "inactive"
          ? "0 3px 7px rgba(179, 44, 39, 0.28)"
          : "0 3px 7px rgba(8, 12, 18, 0.22)";

  return L.divIcon({
    html: `
      <div
        role="img"
        aria-label="${safeVehicleLabel}"
        title="${safeVehicleLabel}"
        style="width:${wrapperWidth}px;height:${wrapperHeight}px;display:flex;align-items:center;justify-content:center;"
      >
        <img
          data-status-icon="1"
          src="${iconUrl}"
          alt="${safeVehicleLabel}"
          aria-hidden="true"
          style="
            display:block;
            width:${iconSize[0]}px;
            height:${iconSize[1]}px;
            transform-origin:center;
            transform:rotate(${normalizedRotation}deg);
            filter:drop-shadow(${statusShadow});
          "
        />
      </div>
    `,
    className: "leaflet-rotated-icon",
    iconSize: [wrapperWidth, wrapperHeight],
    iconAnchor: [wrapperWidth / 2, wrapperHeight / 2],
    popupAnchor: [0, -wrapperHeight / 2],
  });
};

export const getPlaybackEventRenderOptions = (event, presentation, visibleSpanBucket) => {
  const primary = event?.tone === "stop" || event?.tone === "speed";
  const secondary = event?.tone === "alert";
  const wideView = visibleSpanBucket >= 6;

  let scale = Number(presentation?.scale || 1);
  let showLabel =
    typeof event?.showMapLabel === "boolean"
      ? event.showMapLabel
      : Boolean(presentation?.showLabel);

  if (primary) {
    if (typeof event?.showMapLabel !== "boolean") {
      showLabel = true;
    }
    scale *= event?.tone === "stop" ? 1 : 0.98;
  } else if (secondary) {
    if (typeof event?.showMapLabel !== "boolean") {
      showLabel = !wideView && showLabel;
    }
    scale *= wideView ? 0.84 : 0.92;
  } else {
    if (typeof event?.showMapLabel !== "boolean") {
      showLabel = false;
    }
    scale *= wideView ? 0.72 : 0.8;
  }

  return {
    scale: Math.max(0.66, Math.min(scale, 1.28)),
    showLabel,
  };
};

export const offsetLatLngByMeters = (point, distanceMeters, angleDegrees) => {
  if (!Array.isArray(point) || point.length !== 2) return point;
  const lat = Number(point[0]);
  const lng = Number(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return point;

  const radians = (angleDegrees * Math.PI) / 180;
  const latOffset = (distanceMeters * Math.sin(radians)) / 111320;
  const lngOffset =
    (distanceMeters * Math.cos(radians)) /
    (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));

  return [lat + latOffset, lng + lngOffset];
};

export const buildPlaybackFallbackPath = (vehicle, existingPoints = []) => {
  const latitude = Number(vehicle?.latitude);
  const longitude = Number(vehicle?.longitude);
  const speed = Number(vehicle?.speed || 0);
  const heading = Number(vehicle?.angle_name || 0);
  const now = Date.now();

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return existingPoints;
  }

  if (existingPoints.length >= 2) return existingPoints;

  const seedPoints = existingPoints
    .map((point) => ({
      latitude: Number(point?.latitude ?? point?.lat),
      longitude: Number(point?.longitude ?? point?.lng),
      timestamp: Number(point?.timestamp || now),
    }))
    .filter(
      (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    );

  if (seedPoints.length === 1) {
    const anchor = seedPoints[0];
    const angleRad = (heading * Math.PI) / 180;
    const distanceFactor = Math.min(Math.max(speed / 120, 0.0003), 0.0015);
    const latOffset = Math.cos(angleRad) * distanceFactor;
    const lngOffset = Math.sin(angleRad) * distanceFactor;

    return [
      {
        latitude: Number((anchor.latitude - latOffset).toFixed(6)),
        longitude: Number((anchor.longitude - lngOffset).toFixed(6)),
        timestamp: anchor.timestamp - 10000,
      },
      anchor,
      {
        latitude,
        longitude,
        timestamp: now,
      },
    ];
  }

  if (!Number.isFinite(speed) || speed <= 0) {
    return [
      { latitude, longitude, timestamp: now - 10000 },
      { latitude, longitude, timestamp: now },
    ];
  }

  const angleRad = (heading * Math.PI) / 180;
  const distanceFactor = Math.min(Math.max(speed / 120, 0.0003), 0.0015);
  const latOffset = Math.cos(angleRad) * distanceFactor;
  const lngOffset = Math.sin(angleRad) * distanceFactor;

  return [
    {
      latitude: Number((latitude - latOffset * 2).toFixed(6)),
      longitude: Number((longitude - lngOffset * 2).toFixed(6)),
      timestamp: now - 20000,
    },
    {
      latitude: Number((latitude - latOffset).toFixed(6)),
      longitude: Number((longitude - lngOffset).toFixed(6)),
      timestamp: now - 10000,
    },
    {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      timestamp: now,
    },
  ];
};

export const getVehicleSourceTimestamp = (vehicle) => {
  const candidates = [
    vehicle?.timestamp,
    vehicle?.sourceTimestamp,
    vehicle?.gps_time,
    vehicle?.gpsTime,
    vehicle?.device_time,
    vehicle?.deviceTime,
    vehicle?.server_time,
    vehicle?.serverTime,
    vehicle?.last_update,
    vehicle?.lastUpdated,
    vehicle?.updatedAt,
    vehicle?.updated_at,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
};

export const getVehiclePathSamples = (vehicle) => {
  const normalizedPoints = (Array.isArray(vehicle?.path) ? vehicle.path : [])
    .map((point) => {
      const lat = Number(point?.latitude);
      const lng = Number(point?.longitude);
      const timestamp = Number(point?.timestamp || 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, timestamp: Number.isFinite(timestamp) ? timestamp : 0 };
    })
      .filter(Boolean)
      .filter((point, index, list) => {
        if (index === 0) return true;
        const previous = list[index - 1];
        return point.lat !== previous.lat || point.lng !== previous.lng;
      });

  const sourcePoints =
    normalizedPoints.length >= 2
      ? normalizedPoints
      : buildPlaybackFallbackPath(vehicle, normalizedPoints).map((point) => ({
          lat: Number(point?.latitude),
          lng: Number(point?.longitude),
          timestamp: Number(point?.timestamp || Date.now()),
        }));

  return sourcePoints.slice(-12);
};

export const getVehicleHeading = (vehicle, samples) => {
  const explicitHeading = Number(vehicle?.angle_name);
  if (Number.isFinite(explicitHeading)) {
    return normalizeAngle(explicitHeading);
  }

  const latestSampleHeading = Number(samples?.[samples.length - 1]?.heading);
  if (Number.isFinite(latestSampleHeading)) {
    return normalizeAngle(latestSampleHeading);
  }

  if (Array.isArray(samples) && samples.length >= 2) {
    const previous = samples[samples.length - 2];
    const latest = samples[samples.length - 1];
    return getBearing([previous.lat, previous.lng], [latest.lat, latest.lng]);
  }

  return 0;
};

export const buildVehiclePacketKey = (vehicle, fallbackKey = "") => {
  const lat = Number(vehicle?.latitude);
  const lng = Number(vehicle?.longitude);
  const speed = Number(vehicle?.speed ?? vehicle?.speed_kmh ?? 0);
  const heading = Number(vehicle?.angle_name ?? 0);
  const timestamp = getVehicleSourceTimestamp(vehicle);

  return [
    Number.isFinite(timestamp) ? timestamp : 0,
    Number.isFinite(lat) ? lat.toFixed(6) : "x",
    Number.isFinite(lng) ? lng.toFixed(6) : "y",
    Number.isFinite(speed) ? speed.toFixed(2) : "0",
    Number.isFinite(heading) ? heading.toFixed(2) : "0",
    fallbackKey || "",
  ].join("|");
};

export const getPlaybackDuration = (samples, fallbackDistanceMeters, fallbackSpeedKmh) => {
  const firstTimestamp = Number(samples?.[0]?.timestamp || 0);
  const lastTimestamp = Number(samples?.[samples.length - 1]?.timestamp || 0);
  const timestampDuration = lastTimestamp > firstTimestamp ? lastTimestamp - firstTimestamp : 0;
  if (timestampDuration >= 1500) {
    return Math.min(45000, Math.max(6000, timestampDuration));
  }

  const speedMs = Number(fallbackSpeedKmh) > 1 ? Number(fallbackSpeedKmh) / 3.6 : 0;
  if (speedMs > 0 && Number.isFinite(fallbackDistanceMeters) && fallbackDistanceMeters > 1) {
    return Math.min(45000, Math.max(6000, (fallbackDistanceMeters / speedMs) * 1000));
  }

  return 12000;
};

export const getPlaybackRangeLabel = (preset, vehicle, samplesOverride = null, customRange = null) => {
  const sourceSamples = Array.isArray(samplesOverride)
    ? samplesOverride
    : getVehiclePathSamples(vehicle);
  const samples = getPlaybackSamplesForPreset(sourceSamples, preset, customRange);
  const firstTimestamp = Number(samples[0]?.timestamp || 0);
  const lastTimestamp = Number(samples[samples.length - 1]?.timestamp || 0);

  if (firstTimestamp && lastTimestamp && lastTimestamp >= firstTimestamp) {
    return `${formatPlaybackStamp(firstTimestamp)} To ${formatPlaybackStamp(lastTimestamp)}`;
  }

  const now = new Date();
  const start = new Date(now);
  switch (preset) {
    case "Last 24 Hour":
      start.setTime(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "Yesterday":
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 0, 0);
      break;
    case "This Week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "Last Week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff - 7);
      start.setHours(0, 0, 0, 0);
      now.setTime(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      break;
    }
    case "This Month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "Last Month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      now.setMonth(start.getMonth() + 1, 0);
      now.setHours(23, 59, 0, 0);
      break;
    case "Custom":
      if (customRange?.start && customRange?.end) {
        const customStart = new Date(customRange.start);
        const customEnd = new Date(customRange.end);
        if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
          start.setTime(customStart.getTime());
          now.setTime(customEnd.getTime());
          break;
        }
      }
      start.setTime(now.getTime() - 12 * 60 * 60 * 1000);
      break;
    case "Today":
    default:
      start.setHours(0, 0, 0, 0);
      break;
  }

  return `${formatPlaybackStamp(start)} To ${formatPlaybackStamp(now)}`;
};

export const getVehiclePlaybackImei = (vehicle) =>
  String(
    vehicle?.imei_id ||
      vehicle?.imei ||
      vehicle?.imeiId ||
      vehicle?.device_id ||
      vehicle?.deviceId ||
      ""
  ).trim();

export const buildLatLngKey = (point) => {
  if (!Array.isArray(point) || point.length !== 2) return "";
  const lat = Number(point[0]);
  const lng = Number(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
};

export const buildCoordinateKey = (points) =>
  (points || [])
    .map((point) => {
      const lat = Number(point?.[0]);
      const lng = Number(point?.[1]);
      return `${lat.toFixed(6)},${lng.toFixed(6)}`;
    })
    .join("|");

export const safelySetLeafletMarkerLatLng = (marker, nextLatLng) => {
  if (!marker?.setLatLng || !marker?._map) return false;
  try {
    marker.setLatLng(nextLatLng);
    return true;
  } catch {
    return false;
  }
};

export const safelySetLeafletMarkerIcon = (marker, nextIcon) => {
  if (!marker?.setIcon || !marker?._map) return false;
  try {
    marker.setIcon(nextIcon);
    return true;
  } catch {
    return false;
  }
};

const createPlaybackEventDivIconBase = (className, color, label, shape, options = {}) => {
  const scale = Number(options?.scale || 1);
  const showLabel = options?.showLabel !== false;
  const size = Math.max(16, Math.round(22 * scale));
  const text = String(label || "").trim();

  return L.divIcon({
    className,
    html: `
      <div class="vtp-playback-event-badge vtp-playback-event-${String(shape || "dot")
        .trim()
        .toLowerCase()}">
        <span class="vtp-playback-event-dot" style="background:${color || "#2a7fff"}"></span>
        ${showLabel && text ? `<span class="vtp-playback-event-label">${text}</span>` : ""}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
  });
};

export const createPlaybackEventDivIcon = (label, tone, shape, options = {}) =>
  createPlaybackEventDivIconBase(`vtp-playback-event-icon vtp-tone-${String(tone || "default")}`, "#2a7fff", label, shape, options);

export const createCustomPlaybackEventDivIcon = (color, label, shape, options = {}) =>
  createPlaybackEventDivIconBase("vtp-playback-event-icon vtp-tone-custom", color, label, shape, options);

export const densifyPath = (path, stepMeters = 14) => {
  if (!Array.isArray(path) || path.length < 2) return path || [];
  const dense = [path[0]];

  for (let i = 0; i < path.length - 1; i += 1) {
    const start = path[i];
    const end = path[i + 1];
    const distance = haversineMeters(start, end);
    if (!Number.isFinite(distance) || distance <= 0) continue;

    const pointsToAdd = Math.max(1, Math.floor(distance / stepMeters));
    for (let j = 1; j <= pointsToAdd; j += 1) {
      const t = j / pointsToAdd;
      dense.push([
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ]);
    }
  }

  return dense;
};

export const smoothPathPositions = (path, passes = 2) => {
  if (!Array.isArray(path) || path.length < 3) return path || [];

  let output = [...path];
  for (let pass = 0; pass < passes; pass += 1) {
    output = output.map((point, index, source) => {
      if (index === 0 || index === source.length - 1) return point;
      const previous = source[index - 1];
      const next = source[index + 1];
      return [
        previous[0] * 0.2 + point[0] * 0.6 + next[0] * 0.2,
        previous[1] * 0.2 + point[1] * 0.6 + next[1] * 0.2,
      ];
    });
  }

  return output;
};
