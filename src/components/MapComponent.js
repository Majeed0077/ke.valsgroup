// src/components/MapComponent.js
"use client";

import React, { useDeferredValue, useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  Circle,
  CircleMarker,
} from "react-leaflet";
import MapControls from "@/components/MapControls";
import ObjectListPanel from "@/components/map/ObjectListPanel";
import { GeofenceDisplayLayer, GeofenceDrawControl, MapScaleControl } from "@/components/map/layers/MapSupportLayers";
import { BaseVehicleMarker } from "@/components/map/markers/VehicleMarkers";
import ClusterHoverLayer from "@/components/map/features/live/ClusterHoverLayer";
import ClusterLayer from "@/components/map/features/live/ClusterLayer";
import LiveVehicleLayer from "@/components/map/features/live/LiveVehicleLayer";
import SelectionLayer from "@/components/map/features/live/SelectionLayer";
import VehicleClusterLayer from "@/components/map/features/live/VehicleClusterLayer";
import useLiveMapState from "@/components/map/features/live/useLiveMapState";
import PlaybackBottomBar from "@/components/map/features/playback/PlaybackBottomBar";
import PlaybackMapLayer from "@/components/map/features/playback/PlaybackMapLayer";
import PlaybackOverlays from "@/components/map/features/playback/PlaybackOverlays";
import PlaybackPanels from "@/components/map/features/playback/PlaybackPanels";
import usePlaybackController from "@/components/map/features/playback/usePlaybackController";
import usePlaybackMetrics from "@/components/map/features/playback/usePlaybackMetrics";
import { createClusterIcon, buildClusterStatusSummary, buildClusterRingGradient } from "@/components/map/clusterHelpers";
import {
  CLUSTER_DISABLE_AREA_KM,
  CLUSTER_ENABLE_AREA_KM,
  CLUSTER_SWITCH_AREA_KM,
  CLUSTER_SWITCH_ZOOM,
  buildOverviewBounds,
  DEFAULT_OVERVIEW_FIT_PADDING_BOTTOM_RIGHT,
  DEFAULT_OVERVIEW_FIT_PADDING_TOP_LEFT,
  DEFAULT_OVERVIEW_FIT_ZOOM,
  DEFAULT_OVERVIEW_MIN_SPAN_KM,
  DEFAULT_VISIBLE_SPAN_BUCKET_LIMITS,
  dedupeVehicleList,
  getClusterRadiusPxForBucket,
  MAX_VIEWPORT_OPEN_VEHICLES,
  PANEL_SWITCH_OVERLAY_MS,
  PANEL_SWITCH_PREP_MS,
  getVehicleIdentity,
  getVisibleSpanBucket,
  getVisibleSpanKm,
  SOFT_MAP_DURATION,
  SOFT_MAP_EASE,
  smoothFocusMapToBounds,
  smoothFocusMapToPoint,
  userLocationIcon,
} from "@/components/map/viewportHelpers";
import { PANEL_MOBILE_STATUS_FILTER_EVENT } from "@/components/Panels";
import { getIconForVehicle } from "@/components/map/vehicleIcons";
import {
  FaSearch,
  FaSyncAlt,
} from "react-icons/fa";
import L from "leaflet";
import "leaflet-draw";
import "leaflet.markercluster";
import { fetchSnapppedRoute } from "@/utils/osrm";
import {
  getVehicleDisplayIgnitionState,
  getVehicleStatusKey,
  VEHICLE_STATUS_COLORS,
} from "@/lib/vehicleStatus";
import {
  OBJECT_STATUS_LABELS,
  getObjectListGroupLabel,
  getObjectListOrganizationLabel,
  getObjectListSignalText,
  getObjectListStatusKey,
  getObjectListVehicleLabel,
} from "@/components/map/objectListUtils";
import {
  buildDefaultCustomPlaybackRange,
  buildCoordinateKey,
  buildPlaybackFallbackPath,
  buildVehiclePacketKey,
  buildLatLngKey,
  createRotatedDivIcon,
  createCustomPlaybackEventDivIcon,
  createPlaybackEventDivIcon,
  formatDateTimeLocalInputValue,
  formatPlaybackApiDateTime,
  formatPlaybackOdometer,
  formatPlaybackSpeed,
  densifyPath,
  getPlaybackRangeLabel,
  getPlaybackSamplesForPreset,
  getPlaybackWindowMs,
  getRecentPlaybackSamples,
  getVehicleHeading,
  getVehiclePathSamples,
  getVehiclePlaybackImei,
  getVehicleSourceTimestamp,
  normalizeAngle,
  safelySetLeafletMarkerLatLng,
  resolvePlaybackPresetDateRange,
  shortestAngleDelta,
  smoothHeading,
  smoothPathPositions,
} from "@/components/map/mapHelpers";

const MAX_MAP_ZOOM = 20;
const MIN_TRACKING_MAP_ZOOM = 2;
const DEFAULT_MAP_CENTER = [27.45, 69.85];
const DEFAULT_MAP_ZOOM = 7;
const MAX_LABEL_RENDER_VEHICLES = 60;
const CLUSTER_SUMMARY_CHILD_SCAN_LIMIT = 80;
const INTERACTION_ICON_LITE_HOLD_MS = 220;
const VISIBLE_SPAN_BUCKET_LIMITS = DEFAULT_VISIBLE_SPAN_BUCKET_LIMITS;
const CLUSTER_SWITCH_AREA_BUCKET = getVisibleSpanBucket(CLUSTER_SWITCH_AREA_KM);
const PANEL_SWITCH_CLUSTER_RESET_BUCKET = getVisibleSpanBucket(CLUSTER_SWITCH_AREA_KM * 1.35);
const PLAYBACK_OPTIONS = [
  "Today",
  "Last 24 Hour",
  "Yesterday",
  "This Week",
  "This Month",
  "Custom",
];
const PLAYBACK_SPEED_OPTIONS = [1, 2, 4, 8];
const PLAYBACK_API_RECORD_LIMIT = 100;
const PLAYBACK_SETTINGS_STORAGE_KEY = "vtp-playback-settings-v1";
const PLAYBACK_MINUTE_OPTIONS = Array.from({ length: 61 }, (_, index) => index);
const PLAYBACK_SPEED_LIMIT_OPTIONS = Array.from({ length: 101 }, (_, index) => index + 20);
const LIVE_MOTION_STEP_MS = 2500;
const LIVE_MOTION_MIN_STEP_MS = 2200;
const LIVE_MOTION_MAX_STEP_MS = 8000;
const LIVE_MOTION_TARGET_LAG_MS = 700;
const MARKER_ROTATION_REDRAW_THRESHOLD_DEG = 8;
const PLAYBACK_SPEED_FILTER_OPTIONS = [
  { value: "moreThan", label: "Speed more than" },
  { value: "lessThan", label: "Speed less than" },
];
const PLAYBACK_CALCULATION_OPTIONS = ["Ignition", "Speed"];
const PLAYBACK_ALERT_FILTER_OPTIONS = ["All", "Harsh Braking", "Ignition/ACC", "Idle"];
const PLAYBACK_SHARE_VALIDITY_OPTIONS = [
  "30 Minutes",
  "1 Hour",
  "2 Hours",
  "6 Hours",
  "12 Hours",
  "24 Hours",
];
const PLAYBACK_SEAT_BELT_OPTIONS = [
  "Emergency Lights",
  "Seat Belt",
  "Air Conditioner",
  "Center Broom",
  "Left Broom",
  "Right Broom",
  "Rear Nozzle",
];
const MOBILE_PANEL_FILTER_BREAKPOINT = 768;
const DEFAULT_PLAYBACK_SETTINGS = {
  tripCalculation: true,
  speeding: true,
  inactive: false,
  fuel: false,
  seatBelt: false,
  tollInformation: false,
  opalEvent: false,
  route: true,
  stoppage: true,
  idle: false,
  alerts: true,
  dataPoints: false,
};
const DEFAULT_PLAYBACK_THRESHOLDS = {
  calculationMode: "Ignition",
  stoppageMinutes: 20,
  idleMinutes: 5,
  speedComparison: "moreThan",
  speedLimit: 40,
  alertFilters: ["All"],
  seatBeltMode: "Seat Belt",
  tollColor: "#7c3aed",
};

const TILE_CONFIG = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: MAX_MAP_ZOOM,
  },
  google_roadmap: {
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "Map data © Google",
    maxZoom: MAX_MAP_ZOOM,
  },
  google_satellite: {
    url: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "Imagery © Google",
    maxZoom: MAX_MAP_ZOOM,
  },
  google_hybrid: {
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "Imagery © Google",
    maxZoom: MAX_MAP_ZOOM,
  },
  google_terrain: {
    url: "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    attribution: "Map data © Google",
    maxZoom: MAX_MAP_ZOOM,
  },
};

const TOMTOM_TRAFFIC_API_KEY = String(
  process.env.NEXT_PUBLIC_TOMTOM_TRAFFIC_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || ""
).trim();
const TRAFFIC_TILE_CONFIG = TOMTOM_TRAFFIC_API_KEY
  ? {
      url: `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_TRAFFIC_API_KEY}&tileSize=512`,
      attribution: "Traffic data © TomTom",
    }
  : null;

const SATELLITE_LABELS_CONFIG = {
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  attribution:
    "Labels &copy; Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), OpenStreetMap contributors, and the GIS User Community",
};

const SATELLITE_DETAIL_LABELS_CONFIG = {
  url: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: "abcd",
};

const MAP_TYPE_ALIASES = {
  default: "osm",
  satellite: "google_satellite",
};

const isGoogleRasterMapType = (mapType) => String(mapType || "").startsWith("google_");

const getBaseTileRenderProfile = (mapType) => {
  const isGoogleRaster = isGoogleRasterMapType(mapType);
  return {
    keepBuffer: isGoogleRaster ? 16 : 10,
    updateWhenZooming: true,
    updateWhenIdle: false,
    updateInterval: isGoogleRaster ? 140 : 110,
    detectRetina: !isGoogleRaster,
  };
};

const getOverlayTileRenderProfile = (mapType) => {
  const isGoogleRaster = isGoogleRasterMapType(mapType);
  return {
    keepBuffer: isGoogleRaster ? 10 : 6,
    updateWhenZooming: true,
    updateWhenIdle: false,
    updateInterval: isGoogleRaster ? 160 : 130,
    detectRetina: !isGoogleRaster,
  };
};

// --- Leaflet Default Icon Fix (Unchanged) ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const snappedRouteCache = new Map();
const liveSegmentRouteCache = new Map();
const liveSegmentRouteInflight = new Map();
const DEFAULT_BUBBLE_ANIMATION_LIMIT_DESKTOP = 20;
const DEFAULT_BUBBLE_ANIMATION_LIMIT_MOBILE = 10;
const EXPERIMENTAL_CLUSTER_ENGINE = String(
  process.env.NEXT_PUBLIC_EXPERIMENTAL_CLUSTER_ENGINE || "legacy"
).trim().toLowerCase();
// UX requirement: opening the object list should NOT visually "break" a cluster into individual vehicles.
// Keep this off unless we introduce a separate "animate vehicles" toggle in the object list UI.
const ENABLE_BUBBLE_VEHICLE_EXPANSION = false;

const haveSameIds = (left, right) => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const safelySetLeafletMarkerIcon = (marker, nextIcon) => {
  if (!marker?.setIcon || !marker?._map) return false;
  try {
    marker.setIcon(nextIcon);
    return true;
  } catch {
    return false;
  }
};

const buildCanonicalVehicleRevision = (vehicle) => {
  const identity = String(getVehicleIdentity(vehicle) || "");
  return [
    identity,
    Number(vehicle?.latitude).toFixed(6),
    Number(vehicle?.longitude).toFixed(6),
    Number(vehicle?.angle_name ?? vehicle?.angle ?? 0).toFixed(2),
    Number(vehicle?.speed_kmh ?? vehicle?.speed ?? 0).toFixed(2),
    getVehicleStatusKey(vehicle),
    getVehicleSourceTimestamp(vehicle) || 0,
  ].join("|");
};

const matchesPanelFocusVehicle = (vehicle, focusId) =>
  [
    vehicle?.imei_id,
    vehicle?.vehicle_no,
    vehicle?.obj_reg_no,
    vehicle?.obj_name,
    vehicle?.vehicle_name,
  ].some((value) => String(value || "").trim().toLowerCase() === focusId);

const createEmptyCanonicalVehicleStore = () => ({
  registry: new Map(),
  orderedIds: [],
  activeRegistry: new Map(),
  activeOrderedIds: [],
  changedIds: [],
  unchangedIds: [],
  removedIds: [],
  lastGoodRegistry: new Map(),
  lastGoodOrderedIds: [],
  lastGoodUpdatedAt: 0,
  source: "empty",
});

const buildCanonicalVehicleStoreState = (previousState, vehicles) => {
  const previousRegistry = previousState?.registry || new Map();
  const previousOrderedIds = Array.isArray(previousState?.orderedIds) ? previousState.orderedIds : [];
  const nextRegistry = new Map();
  const orderedIds = [];
  const changedIds = [];
  const unchangedIds = [];

  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    const id = String(getVehicleIdentity(vehicle) || "");
    if (!id) return;
    const revision = buildCanonicalVehicleRevision(vehicle);
    const previousEntry = previousRegistry.get(id);
    const stableVehicle =
      previousEntry?.revision === revision ? previousEntry.vehicle : vehicle;

    nextRegistry.set(id, { vehicle: stableVehicle, revision });
    orderedIds.push(id);

    if (previousEntry?.revision === revision) {
      unchangedIds.push(id);
    } else {
      changedIds.push(id);
    }
  });

  const nextIdSet = new Set(orderedIds);
  const removedIds = previousOrderedIds.filter((id) => !nextIdSet.has(id));
  const hasCurrentSnapshot = orderedIds.length > 0;
  const lastGoodRegistry = hasCurrentSnapshot
    ? nextRegistry
    : previousState?.lastGoodRegistry || previousRegistry || new Map();
  const lastGoodOrderedIds = hasCurrentSnapshot
    ? orderedIds
    : Array.isArray(previousState?.lastGoodOrderedIds) && previousState.lastGoodOrderedIds.length
      ? previousState.lastGoodOrderedIds
      : previousOrderedIds;
  const lastGoodUpdatedAt = hasCurrentSnapshot
    ? Date.now()
    : Number(previousState?.lastGoodUpdatedAt || 0);
  const activeRegistry = hasCurrentSnapshot ? nextRegistry : lastGoodRegistry;
  const activeOrderedIds = hasCurrentSnapshot ? orderedIds : lastGoodOrderedIds;

  return {
    registry: nextRegistry,
    orderedIds,
    activeRegistry,
    activeOrderedIds,
    changedIds,
    unchangedIds,
    removedIds,
    lastGoodRegistry,
    lastGoodOrderedIds,
    lastGoodUpdatedAt,
    source: hasCurrentSnapshot ? "current" : activeOrderedIds.length ? "last-good" : "empty",
  };
};

const buildVehicleIdSignature = (vehicles) =>
  (Array.isArray(vehicles) ? vehicles : [])
    .map((vehicle) => String(getVehicleIdentity(vehicle) || ""))
    .filter(Boolean)
    .join("|");


const getClusteredVehicleIdSet = (vehicles, map, zoom, clusterRadiusPx = 72) => {
  if (!Array.isArray(vehicles) || vehicles.length < 2 || !map) {
    return new Set();
  }

  const radius = Math.max(1, Number(clusterRadiusPx) || 72);
  const cellSize = radius; // Any pair within `radius` must live in same or adjacent cell.

  const pts = vehicles
    .map((vehicle) => {
      const lat = Number(vehicle?.latitude);
      const lng = Number(vehicle?.longitude);
      const id = getVehicleIdentity(vehicle);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !id) return null;
      const projected = map.project(L.latLng(lat, lng), zoom);
      return { id, projected };
    })
    .filter(Boolean);

  if (pts.length < 2) return new Set();

  const parent = pts.map((_, i) => i);
  const find = (x) => {
    let p = x;
    while (parent[p] !== p) p = parent[p];
    while (parent[x] !== x) {
      const next = parent[x];
      parent[x] = p;
      x = next;
    }
    return p;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const grid = new Map();
  const toCellKey = (x, y) => `${x}:${y}`;

  for (let i = 0; i < pts.length; i += 1) {
    const point = pts[i].projected;
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = grid.get(toCellKey(cellX + dx, cellY + dy));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k += 1) {
          const j = bucket[k];
          if (point.distanceTo(pts[j].projected) <= radius) {
            union(i, j);
          }
        }
      }
    }

    const ownKey = toCellKey(cellX, cellY);
    const existing = grid.get(ownKey);
    if (existing) {
      existing.push(i);
    } else {
      grid.set(ownKey, [i]);
    }
  }

  const groupSizes = new Map();
  for (let i = 0; i < pts.length; i += 1) {
    const root = find(i);
    groupSizes.set(root, (groupSizes.get(root) || 0) + 1);
  }

  const clusteredIds = new Set();
  for (let i = 0; i < pts.length; i += 1) {
    const root = find(i);
    if ((groupSizes.get(root) || 0) > 1) {
      clusteredIds.add(pts[i].id);
    }
  }

  return clusteredIds;
};

const getClusteredVehicleIdSetProjectedGroups = (vehicles, map, zoom, clusterRadiusPx = 72) => {
  const rows = buildProjectedVehicleRows(vehicles, map, zoom);
  if (rows.length < 2) return new Set();

  const groupedRows = clusterProjectedVehicleRows(rows, clusterRadiusPx);
  const clusteredIds = new Set();
  groupedRows.forEach((group) => {
    if (!Array.isArray(group) || group.length < 2) return;
    group.forEach((row) => {
      const id = String(row?.id || "");
      if (id) clusteredIds.add(id);
    });
  });
  return clusteredIds;
};

const getViewportVehicleIdSet = (vehicles, map, paddingRatio = 0.08) => {
  if (!Array.isArray(vehicles) || vehicles.length === 0 || !map?.getBounds) {
    return new Set();
  }

  const bounds = map.getBounds?.();
  if (!bounds?.isValid?.()) return new Set();

  const paddedBounds =
    typeof bounds.pad === "function" ? bounds.pad(Math.max(0, Number(paddingRatio) || 0)) : bounds;

  const visibleIds = new Set();
  vehicles.forEach((vehicle) => {
    const lat = Number(vehicle?.latitude);
    const lng = Number(vehicle?.longitude);
    const id = getVehicleIdentity(vehicle);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !id) return;
    if (paddedBounds.contains?.(L.latLng(lat, lng))) {
      visibleIds.add(String(id));
    }
  });

  return visibleIds;
};

const getVehicleStatusShadow = (statusKey) => (
  statusKey === "running"
    ? "0 3px 7px rgba(35, 124, 34, 0.28)"
    : statusKey === "idle"
      ? "0 3px 7px rgba(177, 123, 18, 0.28)"
      : statusKey === "stopped"
        ? "0 3px 7px rgba(179, 44, 39, 0.28)"
        : statusKey === "inactive"
          ? "0 3px 7px rgba(47, 111, 228, 0.28)"
          : "0 3px 7px rgba(120, 127, 145, 0.28)"
);

const buildProjectedVehicleRows = (vehicles, map, zoom = Number(map?.getZoom?.() ?? DEFAULT_MAP_ZOOM)) => {
  if (!map || !Array.isArray(vehicles) || vehicles.length === 0) return [];

  return vehicles
    .map((vehicle) => {
      const lat = Number(vehicle?.latitude);
      const lng = Number(vehicle?.longitude);
      const id = getVehicleIdentity(vehicle);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !id) return null;

      const latLng = L.latLng(lat, lng);
      const projected = map.project(latLng, zoom);
      const containerPoint = map.latLngToContainerPoint(latLng);
      return {
        id: String(id),
        vehicle,
        latLng,
        projected,
        containerPoint,
      };
    })
    .filter(Boolean);
};

const clusterProjectedVehicleRows = (rows, clusterRadiusPx = 72) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (rows.length === 1) return [[rows[0]]];

  const radius = Math.max(1, Number(clusterRadiusPx) || 72);
  const cellSize = radius;
  const parent = rows.map((_, index) => index);

  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };

  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const grid = new Map();
  const toCellKey = (x, y) => `${x}:${y}`;

  for (let index = 0; index < rows.length; index += 1) {
    const point = rows[index].projected;
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = grid.get(toCellKey(cellX + dx, cellY + dy));
        if (!bucket) continue;
        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
          const neighborIndex = bucket[bucketIndex];
          if (point.distanceTo(rows[neighborIndex].projected) <= radius) {
            union(index, neighborIndex);
          }
        }
      }
    }

    const ownKey = toCellKey(cellX, cellY);
    const existing = grid.get(ownKey);
    if (existing) existing.push(index);
    else grid.set(ownKey, [index]);
  }

  const grouped = new Map();
  for (let index = 0; index < rows.length; index += 1) {
    const root = find(index);
    const existing = grouped.get(root);
    if (existing) existing.push(rows[index]);
    else grouped.set(root, [rows[index]]);
  }

  return Array.from(grouped.values());
};

const getClusterMarkerVisualKey = (vehicle, baseIcon, heading) =>
  [
    baseIcon?.options?.iconUrl || "",
    Math.round(Number(heading) || 0),
    getVehicleStatusKey(vehicle),
  ].join("|");

const toValidLatLngPair = (point) => {
  if (!Array.isArray(point) || point.length < 2) return null;
  const lat = Number(point[0]);
  const lng = Number(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

const buildConvexHull = (points) => {
  if (!Array.isArray(points) || points.length < 3) return points || [];

  const sorted = [...points].sort((a, b) => {
    if (a[1] === b[1]) return a[0] - b[0];
    return a[1] - b[1];
  });

  const cross = (o, a, b) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);

  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
};

const buildBoundsRect = (points) => {
  if (!Array.isArray(points) || points.length === 0) return null;

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];

  for (let i = 1; i < points.length; i += 1) {
    const [lat, lng] = points[i];
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const latPad = Math.max(0.0045, (maxLat - minLat) * 0.6);
  const lngPad = Math.max(0.0045, (maxLng - minLng) * 0.6);

  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ];
};

const expandPointsByMeters = (points, meters = 520) => {
  if (!Array.isArray(points) || points.length === 0) return [];
  const center = points.reduce(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
    [0, 0]
  );
  const centerLat = center[0] / points.length;
  const centerLng = center[1] / points.length;
  const latMeters = 111320;
  const lngMeters = Math.max(20000, 111320 * Math.cos((centerLat * Math.PI) / 180));

  return points.map(([lat, lng]) => {
    const dLatDeg = lat - centerLat;
    const dLngDeg = lng - centerLng;
    const dLatMeters = dLatDeg * latMeters;
    const dLngMeters = dLngDeg * lngMeters;
    const dist = Math.hypot(dLatMeters, dLngMeters);

    if (dist < 1) {
      const nudgeLat = meters / latMeters;
      const nudgeLng = meters / lngMeters;
      return [lat + nudgeLat, lng + nudgeLng];
    }

    const scale = (dist + meters) / dist;
    return [
      centerLat + (dLatMeters * scale) / latMeters,
      centerLng + (dLngMeters * scale) / lngMeters,
    ];
  });
};

const buildClusterHoverGeometry = (rawPoints) => {
  const normalized = (rawPoints || [])
    .map(toValidLatLngPair)
    .filter(Boolean);

  if (normalized.length < 2) {
    return { hull: [], bounds: null };
  }

  const unique = [];
  const seen = new Set();
  normalized.forEach((point) => {
    const key = `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(point);
  });

  if (unique.length < 3) {
    return { hull: [], bounds: buildBoundsRect(unique) };
  }

  const hull = buildConvexHull(unique);
  if (hull.length < 3) {
    return { hull: [], bounds: buildBoundsRect(unique) };
  }

  return { hull: expandPointsByMeters(hull, 520), bounds: null };
};

const ClusterTransitionNode = ({ node, style }) => {
  if (!node) return null;

  if (node.kind === "cluster") {
    const size = Number(node.size || 44);
    const ringSize = Math.max(8, Math.round(size * 0.18));
    const ringWidth = Math.max(4, Math.round(size * 0.09));

    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: `${size}px`,
          height: `${size}px`,
          marginLeft: `${-size / 2}px`,
          marginTop: `${-size / 2}px`,
          borderRadius: "999px",
          pointerEvents: "none",
          ...style,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: `${Math.round(ringSize * -0.5)}px`,
            borderRadius: "999px",
            background: node.ringGradient,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${ringWidth}px), #000 calc(100% - ${ringWidth}px))`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${ringWidth}px), #000 calc(100% - ${ringWidth}px))`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "999px",
            background: "linear-gradient(165deg, #ff7e55 0%, #ff6842 52%, #ff512f 100%)",
            border: "1px solid rgba(255,255,255,0.65)",
            boxShadow: "0 8px 18px rgba(18,23,32,0.24), inset 0 1px 0 rgba(255,255,255,0.95)",
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: `${Math.max(14, Math.round(size * 0.28))}px`,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {node.count}
          </span>
        </div>
      </div>
    );
  }

  const width = Number(node.iconWidth || 36);
  const height = Number(node.iconHeight || 36);
  const shellSize = Math.max(width, height) + 10;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: `${shellSize}px`,
        height: `${shellSize}px`,
        marginLeft: `${-shellSize / 2}px`,
        marginTop: `${-shellSize / 2}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        ...style,
      }}
    >
      {/* Leaflet-style rotating marker overlay needs a plain img for exact sizing/transform behavior. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.iconUrl}
        alt=""
        draggable={false}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: "block",
          transformOrigin: "center",
          transform: `rotate(${Number(node.rotation || 0)}deg)`,
          filter: `drop-shadow(${node.statusShadow})`,
          userSelect: "none",
        }}
      />
    </div>
  );
};

const ClusterTransitionOverlay = ({ transition }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!transition?.id) return undefined;
    setIsAnimating(false);
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [transition?.id]);

  if (!transition) return null;

  const durationMs = Number(transition.durationMs || 240);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1202,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {transition.fromNodes.map((node) => {
        const targetNode = transition.sourceTargets.get(node.key) || node;
        return (
          <ClusterTransitionNode
            key={`from-${transition.id}-${node.key}`}
            node={node}
            style={{
              transform: `translate(${isAnimating ? targetNode.x : node.x}px, ${isAnimating ? targetNode.y : node.y}px) scale(${isAnimating ? 0.72 : 1})`,
              opacity: isAnimating ? 0 : 1,
              transition: `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(durationMs * 0.78)}ms ease-out`,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
      {transition.toNodes.map((node) => {
        const originNode = transition.targetOrigins.get(node.key) || node;
        return (
          <ClusterTransitionNode
            key={`to-${transition.id}-${node.key}`}
            node={node}
            style={{
              transform: `translate(${isAnimating ? node.x : originNode.x}px, ${isAnimating ? node.y : originNode.y}px) scale(${isAnimating ? 1 : 0.72})`,
              opacity: isAnimating ? 1 : 0,
              transition: `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(durationMs * 0.9)}ms ease-out`,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
};

const ClusterSnapshotOverlay = ({ nodes }) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1202,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {nodes.map((node) => (
        <ClusterTransitionNode
          key={`snapshot-${node.key}`}
          node={node}
          style={{
            transform: `translate(${node.x}px, ${node.y}px) scale(1)`,
            opacity: 1,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
};

const MapZoomBridge = ({ onZoomChange }) => {
  const rafRef = React.useRef(null);
  useMapEvents({
    zoomend: (event) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const zoom = event.target.getZoom();
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        React.startTransition(() => {
          onZoomChange?.(zoom);
        });
      });
    },
  });
  return null;
};


const PlaybackPreviewFitBounds = ({ routePath, markerPoints }) => {
  const map = useMap();

  useEffect(() => {
    const bounds = [];
    if (Array.isArray(routePath)) {
      routePath.forEach((point) => {
        if (Array.isArray(point) && point.length === 2) bounds.push(point);
      });
    }
    if (Array.isArray(markerPoints)) {
      markerPoints.forEach((point) => {
        if (Array.isArray(point) && point.length === 2) bounds.push(point);
      });
    }
    if (bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16, { animate: false });
    }
  }, [map, markerPoints, routePath]);

  return null;
};

const PlaybackPrintPreviewMap = ({
  mapType,
  resolvedTileConfig,
  routePath,
  events,
  vehicle,
  samples,
  markerInfo,
}) => {
  const resolvedMapType = MAP_TYPE_ALIASES[mapType] || mapType || "osm";
  const baseTileRenderProfile = useMemo(
    () => getBaseTileRenderProfile(resolvedMapType),
    [resolvedMapType]
  );
  const overlayTileRenderProfile = useMemo(
    () => getOverlayTileRenderProfile(resolvedMapType),
    [resolvedMapType]
  );
  const previewCenter = useMemo(() => {
    if (Array.isArray(routePath) && routePath.length) return routePath[routePath.length - 1];
    const lat = Number(vehicle?.latitude);
    const lng = Number(vehicle?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : DEFAULT_MAP_CENTER;
  }, [routePath, vehicle?.latitude, vehicle?.longitude]);
  const previewIcon = useMemo(() => {
    const heading = getVehicleHeading(vehicle, samples);
    return createRotatedDivIcon(getIconForVehicle(vehicle), heading, vehicle);
  }, [samples, vehicle]);
  const markerPoints = useMemo(
    () => [
      ...(Array.isArray(events) ? events.map((event) => event?.position).filter(Boolean) : []),
      previewCenter,
    ],
    [events, previewCenter]
  );

  return (
    <MapContainer
      center={previewCenter}
      zoom={15}
      zoomControl
      attributionControl={false}
      dragging={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      touchZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution={resolvedTileConfig.attribution}
        url={resolvedTileConfig.url}
        maxZoom={resolvedTileConfig.maxZoom || MAX_MAP_ZOOM}
      />
      <PlaybackPreviewFitBounds routePath={routePath} markerPoints={markerPoints} />
      {routePath.length >= 2 ? (
        <>
          <Polyline
            positions={routePath}
            pathOptions={{
              color: "#ffffff",
              weight: 6.2,
              opacity: 0.96,
              lineCap: "round",
              lineJoin: "round",
              interactive: false,
            }}
          />
          <Polyline
            positions={routePath}
            pathOptions={{
              color: "#1295f3",
              weight: 3.8,
              opacity: 0.98,
              lineCap: "round",
              lineJoin: "round",
              interactive: false,
            }}
          />
        </>
      ) : null}
      {events.map((event) => (
        <Marker
          key={`print-${event.key}`}
          position={event.position}
          icon={
            event.tone === "custom"
              ? createCustomPlaybackEventDivIcon(event.color, event.label, event.shape, {
                  scale: 1,
                  showLabel: event.showMapLabel,
                })
              : createPlaybackEventDivIcon(event.label, event.tone, event.shape, {
                  scale: 1,
                  showLabel: event.showMapLabel,
                })
          }
          interactive={false}
        />
      ))}
      {vehicle ? (
        <Marker position={previewCenter} icon={previewIcon} interactive={false}>
          {markerInfo?.label ? (
            <Tooltip
              direction="right"
              offset={[18, -4]}
              interactive={false}
              opacity={1}
              className="vtp-playback-marker-tooltip"
            >
              <span className="vtp-playback-marker-tooltip-text">{markerInfo.label}</span>
            </Tooltip>
          ) : null}
        </Marker>
      ) : null}
    </MapContainer>
  );
};

const MapCanvas = React.memo(function MapCanvas({
  mapKey,
  handleMapReady,
  setCurrentZoom,
  resolvedMapType,
  resolvedTileConfig,
  baseTileRenderProfile,
  overlayTileRenderProfile,
  showTrafficLayer,
  showLabelsLayer,
  clusterHoverGeometry,
  liveRenderState,
  activeClusterFilter,
  playbackScene,
  visibleSpanBucket,
  userLocation,
  userLocationIcon,
  geofences,
  onGeofenceCreated,
  geofenceToolbarCollapsed,
}) {
  return (
    <MapContainer
      key={mapKey}
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      minZoom={MIN_TRACKING_MAP_ZOOM}
      maxZoom={MAX_MAP_ZOOM}
      preferCanvas={true}
      zoomAnimation={true}
      fadeAnimation={false}
      markerZoomAnimation={true}
      zoomControl={false}
      scrollWheelZoom={true}
      whenReady={handleMapReady}
      style={{ height: "100%", width: "100%" }}
    >
      <MapZoomBridge onZoomChange={setCurrentZoom} />
      <MapScaleControl />
      <TileLayer
        key={`base-${resolvedMapType}`}
        attribution={resolvedTileConfig.attribution}
        url={resolvedTileConfig.url}
        maxZoom={resolvedTileConfig.maxZoom || MAX_MAP_ZOOM}
        subdomains={
          String(resolvedMapType || "").startsWith("google_")
            ? ["mt0", "mt1", "mt2", "mt3"]
            : resolvedTileConfig.subdomains
        }
        keepBuffer={baseTileRenderProfile.keepBuffer}
        updateWhenZooming={baseTileRenderProfile.updateWhenZooming}
        updateWhenIdle={baseTileRenderProfile.updateWhenIdle}
        updateInterval={baseTileRenderProfile.updateInterval}
        reuseTiles={true}
        detectRetina={baseTileRenderProfile.detectRetina}
      />
      {showTrafficLayer && TRAFFIC_TILE_CONFIG ? (
        <TileLayer
          key="traffic-overlay"
          attribution={TRAFFIC_TILE_CONFIG.attribution}
          url={TRAFFIC_TILE_CONFIG.url}
          opacity={0.92}
          keepBuffer={overlayTileRenderProfile.keepBuffer}
          updateWhenZooming={overlayTileRenderProfile.updateWhenZooming}
          updateWhenIdle={overlayTileRenderProfile.updateWhenIdle}
          updateInterval={overlayTileRenderProfile.updateInterval}
          reuseTiles={true}
          detectRetina={overlayTileRenderProfile.detectRetina}
        />
      ) : null}
      {resolvedMapType === "google_satellite" && showLabelsLayer ? (
        <>
          <TileLayer
            key="satellite-place-labels"
            attribution={SATELLITE_LABELS_CONFIG.attribution}
            url={SATELLITE_LABELS_CONFIG.url}
            opacity={0.9}
            keepBuffer={overlayTileRenderProfile.keepBuffer}
            updateWhenZooming={overlayTileRenderProfile.updateWhenZooming}
            updateWhenIdle={overlayTileRenderProfile.updateWhenIdle}
            updateInterval={overlayTileRenderProfile.updateInterval}
            reuseTiles={true}
            detectRetina={overlayTileRenderProfile.detectRetina}
          />
          <TileLayer
            key="satellite-detail-labels"
            attribution={SATELLITE_DETAIL_LABELS_CONFIG.attribution}
            url={SATELLITE_DETAIL_LABELS_CONFIG.url}
            subdomains={SATELLITE_DETAIL_LABELS_CONFIG.subdomains}
            opacity={0.95}
            keepBuffer={overlayTileRenderProfile.keepBuffer}
            updateWhenZooming={overlayTileRenderProfile.updateWhenZooming}
            updateWhenIdle={overlayTileRenderProfile.updateWhenIdle}
            updateInterval={overlayTileRenderProfile.updateInterval}
            reuseTiles={true}
            detectRetina={overlayTileRenderProfile.detectRetina}
          />
        </>
      ) : null}

      <ClusterHoverLayer clusterHoverGeometry={clusterHoverGeometry} />

      <ClusterLayer
        {...liveRenderState}
        activeClusterFilter={activeClusterFilter}
        ClusterRenderer={VehicleClusterLayer}
      />

      <LiveVehicleLayer
        {...liveRenderState}
        playbackScene={playbackScene}
      />

      <SelectionLayer
        selectedCenter={liveRenderState.selectedCenter}
        isSelectedVehicleClustered={liveRenderState.isSelectedVehicleClustered}
        selectedVehiclePlaybackActive={liveRenderState.selectedVehiclePlaybackActive}
      />

      {playbackScene.shouldRenderPlaybackMapState ? (
        <PlaybackMapLayer playbackScene={playbackScene} />
      ) : null}

      {userLocation &&
      Number.isFinite(Number(userLocation.lat)) &&
      Number.isFinite(Number(userLocation.lng)) ? (
        <>
          <Marker
            position={[Number(userLocation.lat), Number(userLocation.lng)]}
            icon={userLocationIcon}
          >
            <Popup>
              <b>You are here</b>
            </Popup>
          </Marker>
          {Number.isFinite(Number(userLocation.accuracy)) && userLocation.accuracy > 0 ? (
            <Circle
              center={[Number(userLocation.lat), Number(userLocation.lng)]}
              radius={Number(userLocation.accuracy)}
              pathOptions={{
                color: "#2a7fff",
                fillColor: "#2a7fff",
                fillOpacity: 0.14,
                weight: 1.5,
              }}
            />
          ) : null}
        </>
      ) : null}

      {Array.isArray(geofences) && geofences.length > 0 ? (
        <GeofenceDisplayLayer geofences={geofences} />
      ) : null}
      <GeofenceDrawControl
        onGeofenceCreated={onGeofenceCreated}
        collapsed={geofenceToolbarCollapsed}
      />
    </MapContainer>
  );
});


// --- Main Map Component ---
const MapComponent = ({
  whenReady,
  mapType = "default",
  showVehiclesLayer = true,
  showTrafficLayer = false,
  showLabelsLayer = true,
  showVehicleLabels = false,
  vehicleData,
  onVehicleClick,
  onTelemetryOpen,
  activeGroups,
  panelFocusRequest = null,
  geofences,
  onGeofenceCreated,
  onPlaybackStateChange,
  geofenceToolbarCollapsed = false,
  showBuiltInControls = true,
  userLocation = null,
  forceClusterPreviewKey = 0,
  overviewMinSpanKm = DEFAULT_OVERVIEW_MIN_SPAN_KM,
  overviewClusterRadiusKm = 0,
  mobilePanelStatusFilter: mobilePanelStatusFilterProp = null,
  playbackRequest = null,
}) => {
  const mapShellRef = useRef(null);
  const playbackTopbarMenuButtonRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobilePanelStatusFilter, setMobilePanelStatusFilter] = useState("total");
  const [currentZoom, setCurrentZoom] = useState(12);
  const [mapViewportVersion, setMapViewportVersion] = useState(0);
  const visibleSpanKmRef = useRef(Number.POSITIVE_INFINITY);
  const [visibleSpanBucket, setVisibleSpanBucket] = useState(() =>
    getVisibleSpanBucket(Number.POSITIVE_INFINITY)
  );
  const [clusterModeEnabled, setClusterModeEnabled] = useState(true);
  const [clusterHoverState, setClusterHoverState] = useState(null);
  const [clusterObjectList, setClusterObjectList] = useState(null);
  const [clusterObjectFilter, setClusterObjectFilter] = useState("all");
  const [selectedVehicleIdState, setSelectedVehicleIdState] = useState(null);
  const [selectedVehicleSnapshot, setSelectedVehicleSnapshot] = useState(null);
  const [selectedVehiclePosition, setSelectedVehiclePosition] = useState(null);
  const [isPanelVehicleSwitching, setIsPanelVehicleSwitching] = useState(false);
  const [isZoomMaskActive, setIsZoomMaskActive] = useState(false);
  const [isClusterZoomMaskActive, setIsClusterZoomMaskActive] = useState(false);
  const [isPlaybackCameraRestoring, setIsPlaybackCameraRestoring] = useState(false);
  const [selectedVehicleFocusOrigin, setSelectedVehicleFocusOrigin] = useState("map");
  const [panelPopupOpenToken, setPanelPopupOpenToken] = useState(0);
  const [activeAnimatedVehicleIds, setActiveAnimatedVehicleIds] = useState([]);
  const [objectListSearchTerm, setObjectListSearchTerm] = useState("");
  const [activeSidebarGroupKey, setActiveSidebarGroupKey] = useState("");
  const mapRef = useRef(null);
  const mapKeyRef = useRef(`map-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const canonicalVehicleStateRef = useRef(createEmptyCanonicalVehicleStore());
  const vehicleMarkerRefsRef = useRef(new Map());
  const previousVehicleStatesRef = useRef(new Map());
  const clusterHideTimeoutRef = useRef(null);
  const clusterHoverSignatureRef = useRef("");
  const pendingPanelFocusTimeoutRef = useRef(null);
  const panelSwitchOverlayTimeoutRef = useRef(null);
  const panelSwitchTokenRef = useRef(0);
  const lastPlaybackRequestRef = useRef("");
  const lastAutoFitKeyRef = useRef("");
  const lastPanelFocusRequestRef = useRef("");
  const lastPlaybackAutoFocusRef = useRef("");
  const playbackCameraSnapshotRef = useRef(null);
  const playbackCameraRestoreTimeoutRef = useRef(null);
  const playbackSettingsDragRef = useRef({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const clearClusterHoverHideTimeout = useCallback(() => {
    if (clusterHideTimeoutRef.current) {
      clearTimeout(clusterHideTimeoutRef.current);
      clusterHideTimeoutRef.current = null;
    }
  }, []);
  const scheduleClusterHoverHide = useCallback(
    (delay = 320) => {
      clearClusterHoverHideTimeout();
      clusterHideTimeoutRef.current = setTimeout(() => {
        clusterHideTimeoutRef.current = null;
        setClusterHoverState(null);
      }, delay);
    },
    [clearClusterHoverHideTimeout]
  );
  const getVehicleMarkerRef = useCallback((vehicleId) => {
    const key = String(vehicleId || "");
    if (!key) return null;
    const registry = vehicleMarkerRefsRef.current;
    if (registry.has(key)) return registry.get(key);
    const nextRef = React.createRef();
    registry.set(key, nextRef);
    return nextRef;
  }, []);
  const clearPendingPanelFocusTimeout = useCallback(() => {
    if (pendingPanelFocusTimeoutRef.current) {
      clearTimeout(pendingPanelFocusTimeoutRef.current);
      pendingPanelFocusTimeoutRef.current = null;
    }
  }, []);
  const clearPanelSwitchOverlayTimeout = useCallback(() => {
    if (panelSwitchOverlayTimeoutRef.current) {
      clearTimeout(panelSwitchOverlayTimeoutRef.current);
      panelSwitchOverlayTimeoutRef.current = null;
    }
  }, []);
  const clearPlaybackCameraRestoreTimeout = useCallback(() => {
    if (playbackCameraRestoreTimeoutRef.current) {
      clearTimeout(playbackCameraRestoreTimeoutRef.current);
      playbackCameraRestoreTimeoutRef.current = null;
    }
  }, []);
  const resetPlaybackCameraSnapshot = useCallback(() => {
    playbackCameraSnapshotRef.current = null;
    clearPlaybackCameraRestoreTimeout();
    setIsPlaybackCameraRestoring(false);
  }, [clearPlaybackCameraRestoreTimeout]);
  const capturePlaybackCameraSnapshot = useCallback(() => {
    if (!mapInstance || playbackCameraSnapshotRef.current) return;

    const center = mapInstance.getCenter?.();
    const zoom = Number(mapInstance.getZoom?.() ?? NaN);
    const hasValidCenter =
      Number.isFinite(Number(center?.lat)) && Number.isFinite(Number(center?.lng));

    playbackCameraSnapshotRef.current = {
      center: hasValidCenter ? [Number(center.lat), Number(center.lng)] : null,
      zoom: Number.isFinite(zoom) ? zoom : null,
    };
  }, [mapInstance]);
  const restorePlaybackCameraSnapshot = useCallback(() => {
    const snapshot = playbackCameraSnapshotRef.current;
    playbackCameraSnapshotRef.current = null;
    if (!mapInstance || !snapshot?.center || snapshot.center.length !== 2) {
      clearPlaybackCameraRestoreTimeout();
      setIsPlaybackCameraRestoring(false);
      return false;
    }

    clearPlaybackCameraRestoreTimeout();
    setIsPlaybackCameraRestoring(true);
    mapInstance.stop?.();
    mapInstance.setView(
      snapshot.center,
      Math.max(MIN_TRACKING_MAP_ZOOM, Number(snapshot.zoom) || DEFAULT_MAP_ZOOM),
      {
        animate: false,
      }
    );
    mapInstance.invalidateSize?.(false);
    playbackCameraRestoreTimeoutRef.current = setTimeout(() => {
      playbackCameraRestoreTimeoutRef.current = null;
      setIsPlaybackCameraRestoring(false);
    }, 320);
    return true;
  }, [clearPlaybackCameraRestoreTimeout, mapInstance]);
  useEffect(() => () => clearPlaybackCameraRestoreTimeout(), [clearPlaybackCameraRestoreTimeout]);
  const baseVehiclesToShow = useMemo(() => {
    if (!vehicleData) return [];

    if (Array.isArray(vehicleData)) {
      return dedupeVehicleList(vehicleData.filter((v) => {
        if (!v || !getVehicleIdentity(v)) return false;
        const lat = Number(v.latitude);
        const lng = Number(v.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng);
      }));
    }

    if (typeof vehicleData !== "object") return [];

    const allGroups = Object.keys(vehicleData);
    const groupsToFilter =
      activeGroups && activeGroups.length > 0 ? activeGroups : allGroups;

    return dedupeVehicleList(
      groupsToFilter
      .filter((groupName) => vehicleData[groupName])
      .map((groupName) => vehicleData[groupName])
      .flat()
      .filter((v) => {
        if (!v || !getVehicleIdentity(v)) return false;
        const lat = Number(v.latitude);
        const lng = Number(v.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng);
      })
    );
  }, [vehicleData, activeGroups]);
  const canonicalVehicleState = useMemo(
    () => buildCanonicalVehicleStoreState(canonicalVehicleStateRef.current, baseVehiclesToShow),
    [baseVehiclesToShow]
  );
  useEffect(() => {
    canonicalVehicleStateRef.current = canonicalVehicleState;
  }, [canonicalVehicleState]);
  useEffect(() => {
    const activeIds = new Set(canonicalVehicleState.activeOrderedIds.map((id) => String(id || "")));

    vehicleMarkerRefsRef.current.forEach((_, key) => {
      if (!activeIds.has(String(key || ""))) {
        vehicleMarkerRefsRef.current.delete(key);
      }
    });

    previousVehicleStatesRef.current.forEach((_, key) => {
      if (!activeIds.has(String(key || ""))) {
        previousVehicleStatesRef.current.delete(key);
      }
    });
  }, [canonicalVehicleState.activeOrderedIds]);
  const canonicalVehiclesToShow = useMemo(
    () =>
      canonicalVehicleState.activeOrderedIds
        .map((id) => canonicalVehicleState.activeRegistry.get(id)?.vehicle)
        .filter(Boolean),
    [canonicalVehicleState]
  );
  const selectedVehicleId = selectedVehicleIdState ? String(selectedVehicleIdState) : null;
  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return (
      canonicalVehicleState.activeRegistry.get(selectedVehicleId)?.vehicle ||
      selectedVehicleSnapshot ||
      null
    );
  }, [canonicalVehicleState.activeRegistry, selectedVehicleId, selectedVehicleSnapshot]);
  const setSelectedVehicleState = useCallback((vehicle) => {
    if (!vehicle) {
      setSelectedVehicleIdState(null);
      setSelectedVehicleSnapshot(null);
      return;
    }
    const nextVehicleId = getVehicleIdentity(vehicle);
    setSelectedVehicleIdState(nextVehicleId ? String(nextVehicleId) : null);
    setSelectedVehicleSnapshot(vehicle);
  }, []);
  const playback = usePlaybackController({
    selectedVehicle,
    selectedVehicleId,
    onPlaybackStateChange,
    capturePlaybackCameraSnapshot,
    restorePlaybackCameraSnapshot,
    playbackApiRecordLimit: PLAYBACK_API_RECORD_LIMIT,
    defaultPlaybackSettings: DEFAULT_PLAYBACK_SETTINGS,
    defaultPlaybackThresholds: DEFAULT_PLAYBACK_THRESHOLDS,
    playbackSettingsStorageKey: PLAYBACK_SETTINGS_STORAGE_KEY,
  });
  const playbackMetrics = usePlaybackMetrics({
    selectedVehicle,
    selectedVehiclePlaybackActive: playback.selectedVehiclePlaybackActive,
    selectedPlaybackSamples: playback.selectedPlaybackSamples,
    playbackRoutePath: playback.playbackRoutePath,
    playbackProgress: playback.playbackProgress,
    visibleSpanBucket,
    visibleSpanBucketLimits: VISIBLE_SPAN_BUCKET_LIMITS,
    playbackSettings: playback.playbackSettings,
    playbackThresholds: playback.playbackThresholds,
  });
  const {
    playbackMenuOpen,
    setPlaybackMenuOpen,
    isPlaybackCustomRangeOpen,
    setIsPlaybackCustomRangeOpen,
    activePlaybackPreset,
    setActivePlaybackPreset,
    playbackCustomRangeDraft,
    setPlaybackCustomRangeDraft,
    playbackCustomRangeApplied,
    setPlaybackCustomRangeApplied,
    playbackApiSamples,
    setPlaybackApiSamples,
    playbackApiLoading,
    setPlaybackApiLoading,
    playbackApiError,
    setPlaybackApiError,
    playbackRangeValidationError,
    setPlaybackRangeValidationError,
    playbackPaused,
    setPlaybackPaused,
    playbackSpeedMultiplier,
    setPlaybackSpeedMultiplier,
    playbackRestartToken,
    setPlaybackRestartToken,
    playbackProgress,
    setPlaybackProgress,
    playbackSeekValue,
    setPlaybackSeekValue,
    playbackSeekToken,
    setPlaybackSeekToken,
    playbackRoutePath,
    setPlaybackRoutePath,
    isPlaybackSettingsCollapsed,
    setIsPlaybackSettingsCollapsed,
    playbackSettings,
    setPlaybackSettings,
    playbackThresholds,
    setPlaybackThresholds,
    isPlaybackAlertMenuOpen,
    setIsPlaybackAlertMenuOpen,
    playbackSettingsSaveMessage,
    setPlaybackSettingsSaveMessage,
    showPlaybackSettingsPrompt,
    setShowPlaybackSettingsPrompt,
    isPlaybackDrawerOpen,
    setIsPlaybackDrawerOpen,
    activePlaybackDrawerTab,
    setActivePlaybackDrawerTab,
    playbackSettingsPosition,
    setPlaybackSettingsPosition,
    isPlaybackPrintModalOpen,
    setIsPlaybackPrintModalOpen,
    isPlaybackShareModalOpen,
    setIsPlaybackShareModalOpen,
    playbackShareValidity,
    setPlaybackShareValidity,
    playbackShareEmails,
    setPlaybackShareEmails,
    playbackShareMobiles,
    setPlaybackShareMobiles,
    playbackShareReason,
    setPlaybackShareReason,
    playbackShareFeedback,
    setPlaybackShareFeedback,
    selectedVehiclePlaybackActive,
    playbackSourceSamples,
    playbackRangeLabel,
    selectedPlaybackSamples,
    rawPlaybackRoutePath,
    invalidatePlaybackHistoryRequest,
    resetPlaybackAnimationState,
    applyPlaybackPreset,
    applyPlaybackCustomRange,
    handlePlaybackClose,
    handleTogglePlaybackMenu,
    togglePlaybackSetting,
    updatePlaybackThreshold,
    togglePlaybackAlertFilter,
    playbackAlertSummary,
    savePlaybackSettings,
    restorePlaybackSettings,
    handlePlaybackSeek,
    openPlaybackDrawerTab,
    handlePlaybackShare,
    handlePlaybackGenerateLink,
    handlePlaybackShareSend,
    handlePlaybackShareHistory,
    handlePlaybackPrint,
    handlePlaybackPrintAction,
  } = playback;
  const playbackDerived = playbackMetrics;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateViewportMode = () => {
      setIsMobileViewport(window.innerWidth <= MOBILE_PANEL_FILTER_BREAKPOINT);
    };

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleMobileStatusFilter = (event) => {
      const requestedFilter = String(event?.detail?.filter || "total").toLowerCase();
      setMobilePanelStatusFilter(requestedFilter || "total");
    };

    window.addEventListener(PANEL_MOBILE_STATUS_FILTER_EVENT, handleMobileStatusFilter);
    return () => window.removeEventListener(PANEL_MOBILE_STATUS_FILTER_EVENT, handleMobileStatusFilter);
  }, []);

  const effectiveMobilePanelStatusFilter = useMemo(() => {
    const rawFilter =
      mobilePanelStatusFilterProp !== null && mobilePanelStatusFilterProp !== undefined
        ? mobilePanelStatusFilterProp
        : mobilePanelStatusFilter;
    return String(rawFilter || "total").toLowerCase();
  }, [mobilePanelStatusFilter, mobilePanelStatusFilterProp]);
  const activeMapClusterFilter = useMemo(() => {
    if (
      effectiveMobilePanelStatusFilter &&
      effectiveMobilePanelStatusFilter !== "total" &&
      effectiveMobilePanelStatusFilter !== "all"
    ) {
      return effectiveMobilePanelStatusFilter;
    }
    if (clusterObjectFilter && clusterObjectFilter !== "all" && clusterObjectFilter !== "total") {
      return clusterObjectFilter;
    }
    return "all";
  }, [clusterObjectFilter, effectiveMobilePanelStatusFilter]);

  const vehiclesToShow = useMemo(() => {
    if (effectiveMobilePanelStatusFilter === "total") {
      return canonicalVehiclesToShow;
    }

    return canonicalVehiclesToShow.filter(
      (vehicle) => getVehicleStatusKey(vehicle) === effectiveMobilePanelStatusFilter
    );
  }, [canonicalVehiclesToShow, effectiveMobilePanelStatusFilter]);
  const selectedSceneVehicle = selectedVehicle;

  const resolvedMapType = MAP_TYPE_ALIASES[mapType] || mapType || "osm";
  const resolvedTileConfig = TILE_CONFIG[resolvedMapType] || TILE_CONFIG.osm;
  const resolvedOverviewMinSpanKm =
    Number.isFinite(Number(overviewMinSpanKm)) && Number(overviewMinSpanKm) > 0
      ? Number(overviewMinSpanKm)
      : DEFAULT_OVERVIEW_MIN_SPAN_KM;
  const resolvedOverviewClusterRadiusKm =
    Number.isFinite(Number(overviewClusterRadiusKm)) && Number(overviewClusterRadiusKm) > 0
      ? Number(overviewClusterRadiusKm)
      : 0;
  const baseTileRenderProfile = useMemo(
    () => getBaseTileRenderProfile(resolvedMapType),
    [resolvedMapType]
  );
  const overlayTileRenderProfile = useMemo(
    () => getOverlayTileRenderProfile(resolvedMapType),
    [resolvedMapType]
  );

  const handleMapReady = useCallback(
    (event) => {
      const map = event?.target ?? null;
      if (!map) return;
      mapRef.current = map;
      setMapInstance(map);
      if (map?.zoomControl) {
        map.removeControl(map.zoomControl);
      }
      setCurrentZoom(map.getZoom?.() ?? DEFAULT_MAP_ZOOM);
      const nextVisibleSpan = getVisibleSpanKm(map);
      visibleSpanKmRef.current = nextVisibleSpan;
      setVisibleSpanBucket(getVisibleSpanBucket(nextVisibleSpan));
      setClusterModeEnabled(nextVisibleSpan >= CLUSTER_ENABLE_AREA_KM);
      if (whenReady) {
        whenReady(map);
      }
    },
    [whenReady]
  );

  useEffect(() => {
    setClusterHoverState(null);
    setClusterObjectList(null);
    resetPlaybackCameraSnapshot();
    setSelectedVehicleState(null);
    setSelectedVehiclePosition(null);
    setActiveAnimatedVehicleIds([]);
    setPlaybackMenuOpen(false);
    setActivePlaybackPreset("");
    setPlaybackPaused(true);
    setPlaybackProgress(0);
    setPlaybackSeekValue(0);
    setPlaybackSeekToken(0);
    setPlaybackRestartToken(0);
    setPlaybackRoutePath([]);
    setIsPlaybackSettingsCollapsed(false);
    setIsPlaybackAlertMenuOpen(false);
    setPlaybackSettingsSaveMessage("");
    setShowPlaybackSettingsPrompt(true);
    setIsPlaybackDrawerOpen(false);
    setActivePlaybackDrawerTab("trips");
    setPlaybackSettingsPosition(null);
  }, [
    forceClusterPreviewKey,
    resetPlaybackCameraSnapshot,
    setSelectedVehicleState,
    setActivePlaybackDrawerTab,
    setActivePlaybackPreset,
    setIsPlaybackAlertMenuOpen,
    setIsPlaybackDrawerOpen,
    setIsPlaybackSettingsCollapsed,
    setPlaybackMenuOpen,
    setPlaybackPaused,
    setPlaybackProgress,
    setPlaybackRestartToken,
    setPlaybackRoutePath,
    setPlaybackSeekToken,
    setPlaybackSeekValue,
    setPlaybackSettingsPosition,
    setPlaybackSettingsSaveMessage,
    setShowPlaybackSettingsPrompt,
  ]);

  useEffect(() => {
    if (!mapInstance || vehiclesToShow.length === 0) return;
    if (selectedVehicleId || selectedVehiclePlaybackActive || clusterObjectList) return;

    const autoFitKey = `${forceClusterPreviewKey}-${vehiclesToShow.length}`;
    if (lastAutoFitKeyRef.current === autoFitKey) return;

    const overviewBounds = buildOverviewBounds(
      vehiclesToShow,
      resolvedOverviewClusterRadiusKm,
      resolvedOverviewMinSpanKm
    );
    if (!overviewBounds?.isValid?.()) return;

    lastAutoFitKeyRef.current = autoFitKey;
    mapInstance.fitBounds(overviewBounds, {
      paddingTopLeft: DEFAULT_OVERVIEW_FIT_PADDING_TOP_LEFT,
      paddingBottomRight: DEFAULT_OVERVIEW_FIT_PADDING_BOTTOM_RIGHT,
      maxZoom: DEFAULT_OVERVIEW_FIT_ZOOM,
      animate: false,
    });
  }, [
    mapInstance,
    vehiclesToShow,
    forceClusterPreviewKey,
    resolvedOverviewMinSpanKm,
    resolvedOverviewClusterRadiusKm,
    selectedVehicleId,
    selectedVehiclePlaybackActive,
    clusterObjectList,
  ]);

  useEffect(() => {
    clearClusterHoverHideTimeout();
    return () => {
      clearClusterHoverHideTimeout();
    };
  }, [clearClusterHoverHideTimeout]);

  useEffect(() => {
    clearPendingPanelFocusTimeout();
    return () => {
      clearPendingPanelFocusTimeout();
    };
  }, [clearPendingPanelFocusTimeout]);

  useEffect(() => {
    clearPanelSwitchOverlayTimeout();
    return () => {
      clearPanelSwitchOverlayTimeout();
    };
  }, [clearPanelSwitchOverlayTimeout]);

  useEffect(() => {
    if (!mapInstance) return undefined;

    if (isPanelVehicleSwitching) {
      mapInstance.dragging?.disable?.();
      mapInstance.scrollWheelZoom?.disable?.();
      mapInstance.doubleClickZoom?.disable?.();
      mapInstance.boxZoom?.disable?.();
      mapInstance.keyboard?.disable?.();
      mapInstance.touchZoom?.disable?.();
    } else {
      mapInstance.dragging?.enable?.();
      mapInstance.scrollWheelZoom?.enable?.();
      mapInstance.doubleClickZoom?.enable?.();
      mapInstance.boxZoom?.enable?.();
      mapInstance.keyboard?.enable?.();
      mapInstance.touchZoom?.enable?.();
    }

    return undefined;
  }, [isPanelVehicleSwitching, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return undefined;
    let raf = 0;
    const hideHover = () => {
      if (raf) cancelAnimationFrame(raf);
      // Defer the React state update out of the input event to reduce INP spikes.
      raf = requestAnimationFrame(() => {
        raf = 0;
        setClusterHoverState(null);
      });
    };
    mapInstance.on("click", hideHover);
    mapInstance.on("zoomstart", hideHover);
    mapInstance.on("movestart", hideHover);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      mapInstance.off("click", hideHover);
      mapInstance.off("zoomstart", hideHover);
      mapInstance.off("movestart", hideHover);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) return undefined;
    let zoomEndTimer = null;
      const syncClusterZoomMask = () => {
      const nextSpan = getVisibleSpanKm(mapInstance);
      if (!Number.isFinite(nextSpan)) return;
      setIsClusterZoomMaskActive((current) => {
        if (nextSpan >= CLUSTER_ENABLE_AREA_KM) return true;
        if (nextSpan <= CLUSTER_DISABLE_AREA_KM) return false;
        return current;
      });
    };
    const handleZoomStart = () => {
      if (zoomEndTimer) {
        clearTimeout(zoomEndTimer);
        zoomEndTimer = null;
      }
      setIsZoomMaskActive(true);
      syncClusterZoomMask();
    };
    const handleZoomEnd = () => {
      syncClusterZoomMask();
      if (zoomEndTimer) clearTimeout(zoomEndTimer);
      zoomEndTimer = setTimeout(() => {
        zoomEndTimer = null;
        setIsZoomMaskActive(false);
        const nextSpan = getVisibleSpanKm(mapInstance);
        if (Number.isFinite(nextSpan) && nextSpan <= CLUSTER_DISABLE_AREA_KM) {
          setIsClusterZoomMaskActive(false);
        }
      }, 160);
    };

    mapInstance.on("zoomstart", handleZoomStart);
    mapInstance.on("zoomend", handleZoomEnd);

    return () => {
      if (zoomEndTimer) clearTimeout(zoomEndTimer);
      mapInstance.off("zoomstart", handleZoomStart);
      mapInstance.off("zoomend", handleZoomEnd);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) return undefined;

    const handlePointerMove = (event) => {
      if (!clusterHoverState) return;
      const target = event?.originalEvent?.target;
      if (!target || typeof target.closest !== "function") return;
      const isOnCluster = Boolean(
        target.closest(".vtp-cluster-shell, .vtp-cluster-wrap, .leaflet-marker-icon")
      );
      const isOnMenuButton = Boolean(
        target.closest(".vtp-cluster-hover-anchor, .vtp-cluster-menu-btn")
      );
      if (isOnCluster || isOnMenuButton) {
        clearClusterHoverHideTimeout();
        return;
      }
      scheduleClusterHoverHide(180);
    };

    let clearHoverRaf = 0;
    const deferClearHover = () => {
      if (clearHoverRaf) cancelAnimationFrame(clearHoverRaf);
      clearHoverRaf = requestAnimationFrame(() => {
        clearHoverRaf = 0;
        setClusterHoverState(null);
      });
    };

    const handleZoomStart = () => deferClearHover();
    const handleMoveStart = () => deferClearHover();

    mapInstance.on("mousemove", handlePointerMove);
    mapInstance.on("zoomstart", handleZoomStart);
    mapInstance.on("movestart", handleMoveStart);

    return () => {
      if (clearHoverRaf) cancelAnimationFrame(clearHoverRaf);
      mapInstance.off("mousemove", handlePointerMove);
      mapInstance.off("zoomstart", handleZoomStart);
      mapInstance.off("movestart", handleMoveStart);
    };
  }, [mapInstance, clusterHoverState, clearClusterHoverHideTimeout, scheduleClusterHoverHide]);

  useEffect(() => {
    if (!mapInstance) return undefined;
    const updateVisibleSpan = () => {
      const nextSpan = getVisibleSpanKm(mapInstance);
      visibleSpanKmRef.current = nextSpan;
      React.startTransition(() => {
        setMapViewportVersion((current) => current + 1);
        setVisibleSpanBucket((currentBucket) => {
          const nextBucket = getVisibleSpanBucket(nextSpan);
          return currentBucket === nextBucket ? currentBucket : nextBucket;
        });
        setClusterModeEnabled((currentEnabled) => {
          if (nextSpan >= CLUSTER_ENABLE_AREA_KM) return true;
          if (nextSpan <= CLUSTER_DISABLE_AREA_KM) return false;
          return currentEnabled;
        });
      });
    };

    updateVisibleSpan();
    mapInstance.on("zoomend", updateVisibleSpan);
    mapInstance.on("moveend", updateVisibleSpan);
    mapInstance.on("resize", updateVisibleSpan);

    return () => {
      mapInstance.off("zoomend", updateVisibleSpan);
      mapInstance.off("moveend", updateVisibleSpan);
      mapInstance.off("resize", updateVisibleSpan);
    };
  }, [mapInstance]);

  // Render mode policy (single source of truth):
  // - overview: cluster layer is allowed and individual markers can be global (non-clustered only)
  // - street: individual markers are viewport-filtered (bounded) and clustering math is skipped
  // - playback: special mode (single vehicle) where clustering is disabled
  const baseSceneMode = selectedVehiclePlaybackActive
    ? "playback"
    : clusterModeEnabled
      ? "overview"
      : "street";
  const shouldUseViewportOpenState = baseSceneMode === "street";
  const clusterRadiusPx = useMemo(
    () => getClusterRadiusPxForBucket(visibleSpanBucket),
    [visibleSpanBucket]
  );
  const bubbleAnimationLimit = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_BUBBLE_ANIMATION_LIMIT_DESKTOP;
    return window.innerWidth <= 640
      ? DEFAULT_BUBBLE_ANIMATION_LIMIT_MOBILE
      : DEFAULT_BUBBLE_ANIMATION_LIMIT_DESKTOP;
  }, []);

  const bubbleAnimatedVehicleIds = useMemo(() => {
    if (!ENABLE_BUBBLE_VEHICLE_EXPANSION) return new Set();
    // "Bubble open" = anchored object list (not the sidebar mode).
    if (!clusterObjectList || clusterObjectList.mode === "sidebar") return new Set();
    const list = Array.isArray(clusterObjectList.vehicles) ? clusterObjectList.vehicles : [];
    if (!list.length) return new Set();

    const ranked = list
      .map((vehicle) => {
        const id = getVehicleIdentity(vehicle);
        const status = getVehicleStatusKey(vehicle);
        const running = status === "running";
        const ts = getVehicleSourceTimestamp(vehicle) || 0;
        const speed = Number(vehicle?.speed_kmh ?? vehicle?.speed ?? 0) || 0;
        return { id: id ? String(id) : "", running, ts, speed };
      })
      .filter((row) => row.id)
      .sort((a, b) => {
        if (a.running !== b.running) return a.running ? -1 : 1;
        if (a.ts !== b.ts) return b.ts - a.ts;
        return b.speed - a.speed;
      })
      .slice(0, bubbleAnimationLimit);

    return new Set(ranked.map((row) => row.id));
  }, [bubbleAnimationLimit, clusterObjectList]);

  const bubbleAnimatedVehiclesToShow = useMemo(() => {
    if (!bubbleAnimatedVehicleIds.size) return [];
    const byId = new Map();
    (vehiclesToShow || []).forEach((vehicle) => {
      const id = getVehicleIdentity(vehicle);
      if (!id) return;
      const key = String(id);
      if (bubbleAnimatedVehicleIds.has(key)) byId.set(key, vehicle);
    });
    return Array.from(byId.values());
  }, [bubbleAnimatedVehicleIds, vehiclesToShow]);
  const overlayVehicleIds = useMemo(() => {
    const ids = new Set();
    if (selectedVehicleId) ids.add(String(selectedVehicleId));
    bubbleAnimatedVehicleIds.forEach((id) => {
      const key = String(id || "");
      if (key) ids.add(key);
    });
    return ids;
  }, [bubbleAnimatedVehicleIds, selectedVehicleId]);
  const renderedVehiclesToShow = useMemo(() => {
    if (!selectedVehiclePlaybackActive || !selectedVehicleId) return vehiclesToShow;
    return vehiclesToShow.filter(
      (vehicle) => getVehicleIdentity(vehicle) === String(selectedVehicleId)
    );
  }, [selectedVehicleId, selectedVehiclePlaybackActive, vehiclesToShow]);
  const needsViewportVehicleFilter = shouldUseViewportOpenState;
  const viewportOpenVehicleIds = useMemo(() => {
    if (!needsViewportVehicleFilter || !mapInstance) return new Set();
    void mapViewportVersion;
    return getViewportVehicleIdSet(renderedVehiclesToShow, mapInstance);
  }, [needsViewportVehicleFilter, mapInstance, renderedVehiclesToShow, mapViewportVersion]);
  const scenePolicy = useMemo(
    () => ({
      mode: baseSceneMode,
      isOverview: baseSceneMode === "overview",
      isStreet: baseSceneMode === "street",
      isPlayback: baseSceneMode === "playback",
      useViewportOpenState: baseSceneMode === "street",
      renderOverviewClusterLayer: baseSceneMode === "overview",
      renderStreetClusterLayer:
        baseSceneMode === "street" && mapInstance !== null && viewportOpenVehicleIds.size > 0,
    }),
    [baseSceneMode, mapInstance, viewportOpenVehicleIds.size]
  );
  const shouldRenderOverviewClusterLayer = scenePolicy.renderOverviewClusterLayer;
  const shouldRenderStreetClusterLayer = scenePolicy.renderStreetClusterLayer;
  const shouldRenderClusterLayer =
    scenePolicy.renderOverviewClusterLayer || scenePolicy.renderStreetClusterLayer;
  const shouldClusterVehicles = shouldRenderClusterLayer;
  const limitedViewportOpenVehicleIds = useMemo(() => {
    const next = new Set();
    overlayVehicleIds.forEach((id) => {
      const key = String(id || "");
      if (key) next.add(key);
    });

    if (viewportOpenVehicleIds.size <= MAX_VIEWPORT_OPEN_VEHICLES) {
      viewportOpenVehicleIds.forEach((id) => {
        const key = String(id || "");
        if (key) next.add(key);
      });
      return next;
    }

    const priorityIds = Array.from(overlayVehicleIds, (id) => String(id || "")).filter(Boolean);

    priorityIds.forEach((id) => {
      if (!id || next.size >= MAX_VIEWPORT_OPEN_VEHICLES) return;
      next.add(id);
    });

    for (let index = 0; index < renderedVehiclesToShow.length; index += 1) {
      if (next.size >= MAX_VIEWPORT_OPEN_VEHICLES) break;
      const id = String(getVehicleIdentity(renderedVehiclesToShow[index]));
      if (!id || next.has(id) || !viewportOpenVehicleIds.has(id)) continue;
      next.add(id);
    }

    return next;
  }, [
    viewportOpenVehicleIds,
    renderedVehiclesToShow,
    overlayVehicleIds,
  ]);
  const shouldSuppressForClusterZoomMask = Boolean(
    isClusterZoomMaskActive && visibleSpanKmRef.current >= CLUSTER_ENABLE_AREA_KM
  );
  const clusteredVehiclesToShow = useMemo(() => {
    if (!shouldRenderClusterLayer) return [];
    if (shouldRenderStreetClusterLayer) {
      return renderedVehiclesToShow.filter((vehicle) => {
        const id = String(getVehicleIdentity(vehicle));
        if (!id) return false;
        if (!viewportOpenVehicleIds.has(id)) return false;
        return !overlayVehicleIds.has(id);
      });
    }
    return renderedVehiclesToShow.filter((vehicle) => {
      const id = String(getVehicleIdentity(vehicle));
      if (!id) return false;
      return !overlayVehicleIds.has(id);
    });
  }, [
    shouldRenderClusterLayer,
    shouldRenderStreetClusterLayer,
    renderedVehiclesToShow,
    viewportOpenVehicleIds,
    overlayVehicleIds,
  ]);
  const shouldSuppressIndividualVehicleFlash =
    shouldSuppressForClusterZoomMask &&
    clusteredVehiclesToShow.length > 1 &&
    !selectedVehicleId &&
    !selectedVehiclePlaybackActive &&
    !clusterObjectList;
  const lastStableMovingVehiclesRef = useRef([]);
  const movingVehiclesToShowRaw = useMemo(() => {
    if (shouldSuppressIndividualVehicleFlash) return [];
    if (selectedVehiclePlaybackActive) return renderedVehiclesToShow;
    if (needsViewportVehicleFilter && !shouldRenderStreetClusterLayer) {
      const bounded = renderedVehiclesToShow.filter((vehicle) =>
        limitedViewportOpenVehicleIds.has(String(getVehicleIdentity(vehicle)))
      );
      return bounded;
    }
    if (shouldRenderOverviewClusterLayer) {
      const pinnedVehicles = [];
      if (selectedSceneVehicle && selectedVehicleId) pinnedVehicles.push(selectedSceneVehicle);
      if (!bubbleAnimatedVehiclesToShow.length) return pinnedVehicles;
      const seen = new Set(pinnedVehicles.map((vehicle) => String(getVehicleIdentity(vehicle))));
      bubbleAnimatedVehiclesToShow.forEach((vehicle) => {
        const id = String(getVehicleIdentity(vehicle));
        if (!id || seen.has(id)) return;
        seen.add(id);
        pinnedVehicles.push(vehicle);
      });
      return pinnedVehicles;
    }
    if (shouldRenderStreetClusterLayer) {
      const pinnedVehicles = [];
      if (selectedSceneVehicle && selectedVehicleId) pinnedVehicles.push(selectedSceneVehicle);
      if (!bubbleAnimatedVehiclesToShow.length) return pinnedVehicles;
      const seen = new Set(pinnedVehicles.map((vehicle) => String(getVehicleIdentity(vehicle))));
      bubbleAnimatedVehiclesToShow.forEach((vehicle) => {
        const id = String(getVehicleIdentity(vehicle));
        if (!id || seen.has(id)) return;
        seen.add(id);
        pinnedVehicles.push(vehicle);
      });
      return pinnedVehicles;
    }
    return renderedVehiclesToShow;
  }, [
    shouldSuppressIndividualVehicleFlash,
    selectedVehiclePlaybackActive,
    needsViewportVehicleFilter,
    limitedViewportOpenVehicleIds,
    shouldRenderStreetClusterLayer,
    shouldRenderOverviewClusterLayer,
    renderedVehiclesToShow,
    bubbleAnimatedVehiclesToShow,
    selectedSceneVehicle,
    selectedVehicleId,
  ]);
  useEffect(() => {
    if (!renderedVehiclesToShow.length) {
      lastStableMovingVehiclesRef.current = [];
      return;
    }
    if (movingVehiclesToShowRaw.length) {
      lastStableMovingVehiclesRef.current = movingVehiclesToShowRaw;
    }
  }, [movingVehiclesToShowRaw, renderedVehiclesToShow.length]);
  const movingVehiclesToShow = useMemo(() => {
    // Prevent brief blank states during zoom-end transitions in viewport-filtered modes.
    if (
      !movingVehiclesToShowRaw.length &&
      renderedVehiclesToShow.length &&
      needsViewportVehicleFilter &&
      lastStableMovingVehiclesRef.current.length
    ) {
      return lastStableMovingVehiclesRef.current;
    }
    return movingVehiclesToShowRaw;
  }, [movingVehiclesToShowRaw, renderedVehiclesToShow.length, needsViewportVehicleFilter]);
  const effectiveShowVehicleLabels = useMemo(() => {
    if (!showVehicleLabels) return false;
    if (isZoomMaskActive) return false;
    return movingVehiclesToShow.length <= MAX_LABEL_RENDER_VEHICLES;
  }, [showVehicleLabels, isZoomMaskActive, movingVehiclesToShow.length]);
  const isSelectedVehicleClustered = useMemo(() => {
    return false;
  }, []);
  const shouldRenderPlaybackMapState = selectedVehiclePlaybackActive;
  const showPlaybackChrome = selectedVehiclePlaybackActive && selectedVehicle && !playbackApiLoading && playbackApiSamples.length > 0;
  const shouldShowGlobalVehicleLabels = useMemo(() => {
    return Boolean(showVehicleLabels);
  }, [showVehicleLabels]);
  const shouldHideVehicleVisualLayers = false;

  useEffect(() => {
    const availableVehicleIds = new Set(
      vehiclesToShow.map((vehicle) => getVehicleIdentity(vehicle)).filter(Boolean)
    );

    setActiveAnimatedVehicleIds((current) => {
      const next = new Set(
        movingVehiclesToShow
          .filter((vehicle) => getVehicleStatusKey(vehicle) === "running")
          .map((vehicle) => getVehicleIdentity(vehicle))
          .filter(Boolean)
      );

      if (selectedVehiclePlaybackActive && selectedVehicleId) {
        next.add(String(selectedVehicleId));
      }

      current.forEach((id) => {
        if (!availableVehicleIds.has(id)) return;
        if (selectedVehiclePlaybackActive && id === String(selectedVehicleId)) {
          next.add(id);
        }
      });

      const normalized = Array.from(next);
      return haveSameIds(current, normalized) ? current : normalized;
    });
  }, [movingVehiclesToShow, selectedVehicleId, selectedVehiclePlaybackActive, vehiclesToShow]);

  const clusterStatusSummary = useMemo(() => {
    const summary = { running: 0, stopped: 0, idle: 0, inactive: 0, nodata: 0 };
    (clusterObjectList?.vehicles || []).forEach((vehicle) => {
      const key = getVehicleStatusKey(vehicle);
      if (summary[key] !== undefined) summary[key] += 1;
    });
    return summary;
  }, [clusterObjectList]);

  const handleClusterHover = useCallback((payload) => {
    const signature = [
      Math.round(Number(payload?.x) || 0),
      Math.round(Number(payload?.y) || 0),
      buildVehicleIdSignature(payload?.vehicles),
    ].join("|");
    if (clusterHoverSignatureRef.current === signature) return;
    clusterHoverSignatureRef.current = signature;
    clearClusterHoverHideTimeout();
    setClusterHoverState(payload);
  }, [clearClusterHoverHideTimeout]);

  const handleClusterLeave = useCallback(() => {
    clusterHoverSignatureRef.current = "";
    scheduleClusterHoverHide(340);
  }, [scheduleClusterHoverHide]);
  useEffect(() => {
    if (!clusterHoverState) {
      clusterHoverSignatureRef.current = "";
    }
  }, [clusterHoverState]);

  const activateVehicleAnimationGroup = useCallback((vehicles) => {
    const ids = (vehicles || [])
      .filter((vehicle) => getVehicleStatusKey(vehicle) === "running")
      .map((vehicle) => getVehicleIdentity(vehicle))
      .filter(Boolean);
    setActiveAnimatedVehicleIds(ids);
  }, []);

  const closeClusterObjectList = useCallback(() => {
    setClusterObjectList(null);
    setClusterObjectFilter("all");
    setObjectListSearchTerm("");
    setActiveSidebarGroupKey("");
  }, []);

  const handleVehicleSelect = useCallback(
    (vehicle, options = {}) => {
      if (!vehicle) return;
      const preservePlayback = Boolean(options?.preservePlayback);
      const origin = String(options?.origin || "map");
      const nextVehicleId = getVehicleIdentity(vehicle);
      const currentVehicleId = String(selectedVehicleId ?? "");
      const isSameSelectedVehicle =
        Boolean(nextVehicleId) &&
        Boolean(currentVehicleId) &&
        nextVehicleId === currentVehicleId;

      if (selectedVehiclePlaybackActive && isSameSelectedVehicle && !preservePlayback) {
        setSelectedVehicleState(vehicle);
        setPlaybackMenuOpen(false);
        setActiveAnimatedVehicleIds((current) => {
          const next = new Set(current);
          next.add(nextVehicleId);
          return Array.from(next);
        });
        const lat = Number(vehicle.latitude);
        const lng = Number(vehicle.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setSelectedVehiclePosition([lat, lng]);
        } else {
          setSelectedVehiclePosition(null);
        }
        return;
      }

      if (!preservePlayback) {
        resetPlaybackCameraSnapshot();
      }
      invalidatePlaybackHistoryRequest();
      setSelectedVehicleState(vehicle);
      setSelectedVehicleFocusOrigin(origin === "panel" ? "panel" : "map");
      if (origin === "panel") {
        setPanelPopupOpenToken((current) => current + 1);
      }
      setPlaybackMenuOpen(false);
      setPlaybackPaused(true);
      setPlaybackProgress(0);
      setPlaybackSeekValue(0);
      setPlaybackSeekToken(0);
      setPlaybackRestartToken(0);
      setPlaybackRoutePath([]);
      setPlaybackApiSamples([]);
      setPlaybackApiLoading(false);
      setPlaybackApiError("");
      setPlaybackRangeValidationError("");
      setIsPlaybackCustomRangeOpen(false);
      const nextCustomRange = buildDefaultCustomPlaybackRange();
      setPlaybackCustomRangeDraft(nextCustomRange);
      setPlaybackCustomRangeApplied(nextCustomRange);
      setIsPlaybackSettingsCollapsed(false);
      setActivePlaybackPreset((current) => {
        if (preservePlayback) return current || "Today";
        return "";
      });
      setActiveAnimatedVehicleIds((current) => {
        const next = new Set(current);
        next.add(nextVehicleId);
        return Array.from(next);
      });
      const lat = Number(vehicle.latitude);
      const lng = Number(vehicle.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setSelectedVehiclePosition([lat, lng]);
      } else {
        setSelectedVehiclePosition(null);
      }
      onVehicleClick?.(vehicle);
    },
    [
      invalidatePlaybackHistoryRequest,
      onVehicleClick,
      resetPlaybackCameraSnapshot,
      setSelectedVehicleState,
      selectedVehicleId,
      selectedVehiclePlaybackActive,
      setActivePlaybackPreset,
      setIsPlaybackCustomRangeOpen,
      setIsPlaybackSettingsCollapsed,
      setPlaybackApiError,
      setPlaybackApiLoading,
      setPlaybackApiSamples,
      setPlaybackCustomRangeApplied,
      setPlaybackCustomRangeDraft,
      setPlaybackMenuOpen,
      setPlaybackPaused,
      setPlaybackProgress,
      setPlaybackRangeValidationError,
      setPlaybackRestartToken,
      setPlaybackRoutePath,
      setPlaybackSeekToken,
      setPlaybackSeekValue,
    ]
  );

  const handlePlaybackMenuFromPopup = useCallback(
    (vehicle) => {
      if (!vehicle) return;
      if (selectedVehiclePlaybackActive) return;
      if (clusterObjectList) closeClusterObjectList();

      const nextVehicleId = getVehicleIdentity(vehicle);
      getVehicleMarkerRef(nextVehicleId)?.current?.closePopup?.();
      mapInstance?.closePopup?.();
      const currentVehicleId = String(selectedVehicleId ?? "");
      const isSameSelectedVehicle =
        Boolean(nextVehicleId) &&
        Boolean(currentVehicleId) &&
        nextVehicleId === currentVehicleId;

      if (!isSameSelectedVehicle) {
        handleVehicleSelect(vehicle, { origin: "map" });
        setIsPlaybackCustomRangeOpen(false);
        setPlaybackMenuOpen(true);
        return;
      }

      setSelectedVehicleState(vehicle);
      handleTogglePlaybackMenu();
    },
    [
      closeClusterObjectList,
      clusterObjectList,
      getVehicleMarkerRef,
      handleVehicleSelect,
      handleTogglePlaybackMenu,
      mapInstance,
      selectedVehicleId,
      selectedVehiclePlaybackActive,
      setSelectedVehicleState,
      setIsPlaybackCustomRangeOpen,
      setPlaybackMenuOpen,
    ]
  );

  useEffect(() => {
    if (!selectedVehicleId || !selectedSceneVehicle) return;
    const lat = Number(selectedSceneVehicle.latitude);
    const lng = Number(selectedSceneVehicle.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setSelectedVehiclePosition([lat, lng]);
    }
  }, [selectedSceneVehicle, selectedVehicleId]);

  useEffect(() => {
    const requestId = String(panelFocusRequest?.requestId ?? "");
    const focusId = String(panelFocusRequest?.focusId ?? "").trim().toLowerCase();
    if (!requestId || !focusId || lastPanelFocusRequestRef.current === requestId) return;

    const targetVehicle = canonicalVehiclesToShow.find((vehicle) =>
      matchesPanelFocusVehicle(vehicle, focusId)
    );

    if (!targetVehicle) return;

    lastPanelFocusRequestRef.current = requestId;
    clearPendingPanelFocusTimeout();
    clearPanelSwitchOverlayTimeout();
    const switchToken = panelSwitchTokenRef.current + 1;
    panelSwitchTokenRef.current = switchToken;
    setIsPanelVehicleSwitching(true);
    handleVehicleSelect(targetVehicle, { origin: "panel" });
    setClusterHoverState(null);
    closeClusterObjectList();

    const lat = Number(targetVehicle?.latitude);
    const lng = Number(targetVehicle?.longitude);
    if (!mapInstance || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setIsPanelVehicleSwitching(false);
      return;
    }

    const currentMapZoom = Number(mapInstance.getZoom?.() ?? 0);
    const needsClusterReset =
      currentMapZoom > CLUSTER_SWITCH_ZOOM ||
      Boolean(selectedVehicleId) ||
      visibleSpanBucket <= PANEL_SWITCH_CLUSTER_RESET_BUCKET;

    pendingPanelFocusTimeoutRef.current = setTimeout(() => {
      pendingPanelFocusTimeoutRef.current = null;
      if (panelSwitchTokenRef.current !== switchToken) return;

      mapInstance.stop?.();

      if (needsClusterReset) {
        const overviewBounds = buildOverviewBounds(
          canonicalVehiclesToShow,
          resolvedOverviewClusterRadiusKm,
          resolvedOverviewMinSpanKm
        );

        if (overviewBounds?.isValid?.()) {
          mapInstance.fitBounds(overviewBounds, {
            paddingTopLeft: DEFAULT_OVERVIEW_FIT_PADDING_TOP_LEFT,
            paddingBottomRight: DEFAULT_OVERVIEW_FIT_PADDING_BOTTOM_RIGHT,
            maxZoom: DEFAULT_OVERVIEW_FIT_ZOOM,
            animate: false,
          });
        }
      }

      mapInstance.setView([lat, lng], Math.max(currentMapZoom, 16), {
        animate: false,
      });
      mapInstance.invalidateSize?.(false);

      panelSwitchOverlayTimeoutRef.current = setTimeout(() => {
        panelSwitchOverlayTimeoutRef.current = null;
        if (panelSwitchTokenRef.current !== switchToken) return;
        setIsPanelVehicleSwitching(false);
      }, PANEL_SWITCH_OVERLAY_MS);
    }, PANEL_SWITCH_PREP_MS);
  }, [
    clearPanelSwitchOverlayTimeout,
    clearPendingPanelFocusTimeout,
    canonicalVehiclesToShow,
    closeClusterObjectList,
    handleVehicleSelect,
    mapInstance,
    panelFocusRequest,
    resolvedOverviewClusterRadiusKm,
    resolvedOverviewMinSpanKm,
    selectedVehicleId,
    visibleSpanBucket,
  ]);

  useEffect(() => {
    const previousStates = previousVehicleStatesRef.current;
    const next = new Map();
    (vehiclesToShow || []).forEach((vehicle) => {
      const id = getVehicleIdentity(vehicle);
      const lat = Number(vehicle?.latitude);
      const lng = Number(vehicle?.longitude);
      if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const key = String(id);
      const previousState = previousStates.get(key) || null;
      const currentPos = [lat, lng];
      const previousPos = Array.isArray(previousState?.pos) ? previousState.pos : null;
      next.set(String(id), {
        prevPos: previousPos,
        pos: currentPos,
        ts: getVehicleSourceTimestamp(vehicle),
      });
    });
    previousVehicleStatesRef.current = next;
  }, [vehiclesToShow]);

  useEffect(() => {
    if (!selectedVehicleId) return;
    if (selectedVehicleFocusOrigin !== "panel") return;
    if (!mapInstance) return;

    const token = panelPopupOpenToken;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        // Recheck to avoid opening a stale popup after a fast re-select.
        if (panelPopupOpenToken !== token) return;
        getVehicleMarkerRef(selectedVehicleId)?.current?.openPopup?.();
      }, 0);
    });

    return () => cancelAnimationFrame(raf);
  }, [
    getVehicleMarkerRef,
    mapInstance,
    panelPopupOpenToken,
    selectedVehicleFocusOrigin,
    selectedVehicleId,
  ]);

  const selectedCenter = useMemo(() => {
    if (
      selectedVehiclePosition &&
      selectedVehiclePosition.length === 2 &&
      Number.isFinite(selectedVehiclePosition[0]) &&
      Number.isFinite(selectedVehiclePosition[1])
    ) {
      return selectedVehiclePosition;
    }
    const lat = Number(selectedSceneVehicle?.latitude);
    const lng = Number(selectedSceneVehicle?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }, [selectedSceneVehicle, selectedVehiclePosition]);
  const selectedVehicleAnchorStyle = useMemo(() => {
    if (!mapInstance || !selectedCenter || isSelectedVehicleClustered) return null;
    const point = mapInstance.latLngToContainerPoint(selectedCenter);
    const shellRect = mapShellRef.current?.getBoundingClientRect?.();
    const margin = 12;
    let left = point.x + 18;
    let top = point.y - 60;

    if (shellRect) {
      left = Math.min(Math.max(margin, left), Math.max(margin, shellRect.width - 60));
      top = Math.min(Math.max(margin, top), Math.max(margin, shellRect.height - 52));
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  }, [isSelectedVehicleClustered, mapInstance, selectedCenter]);
  const playbackMenuPanelStyle = useMemo(() => {
    if (!playbackMenuOpen) return null;

    if (isMobileViewport) {
      return {
        left: "8px",
        top: "12px",
      };
    }

    if (selectedVehiclePlaybackActive) {
      const shellRect = mapShellRef.current?.getBoundingClientRect?.();
      const menuRect = playbackTopbarMenuButtonRef.current?.getBoundingClientRect?.();
      if (shellRect && menuRect) {
        return {
          left: `${menuRect.left - shellRect.left}px`,
          top: `${menuRect.bottom - shellRect.top + 8}px`,
        };
      }
    }

    if (selectedVehicleAnchorStyle) {
      const shellRect = mapShellRef.current?.getBoundingClientRect?.();
      const panelWidth = 232;
      const panelHeight = isPlaybackCustomRangeOpen ? 308 : 244;
      const gap = 10;
      const margin = 12;
      const popupLeft = Number.parseFloat(selectedVehicleAnchorStyle.left);
      const popupTop = Number.parseFloat(selectedVehicleAnchorStyle.top);
      const anchorWidth = 44;
      const anchorHeight = 44;

      if (Number.isFinite(popupLeft) && Number.isFinite(popupTop)) {
        let left = popupLeft + anchorWidth + gap;
        let top = popupTop - 6;

        if (shellRect) {
          if (left + panelWidth > shellRect.width - margin) {
            left = popupLeft - panelWidth - gap;
          }

          left = Math.min(Math.max(margin, left), Math.max(margin, shellRect.width - panelWidth - margin));
          top = Math.min(Math.max(margin, top), Math.max(margin, shellRect.height - panelHeight - margin));
        }

        return {
          left: `${left}px`,
          top: `${top}px`,
        };
      }

      return {
        left: selectedVehicleAnchorStyle.left,
        top: selectedVehicleAnchorStyle.top,
      };
    }

    return null;
  }, [isMobileViewport, isPlaybackCustomRangeOpen, playbackMenuOpen, selectedVehicleAnchorStyle, selectedVehiclePlaybackActive]);
  const playbackSettingsPanelStyle = useMemo(() => {
    if (
      playbackSettingsPosition &&
      Number.isFinite(playbackSettingsPosition.x) &&
      Number.isFinite(playbackSettingsPosition.y)
    ) {
      return {
        left: `${playbackSettingsPosition.x}px`,
        top: `${playbackSettingsPosition.y}px`,
        right: "auto",
      };
    }

    return {
      top: "56px",
      right: "14px",
      left: "auto",
    };
  }, [playbackSettingsPosition]);
  const filteredClusterVehicles = useMemo(() => {
    const vehicles = clusterObjectList?.vehicles || [];
    const normalizedSearch = objectListSearchTerm.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      const effectiveStatusKey = getObjectListStatusKey(vehicle);
      const statusMatches = clusterObjectFilter === "all" || effectiveStatusKey === clusterObjectFilter;

      if (!statusMatches) return false;
      if (!normalizedSearch) return true;

      return [
        getObjectListVehicleLabel(vehicle),
        vehicle?.imei_id,
        vehicle?.obj_name,
        vehicle?.obj_reg_no,
        vehicle?.driver_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [clusterObjectList, clusterObjectFilter, objectListSearchTerm]);
  const sidebarGroupEntries = useMemo(() => {
    if (clusterObjectList?.mode !== "sidebar") return [];

    const grouped = new Map();
    (clusterObjectList?.vehicles || []).forEach((vehicle) => {
      const label = getObjectListOrganizationLabel(vehicle);
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const entry = grouped.get(key) || { key, label, vehicles: [] };
      entry.vehicles.push(vehicle);
      grouped.set(key, entry);
    });

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        vehicles: entry.vehicles.sort((a, b) =>
          getObjectListVehicleLabel(a).localeCompare(getObjectListVehicleLabel(b), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        ),
      }))
      .sort((a, b) => b.vehicles.length - a.vehicles.length || a.label.localeCompare(b.label));
  }, [clusterObjectList]);
  const activeSidebarGroup = useMemo(() => {
    if (sidebarGroupEntries.length === 0) return null;
    return (
      sidebarGroupEntries.find((group) => group.key === activeSidebarGroupKey) ||
      sidebarGroupEntries[0]
    );
  }, [activeSidebarGroupKey, sidebarGroupEntries]);
  const sidebarVisibleVehicles = useMemo(() => {
    if (!activeSidebarGroup) return [];
    const normalizedSearch = objectListSearchTerm.trim().toLowerCase();
    const statusFilteredVehicles = activeSidebarGroup.vehicles.filter((vehicle) => {
      const effectiveStatusKey = getObjectListStatusKey(vehicle);
      return clusterObjectFilter === "all" || effectiveStatusKey === clusterObjectFilter;
    });

    if (!normalizedSearch) return statusFilteredVehicles;

    return statusFilteredVehicles.filter((vehicle) =>
      [
        getObjectListVehicleLabel(vehicle),
        vehicle?.imei_id,
        vehicle?.obj_name,
        vehicle?.obj_reg_no,
        vehicle?.driver_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [activeSidebarGroup, clusterObjectFilter, objectListSearchTerm]);
  const sidebarFilterCounts = useMemo(
    () => ({
      all: clusterObjectList?.vehicles?.length || 0,
      running: clusterStatusSummary.running,
      stopped: clusterStatusSummary.stopped,
      idle: clusterStatusSummary.idle,
      inactive: clusterStatusSummary.inactive,
    }),
    [clusterObjectList, clusterStatusSummary]
  );

  const clusterHoverGeometry = useMemo(
    () => buildClusterHoverGeometry(clusterHoverState?.points),
    [clusterHoverState]
  );
  const clusterHoverActionStyle = useMemo(() => {
    if (!clusterHoverState?.vehicles?.length) return null;

    const count = clusterHoverState.vehicles.length;
    const clusterSizePx =
      count >= 100 ? 62 : count >= 20 ? 56 : count >= 10 ? 50 : 44;
    const gap = 12;

    return {
      left: `${clusterHoverState.x + Math.round(clusterSizePx / 2) + gap}px`,
      top: `${clusterHoverState.y - 18}px`,
    };
  }, [clusterHoverState]);

  const clusterObjectPanelStyle = useMemo(() => {
    if (!clusterObjectList?.anchor) return null;
    if (clusterObjectList.mode === "sidebar") {
      return {
        left: "12px",
        top: "72px",
        maxHeight: "calc(100% - 84px)",
      };
    }

    const shellRect = mapShellRef.current?.getBoundingClientRect?.();
    const panelWidth = 308;
    const margin = 12;
    const baseX = Number(clusterObjectList.anchor.x) || 0;
    const baseY = Number(clusterObjectList.anchor.y) || 0;

    let left = baseX + 34;
    let top = baseY - 24;
    let maxHeight = 420;

    if (shellRect) {
      maxHeight = Math.max(280, Math.min(420, shellRect.height - margin * 2));

      if (left + panelWidth + margin > shellRect.width) {
        left = baseX - panelWidth - 20;
      }
      if (left < margin) left = margin;

      if (top + maxHeight + margin > shellRect.height) {
        top = shellRect.height - maxHeight - margin;
      }
      if (top < margin) top = margin;
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
      right: "auto",
      maxHeight: `${maxHeight}px`,
    };
  }, [clusterObjectList]);

  useEffect(() => {
    if (clusterObjectList?.mode !== "sidebar") return;

    const selectedGroupLabel = selectedVehicle ? getObjectListOrganizationLabel(selectedVehicle) : "";
    const selectedGroupKey = selectedGroupLabel
      ? selectedGroupLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : "";

    if (selectedGroupKey && sidebarGroupEntries.some((group) => group.key === selectedGroupKey)) {
      setActiveSidebarGroupKey((current) => current || selectedGroupKey);
      return;
    }

    if (sidebarGroupEntries.length > 0) {
      setActiveSidebarGroupKey((current) =>
        sidebarGroupEntries.some((group) => group.key === current) ? current : sidebarGroupEntries[0].key
      );
    } else {
      setActiveSidebarGroupKey("");
    }
  }, [clusterObjectList, selectedVehicle, sidebarGroupEntries]);

  useEffect(() => {
    if (!mapInstance || !selectedVehiclePlaybackActive || !activePlaybackPreset || !selectedVehicleId) {
      return;
    }

    const routeToFocus =
      playbackRoutePath.length >= 2 ? playbackRoutePath : rawPlaybackRoutePath.length >= 2 ? rawPlaybackRoutePath : [];
    const focusKey = `${selectedVehicleId}-${activePlaybackPreset}-${routeToFocus.length}`;
    if (lastPlaybackAutoFocusRef.current === focusKey) return;

    lastPlaybackAutoFocusRef.current = focusKey;
    if (routeToFocus.length >= 2) {
      const bounds = L.latLngBounds(routeToFocus);
      if (bounds.isValid()) {
        smoothFocusMapToBounds(mapInstance, bounds, {
          paddingTopLeft: [42, 96],
          paddingBottomRight: [340, 96],
          maxZoom: 17,
        });
        return;
      }
    }

    const lat = Number(selectedVehicle?.latitude);
    const lng = Number(selectedVehicle?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    smoothFocusMapToPoint(mapInstance, [lat, lng], Math.max(mapInstance.getZoom?.() ?? 0, 17));
  }, [
    activePlaybackPreset,
    mapInstance,
    playbackRoutePath,
    rawPlaybackRoutePath,
    selectedVehicle,
    selectedVehicleId,
    selectedVehiclePlaybackActive,
  ]);

  const focusPlaybackRoute = useCallback(() => {
    if (!mapInstance) return;
    if (playbackRoutePath.length >= 2) {
      const bounds = L.latLngBounds(playbackRoutePath);
      if (bounds.isValid()) {
        smoothFocusMapToBounds(mapInstance, bounds, {
          paddingTopLeft: [42, 96],
          paddingBottomRight: [340, 96],
          maxZoom: 17,
        });
        return;
      }
    }
    const lat = Number(selectedVehicle?.latitude);
    const lng = Number(selectedVehicle?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      smoothFocusMapToPoint(
        mapInstance,
        [lat, lng],
        Math.max(mapInstance.getZoom?.() ?? 0, 17)
      );
    }
  }, [mapInstance, playbackRoutePath, selectedVehicle]);

  useEffect(() => {
    if (!clusterObjectList) return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest('[data-cluster-object-list="true"]')) return;
      closeClusterObjectList();
    };

    const handleEscape = (event) => {
      if (event?.key === "Escape") closeClusterObjectList();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [clusterObjectList, closeClusterObjectList]);

  useEffect(() => {
    if (!playbackMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target || typeof target.closest !== "function") return;
      if (isMobileViewport) {
        if (
          target.closest('[data-vehicle-playback-panel="true"]') ||
          target.closest('[data-mobile-playback-fab="true"]')
        ) {
          return;
        }
      } else if (
        target.closest('[data-selected-vehicle-anchor="true"]') ||
        target.closest('[data-vehicle-playback-panel="true"]') ||
        target.closest('[data-playback-topbar-menu="true"]')
      ) {
        return;
      }
      setIsPlaybackCustomRangeOpen(false);
      setPlaybackMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event?.key === "Escape") {
        setIsPlaybackCustomRangeOpen(false);
        setPlaybackMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileViewport, playbackMenuOpen, setIsPlaybackCustomRangeOpen, setPlaybackMenuOpen]);

  useEffect(() => {
    if (!isPlaybackAlertMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest('[data-playback-alert-menu="true"]')) return;
      setIsPlaybackAlertMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event?.key === "Escape") setIsPlaybackAlertMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPlaybackAlertMenuOpen, setIsPlaybackAlertMenuOpen]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = playbackSettingsDragRef.current;
      if (!drag.active) return;

      const shellRect = mapShellRef.current?.getBoundingClientRect?.();
      const panelWidth = 276;
      const panelHeight = 430;

      const minX = 8;
      const minY = 8;
      const maxX = shellRect ? Math.max(shellRect.width - panelWidth - 8, minX) : window.innerWidth - panelWidth;
      const maxY = shellRect ? Math.max(shellRect.height - panelHeight - 8, minY) : window.innerHeight - panelHeight;
      const baseLeft = shellRect?.left ?? 0;
      const baseTop = shellRect?.top ?? 0;

      const nextX = Math.min(
        Math.max(event.clientX - baseLeft - drag.offsetX, minX),
        maxX
      );
      const nextY = Math.min(
        Math.max(event.clientY - baseTop - drag.offsetY, minY),
        maxY
      );

      setPlaybackSettingsPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      playbackSettingsDragRef.current.active = false;
      playbackSettingsDragRef.current.pointerId = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [setPlaybackSettingsPosition]);

  const handlePlaybackTopbarOpenObjectList = useCallback(() => {
    setPlaybackMenuOpen(false);
    setIsPlaybackCustomRangeOpen(false);
    activateVehicleAnimationGroup(vehiclesToShow);
    setObjectListSearchTerm("");
    setClusterObjectList({
      vehicles: vehiclesToShow,
      anchor: { x: 0, y: 0 },
      mode: "sidebar",
    });
    setClusterObjectFilter("all");
  }, [activateVehicleAnimationGroup, vehiclesToShow, setIsPlaybackCustomRangeOpen, setPlaybackMenuOpen]);

  const handlePlaybackSettingsHeaderPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target?.closest?.("button, input, select, textarea, [data-no-drag]")) return;

      const shellRect = mapShellRef.current?.getBoundingClientRect?.();
      const panelRect = event.currentTarget.parentElement?.getBoundingClientRect?.();
      if (!panelRect) return;

      const baseLeft = shellRect?.left ?? 0;
      const baseTop = shellRect?.top ?? 0;

      playbackSettingsDragRef.current = {
        active: true,
        pointerId: event.pointerId,
        offsetX: event.clientX - panelRect.left,
        offsetY: event.clientY - panelRect.top,
      };

      if (!playbackSettingsPosition) {
        setPlaybackSettingsPosition({
          x: panelRect.left - baseLeft,
          y: panelRect.top - baseTop,
        });
      }
    },
    [playbackSettingsPosition, setPlaybackSettingsPosition]
  );
  const selectedVehicleIdText = String(selectedVehicleId ?? "");
  const disableClusterSpiderfy = Boolean(clusterObjectList && clusterObjectList.mode !== "sidebar");
  const liveRenderState = useLiveMapState({
    showVehiclesLayer,
    shouldHideVehicleVisualLayers,
    shouldClusterVehicles,
    clusteredVehiclesToShow,
    handleVehicleSelect,
    handleClusterHover,
    handleClusterLeave,
    disableClusterSpiderfy,
    clusterRadiusPx,
    movingVehiclesToShow,
    selectedVehicleId: selectedVehicleIdText,
    bubbleAnimatedVehicleIds,
    showVehicleLabels: effectiveShowVehicleLabels,
    shouldShowGlobalVehicleLabels,
    selectedVehiclePlaybackActive,
    getVehicleMarkerRef,
    previousVehicleStates: previousVehicleStatesRef.current,
    handlePlaybackMenuFromPopup,
    onTelemetryOpen,
    isMobileViewport,
    selectedCenter,
    isSelectedVehicleClustered,
  });
  useEffect(() => {
    const requestId = String(playbackRequest?.requestId ?? "");
    if (!requestId || !playbackRequest?.vehicle) return;
    if (lastPlaybackRequestRef.current === requestId) return;
    lastPlaybackRequestRef.current = requestId;
    handlePlaybackMenuFromPopup(playbackRequest.vehicle);
  }, [handlePlaybackMenuFromPopup, playbackRequest]);
  const playbackScene = useMemo(
    () => ({
      shouldRenderPlaybackMapState,
      playbackSourceSamples,
      selectedPlaybackSamples,
      activePlaybackPreset,
      playbackPaused,
      playbackSpeedMultiplier,
      playbackRestartToken,
      playbackSeekValue,
      playbackSeekToken,
      setSelectedVehiclePosition,
      setPlaybackProgress,
      setPlaybackRoutePath,
      playbackCurrentMarkerInfo: playbackDerived.playbackCurrentMarkerInfo,
      playbackSettings,
      playbackRoutePath,
      rawPlaybackRoutePath,
      playbackRouteStyle: playbackDerived.playbackRouteStyle,
      playbackVisibleDataPoints: playbackDerived.playbackVisibleDataPoints,
      playbackDataPointRadius: playbackDerived.playbackDataPointRadius,
      playbackVisibleEventDescriptors: playbackDerived.playbackVisibleEventDescriptors,
      playbackMarkerPresentation: playbackDerived.playbackMarkerPresentation,
    }),
    [
      activePlaybackPreset,
      playbackDerived,
      playbackPaused,
      playbackRestartToken,
      playbackRoutePath,
      playbackSeekToken,
      playbackSeekValue,
      playbackSettings,
      playbackSourceSamples,
      rawPlaybackRoutePath,
      selectedPlaybackSamples,
      playbackSpeedMultiplier,
      setPlaybackProgress,
      setPlaybackRoutePath,
      setSelectedVehiclePosition,
      shouldRenderPlaybackMapState,
    ]
  );

  return (
    <div ref={mapShellRef} style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapCanvas
        mapKey={mapKeyRef.current}
        handleMapReady={handleMapReady}
        setCurrentZoom={setCurrentZoom}
        resolvedMapType={resolvedMapType}
        resolvedTileConfig={resolvedTileConfig}
        baseTileRenderProfile={baseTileRenderProfile}
        overlayTileRenderProfile={overlayTileRenderProfile}
        showTrafficLayer={showTrafficLayer}
        showLabelsLayer={showLabelsLayer}
        clusterHoverGeometry={clusterHoverGeometry}
        liveRenderState={liveRenderState}
        activeClusterFilter={activeMapClusterFilter}
        playbackScene={playbackScene}
        visibleSpanBucket={visibleSpanBucket}
        userLocation={userLocation}
        userLocationIcon={userLocationIcon}
        geofences={geofences}
        onGeofenceCreated={onGeofenceCreated}
        geofenceToolbarCollapsed={geofenceToolbarCollapsed}
      />

      {isZoomMaskActive && !isPanelVehicleSwitching ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1200,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at center, rgba(255, 255, 255, 0.04), rgba(244, 247, 252, 0.08))",
            backdropFilter: "blur(0.6px)",
            opacity: 1,
            transition: "opacity 120ms ease",
          }}
        />
      ) : null}

      {isPanelVehicleSwitching ? (
        <div
          aria-live="polite"
          aria-label="Switching vehicle"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(8, 13, 20, 0.18)",
            backdropFilter: "blur(2px)",
            pointerEvents: "all",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "999px",
              background: "rgba(13, 18, 27, 0.88)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 18px 48px rgba(0, 0, 0, 0.24)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <circle
                cx="9"
                cy="9"
                r="7"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="2"
              />
              <path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="#ff7a45" strokeWidth="2" strokeLinecap="round">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 9 9"
                  to="360 9 9"
                  dur="0.72s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </div>
        </div>
      ) : null}

      {/* RIGHT SIDE BLACK CONTROLS (always when mapInstance exists) */}
      {mapInstance && showBuiltInControls && (
        <MapControls
          onControlClick={() => {}}
          onZoomIn={() => mapInstance.zoomIn()}
          onZoomOut={() => mapInstance.zoomOut()}
        />
      )}
      <PlaybackOverlays
        isPlaybackCameraRestoring={isPlaybackCameraRestoring}
        onClose={playback.handlePlaybackClose}
        selectedVehicleAnchorStyle={selectedVehicleAnchorStyle}
        isMobileViewport={isMobileViewport}
        selectedVehicle={selectedVehicle}
        playbackMenuOpen={playbackMenuOpen}
        playbackMenuPanelStyle={playbackMenuPanelStyle}
        playbackApiLoading={playbackApiLoading}
        playbackApiError={playbackApiError}
        selectedVehiclePlaybackActive={selectedVehiclePlaybackActive}
        playbackApiSamples={playbackApiSamples}
        playbackHasVisiblePath={rawPlaybackRoutePath.length >= 2 || playbackRoutePath.length >= 2}
        playbackOptions={PLAYBACK_OPTIONS}
        activePlaybackPreset={activePlaybackPreset}
        isPlaybackCustomRangeOpen={isPlaybackCustomRangeOpen}
        setPlaybackRangeValidationError={setPlaybackRangeValidationError}
        setPlaybackCustomRangeDraft={setPlaybackCustomRangeDraft}
        playbackCustomRangeApplied={playbackCustomRangeApplied}
        setIsPlaybackCustomRangeOpen={setIsPlaybackCustomRangeOpen}
        applyPlaybackPreset={applyPlaybackPreset}
        playbackCustomRangeDraft={playbackCustomRangeDraft}
        playbackRangeValidationError={playbackRangeValidationError}
        setPlaybackMenuOpen={setPlaybackMenuOpen}
        applyPlaybackCustomRange={applyPlaybackCustomRange}
      />

      <PlaybackPanels
        selectedVehicle={selectedVehicle}
        selectedVehiclePlaybackActive={selectedVehiclePlaybackActive}
        showPlaybackChrome={showPlaybackChrome}
        playbackTopbarMenuButtonRef={playbackTopbarMenuButtonRef}
        controller={playback}
        metrics={playbackDerived}
        handlePlaybackTopbarOpenObjectList={handlePlaybackTopbarOpenObjectList}
        focusPlaybackRoute={focusPlaybackRoute}
        playbackSettingsPanelStyle={playbackSettingsPanelStyle}
        handlePlaybackSettingsHeaderPointerDown={handlePlaybackSettingsHeaderPointerDown}
        playbackCalculationOptions={PLAYBACK_CALCULATION_OPTIONS}
        playbackMinuteOptions={PLAYBACK_MINUTE_OPTIONS}
        playbackSpeedFilterOptions={PLAYBACK_SPEED_FILTER_OPTIONS}
        playbackSpeedLimitOptions={PLAYBACK_SPEED_LIMIT_OPTIONS}
        playbackAlertFilterOptions={PLAYBACK_ALERT_FILTER_OPTIONS}
        playbackSeatBeltOptions={PLAYBACK_SEAT_BELT_OPTIONS}
        playbackShareValidityOptions={PLAYBACK_SHARE_VALIDITY_OPTIONS}
        printPreviewMap={
          <PlaybackPrintPreviewMap
            mapType={resolvedMapType}
            resolvedTileConfig={resolvedTileConfig}
            routePath={playbackRoutePath}
            events={playbackDerived.playbackVisibleEventDescriptors}
            vehicle={selectedVehicle}
            samples={selectedPlaybackSamples}
            markerInfo={playbackDerived.playbackCurrentMarkerInfo}
          />
        }
      />

      {selectedVehiclePlaybackActive && selectedVehicle ? (
        <PlaybackBottomBar
          controller={playback}
          metrics={playbackDerived}
          showPlaybackChrome={showPlaybackChrome}
          playbackSpeedOptions={PLAYBACK_SPEED_OPTIONS}
          focusPlaybackRoute={focusPlaybackRoute}
          selectedVehicle={selectedVehicle}
          isMobileViewport={isMobileViewport}
          playbackCalculationOptions={PLAYBACK_CALCULATION_OPTIONS}
          playbackMinuteOptions={PLAYBACK_MINUTE_OPTIONS}
          playbackSpeedFilterOptions={PLAYBACK_SPEED_FILTER_OPTIONS}
          playbackSpeedLimitOptions={PLAYBACK_SPEED_LIMIT_OPTIONS}
          playbackAlertFilterOptions={PLAYBACK_ALERT_FILTER_OPTIONS}
          playbackSeatBeltOptions={PLAYBACK_SEAT_BELT_OPTIONS}
        />
      ) : null}

      {!clusterObjectList && clusterHoverState && clusterHoverState.vehicles?.length > 0 && (
        <div
          className="vtp-cluster-hover-anchor"
          style={clusterHoverActionStyle || undefined}
          onMouseEnter={() => {
            clearClusterHoverHideTimeout();
          }}
          onMouseLeave={() => {
            scheduleClusterHoverHide(340);
          }}
        >
          <div
            className="vtp-cluster-menu-btn"
            onMouseEnter={clearClusterHoverHideTimeout}
          >
            <span
              className="vtp-cluster-menu-glyph"
              role="button"
              tabIndex={0}
              title="Open object list"
              aria-label="Open object list"
              onFocus={clearClusterHoverHideTimeout}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                activateVehicleAnimationGroup(clusterHoverState.vehicles);
                setClusterObjectList({
                  vehicles: clusterHoverState.vehicles,
                  anchor: { x: clusterHoverState.x, y: clusterHoverState.y },
                });
                setClusterObjectFilter("all");
                setClusterHoverState(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                activateVehicleAnimationGroup(clusterHoverState.vehicles);
                setClusterObjectList({
                  vehicles: clusterHoverState.vehicles,
                  anchor: { x: clusterHoverState.x, y: clusterHoverState.y },
                });
                setClusterObjectFilter("all");
                setClusterHoverState(null);
              }}
            >
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
      )}

      {clusterObjectList && (
        <aside
          className={
            clusterObjectList.mode === "sidebar"
              ? "vtp-object-list-panel is-sidebar"
              : "vtp-object-list-anchor"
          }
          data-cluster-object-list="true"
          style={clusterObjectPanelStyle || undefined}
        >
          {clusterObjectList.mode === "sidebar" ? (
            <>
              <div className="vtp-sidebar-object-toolbar">
                <div className="vtp-sidebar-search-shell">
                  <input
                    type="text"
                    value={objectListSearchTerm}
                    onChange={(event) => setObjectListSearchTerm(event.target.value)}
                    placeholder="Search"
                    aria-label="Search vehicles"
                  />
                  <button type="button" className="vtp-sidebar-tool-btn" aria-label="Search vehicles">
                    <FaSearch aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="vtp-sidebar-tool-btn"
                    aria-label="Refresh object list"
                    onClick={() => {
                      setObjectListSearchTerm("");
                      if (sidebarGroupEntries.length > 0) {
                        setActiveSidebarGroupKey(sidebarGroupEntries[0].key);
                      }
                    }}
                  >
                    <FaSyncAlt aria-hidden="true" />
                  </button>
                </div>
                <div className="vtp-sidebar-filter-row">
                  <button
                    type="button"
                    className={`vtp-sidebar-filter-tab ${clusterObjectFilter === "all" ? "is-active is-all" : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => setClusterObjectFilter("all")}
                  >
                    All {sidebarFilterCounts.all}
                  </button>
                  <button
                    type="button"
                    className={`vtp-sidebar-filter-tab ${clusterObjectFilter === "running" ? "is-active is-running" : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => setClusterObjectFilter("running")}
                  >
                    Active {sidebarFilterCounts.running}
                  </button>
                  <button
                    type="button"
                    className={`vtp-sidebar-filter-tab ${clusterObjectFilter === "idle" ? "is-active is-idle" : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => setClusterObjectFilter("idle")}
                  >
                    Idle {sidebarFilterCounts.idle}
                  </button>
                  <button
                    type="button"
                    className={`vtp-sidebar-filter-tab ${clusterObjectFilter === "stopped" ? "is-active is-stopped" : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => setClusterObjectFilter("stopped")}
                  >
                    Stop {sidebarFilterCounts.stopped}
                  </button>
                  <button
                    type="button"
                    className={`vtp-sidebar-filter-tab ${clusterObjectFilter === "inactive" ? "is-active is-inactive" : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={() => setClusterObjectFilter("inactive")}
                  >
                    Inactive {sidebarFilterCounts.inactive}
                  </button>
                </div>
              </div>
              <div className="vtp-sidebar-group-list">
                {sidebarGroupEntries.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className={`vtp-sidebar-group-row ${activeSidebarGroup?.key === group.key ? "is-active" : ""}`}
                    onClick={() => setActiveSidebarGroupKey(group.key)}
                  >
                    <span>{group.label}</span>
                    <span>[ {group.vehicles.length} ]</span>
                  </button>
                ))}
              </div>
              <div className="vtp-sidebar-vehicle-list">
                {sidebarVisibleVehicles.length === 0 ? (
                  <div className="vtp-sidebar-empty">No vehicles found.</div>
                ) : (
                  sidebarVisibleVehicles.map((vehicle) => (
                    <button
                      key={getVehicleIdentity(vehicle)}
                      type="button"
                      className={`vtp-sidebar-vehicle-row ${
                        getVehicleIdentity(vehicle) === String(selectedVehicleId ?? "")
                          ? "is-active"
                          : ""
                      }`}
                      onClick={() => {
                        const lat = Number(vehicle.latitude);
                        const lng = Number(vehicle.longitude);
                        if (mapInstance && Number.isFinite(lat) && Number.isFinite(lng)) {
                          smoothFocusMapToPoint(
                            mapInstance,
                            [lat, lng],
                            Math.max(mapInstance.getZoom(), 16)
                          );
                        }
                        handleVehicleSelect(
                          vehicle,
                          selectedVehiclePlaybackActive ? { preservePlayback: true } : undefined
                        );
                      }}
                    >
                      {getObjectListVehicleLabel(vehicle)}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <ObjectListPanel
              totalCount={clusterObjectList.vehicles.length}
              vehicles={filteredClusterVehicles}
              searchTerm={objectListSearchTerm}
              onSearchChange={setObjectListSearchTerm}
              activeFilter={clusterObjectFilter}
              onFilterChange={setClusterObjectFilter}
              counts={{
                all: clusterObjectList.vehicles.length,
                running: clusterStatusSummary.running,
                stopped: clusterStatusSummary.stopped,
                idle: clusterStatusSummary.idle,
                inactive: clusterStatusSummary.inactive,
              }}
              selectedVehicleId={selectedVehicleId}
              getStatusKey={getObjectListStatusKey}
              getSignalText={getObjectListSignalText}
              statusLabels={OBJECT_STATUS_LABELS}
              onClose={closeClusterObjectList}
              onVehicleSelect={(vehicle) => {
                const lat = Number(vehicle.latitude);
                const lng = Number(vehicle.longitude);
                if (mapInstance && Number.isFinite(lat) && Number.isFinite(lng)) {
                  smoothFocusMapToPoint(
                    mapInstance,
                    [lat, lng],
                    Math.max(mapInstance.getZoom(), 16)
                  );
                }
                handleVehicleSelect(vehicle);
                closeClusterObjectList();
              }}
            />
          )}
        </aside>
      )}
    </div>
  );
};

const MemoizedMapComponent = React.memo(MapComponent, (prevProps, nextProps) => {
  return (
    prevProps.whenReady === nextProps.whenReady &&
    prevProps.mapType === nextProps.mapType &&
    prevProps.showVehiclesLayer === nextProps.showVehiclesLayer &&
    prevProps.showTrafficLayer === nextProps.showTrafficLayer &&
    prevProps.showLabelsLayer === nextProps.showLabelsLayer &&
    prevProps.showVehicleLabels === nextProps.showVehicleLabels &&
    prevProps.vehicleData === nextProps.vehicleData &&
    prevProps.onVehicleClick === nextProps.onVehicleClick &&
    prevProps.onTelemetryOpen === nextProps.onTelemetryOpen &&
    prevProps.activeGroups === nextProps.activeGroups &&
    prevProps.panelFocusRequest === nextProps.panelFocusRequest &&
    prevProps.geofences === nextProps.geofences &&
    prevProps.onGeofenceCreated === nextProps.onGeofenceCreated &&
    prevProps.onPlaybackStateChange === nextProps.onPlaybackStateChange &&
    prevProps.geofenceToolbarCollapsed === nextProps.geofenceToolbarCollapsed &&
    prevProps.showBuiltInControls === nextProps.showBuiltInControls &&
    prevProps.userLocation === nextProps.userLocation &&
    prevProps.forceClusterPreviewKey === nextProps.forceClusterPreviewKey &&
    prevProps.overviewMinSpanKm === nextProps.overviewMinSpanKm &&
    prevProps.overviewClusterRadiusKm === nextProps.overviewClusterRadiusKm &&
    prevProps.mobilePanelStatusFilter === nextProps.mobilePanelStatusFilter &&
    prevProps.playbackRequest === nextProps.playbackRequest
  );
});

MemoizedMapComponent.displayName = "MemoizedMapComponent";

export default MemoizedMapComponent;
