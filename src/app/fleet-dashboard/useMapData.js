// src/app/fleet-dashboard/useMapData.js
import { useCallback, useMemo, useRef, useState } from 'react';

const VEHICLE_DATA_ERROR_MESSAGE =
  "We couldn't load vehicle data due to a temporary server issue. Please refresh or try again in a moment.";
const VEHICLE_CACHE_STORAGE_KEY = "vtp_live_vehicle_cache_v2";
const VEHICLE_CACHE_TTL_MS = 1000 * 60 * 2;
const VEHICLE_CACHE_MAX_ARRAY_LENGTH = 24;
const VEHICLE_CACHE_MAX_STRING_LENGTH = 240;
const PANEL_TIMESTAMP_KEYS = [
  "statusChangedAt",
  "status_changed_at",
  "lastPacketTime",
  "last_packet_time",
  "lastLocationTime",
  "last_location_time",
  "sourceTimestamp",
  "last_reporting",
  "lastReporting",
  "last_update",
  "last_updated",
  "lastUpdated",
  "gps_time",
  "gpsTime",
  "gpstime",
  "updated_at",
  "updatedAt",
  "serverTime",
  "server_time",
  "servertime",
  "device_datetime",
  "deviceDateTime",
  "deviceTime",
  "device_time",
  "timestamp",
  "time",
];
const PANEL_LOCATION_KEYS = [
  "location_name",
  "address",
  "address_text",
  "address_desc",
  "location",
  "location_desc",
  "last_address",
  "display_address",
  "distance_label",
  "distance",
  "distance_from_landmark",
  "distance_from_reference",
];

const normalizeVehicles = (vehiclesFromApi) =>
  (Array.isArray(vehiclesFromApi) ? vehiclesFromApi : [])
    .map((vehicle) => {
      if (!vehicle || typeof vehicle !== "object") {
        return null;
      }

      const latitude = Number(vehicle.latitude);
      const longitude = Number(vehicle.longitude);
      const speed = Number(vehicle.speed);
      const stableId = String(
        vehicle.id ??
          vehicle.vehicleId ??
          vehicle.imei_id ??
          vehicle.vehicle_no ??
          vehicle.obj_reg_no ??
          vehicle.obj_name ??
          `${latitude}:${longitude}`
      ).trim();

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      // Normalize in-place to avoid duplicating large vehicle objects.
      vehicle.id = stableId;
      vehicle.imei_id = String(vehicle.imei_id ?? "");
      vehicle.latitude = latitude;
      vehicle.longitude = longitude;
      vehicle.speed = Number.isFinite(speed) ? speed : -1;
      return vehicle;
    })
    .filter(Boolean);

const hasDisplayValue = (row, keys) =>
  keys.some((key) => {
    const value = row?.[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });

const isPanelCompatibleCache = (vehicles) => {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return false;

  const sample = vehicles.slice(0, 25);
  const rowsWithTimestamp = sample.filter((row) => hasDisplayValue(row, PANEL_TIMESTAMP_KEYS)).length;
  const rowsWithLocation = sample.filter((row) => hasDisplayValue(row, PANEL_LOCATION_KEYS)).length;

  return rowsWithTimestamp > 0 && rowsWithLocation > 0;
};

const getApiErrorMessage = (status, payload, fallbackText = "") => {
  const payloadMessage =
    (payload && typeof payload === "object" && (payload.message || payload.error)) ||
    "";
  const trimmedPayloadMessage = String(payloadMessage || "").trim();
  const trimmedFallbackText = String(fallbackText || "").trim();

  if (status >= 500) return VEHICLE_DATA_ERROR_MESSAGE;
  if (trimmedPayloadMessage) return trimmedPayloadMessage;
  if (trimmedFallbackText) return trimmedFallbackText;

  return VEHICLE_DATA_ERROR_MESSAGE;
};

const buildGroups = (vehicles) => {
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    return {};
  }

  const groups = {
    "Live & Moving": [],
    Parked: [],
    "Offline/Other": [],
  };

  vehicles.forEach((vehicle) => {
    if (!vehicle.id) {
      vehicle.id =
        vehicle.imei_id || vehicle.vehicle_no || vehicle.obj_reg_no || vehicle.obj_name;
    }
    if (vehicle.speed > 0) {
      groups["Live & Moving"].push(vehicle);
    } else if (vehicle.speed === 0) {
      groups.Parked.push(vehicle);
    } else {
      groups["Offline/Other"].push(vehicle);
    }
  });

  return groups;
};

const sanitizeVehicleCacheValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length > VEHICLE_CACHE_MAX_STRING_LENGTH
      ? value.slice(0, VEHICLE_CACHE_MAX_STRING_LENGTH)
      : value;
  }
  if (Array.isArray(value)) {
    if (depth > 0) return undefined;
    const compact = value.slice(0, VEHICLE_CACHE_MAX_ARRAY_LENGTH);
    return compact.every(
      (item) =>
        item === null ||
        item === undefined ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        typeof item === "string"
    )
      ? compact.map((item) => sanitizeVehicleCacheValue(item, depth + 1))
      : undefined;
  }
  if (typeof value === "object") {
    if (depth > 0) return undefined;
    const compact = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      const sanitized = sanitizeVehicleCacheValue(nestedValue, depth + 1);
      if (sanitized !== undefined) {
        compact[key] = sanitized;
      }
    });
    return Object.keys(compact).length > 0 ? compact : undefined;
  }
  return undefined;
};

const compactVehicleForCache = (vehicle) => {
  if (!vehicle || typeof vehicle !== "object") return null;

  const compact = {};
  Object.entries(vehicle).forEach(([key, value]) => {
    const sanitized = sanitizeVehicleCacheValue(value);
    if (sanitized !== undefined) {
      compact[key] = sanitized;
    }
  });

  return Object.keys(compact).length > 0 ? compact : null;
};

function readVehicleCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(VEHICLE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt || 0);
    if (!Array.isArray(parsed?.vehicles) || !Number.isFinite(savedAt)) return null;
    if (Date.now() - savedAt > VEHICLE_CACHE_TTL_MS) return null;
    const vehicles = normalizeVehicles(parsed.vehicles);
    if (!vehicles.length) return null;
    if (!isPanelCompatibleCache(vehicles)) {
      window.sessionStorage.removeItem(VEHICLE_CACHE_STORAGE_KEY);
      return null;
    }
    return {
      vehicles,
      groups: buildGroups(vehicles),
    };
  } catch {
    return null;
  }
}

function persistVehicleCache(vehicles) {
  if (typeof window === "undefined") return;
  try {
    const compactVehicles = (Array.isArray(vehicles) ? vehicles : [])
      .map((vehicle) => compactVehicleForCache(vehicle))
      .filter(Boolean);
    window.sessionStorage.setItem(
      VEHICLE_CACHE_STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        vehicles: compactVehicles,
      })
    );
  } catch {}
}

/**
 * A custom hook to fetch and process vehicle data for the map dashboard.
 * It fetches the master list from the API and categorizes vehicles into
 * operational groups (e.g., 'Live & Moving', 'Parked') for UI filtering.
 */
export function useMapData() {
  const cachedSnapshotRef = useRef(undefined);
  if (cachedSnapshotRef.current === undefined && typeof window !== "undefined") {
    cachedSnapshotRef.current = readVehicleCache();
  }

  const initialVehicles = cachedSnapshotRef.current?.vehicles || [];
  const hasInitialVehicleCache = initialVehicles.length > 0;

  // State to hold the raw, unfiltered list of all vehicles from the API
  const [allVehicles, setAllVehicles] = useState(initialVehicles);
  const latestVehiclesRef = useRef(initialVehicles);

  const [isLoading, setIsLoading] = useState(!hasInitialVehicleCache);
  const [isRefreshing, setIsRefreshing] = useState(hasInitialVehicleCache);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(hasInitialVehicleCache);
  const inflightFetchRef = useRef(null);
  const [hasFetchedFreshVehiclesOnce, setHasFetchedFreshVehiclesOnce] = useState(false);

  const applyVehicleState = useCallback((vehicles) => {
    const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
    latestVehiclesRef.current = safeVehicles;
    setAllVehicles(safeVehicles);
  }, []);
  const groupedVehicles = useMemo(() => buildGroups(allVehicles), [allVehicles]);

  const fetchCompanyMapData = useCallback(async () => {
    if (inflightFetchRef.current) {
      return inflightFetchRef.current;
    }

    const requestPromise = (async () => {
      setError(null);
      setIsLoading(!hasLoadedRef.current);
      setIsRefreshing(hasLoadedRef.current);
      try {
        const res = await fetch('/api/vehicles-with-paths');

        if (!res.ok) {
          let errorPayload = null;
          let errorText = "";

          try {
            errorPayload = await res.json();
          } catch {
            try {
              errorText = await res.text();
            } catch {
              errorText = "";
            }
          }

          const resolvedMessage = getApiErrorMessage(res.status, errorPayload, errorText);

          setError(resolvedMessage);
          applyVehicleState(hasLoadedRef.current ? latestVehiclesRef.current : []);
          hasLoadedRef.current = true;
          console.warn("Vehicle data request failed:", resolvedMessage);
          return;
        }

        const vehiclesFromApi = await res.json();
        const normalizedVehicles = normalizeVehicles(vehiclesFromApi);
        applyVehicleState(normalizedVehicles);
        if (normalizedVehicles.length > 0) {
          persistVehicleCache(normalizedVehicles);
        }
        hasLoadedRef.current = true;
        setHasFetchedFreshVehiclesOnce(true);
      } catch (err) {
        const resolvedMessage = VEHICLE_DATA_ERROR_MESSAGE;
        setError(resolvedMessage);
        applyVehicleState(hasLoadedRef.current ? latestVehiclesRef.current : []);
        hasLoadedRef.current = true;
        console.warn("Vehicle data request failed:", resolvedMessage);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        inflightFetchRef.current = null;
      }
    })();

    inflightFetchRef.current = requestPromise;
    return requestPromise;
  }, [applyVehicleState]);

  return {
    allVehicles, // The full, unprocessed list of vehicles
    groupedVehicles, // The categorized object for your UI (e.g., sidebar)
    isLoading,
    isRefreshing,
    hasFetchedFreshVehiclesOnce,
    error,
    fetchCompanyMapData,
  };
}
