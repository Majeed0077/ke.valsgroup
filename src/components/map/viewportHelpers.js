import L from "leaflet";
import { haversineMeters } from "@/components/map/mapHelpers";

export const DEFAULT_VISIBLE_SPAN_BUCKET_LIMITS = [0.8, 1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 40, 50, 200];
export const MAX_VIEWPORT_OPEN_VEHICLES = 140;
export const CLUSTER_SWITCH_ZOOM = 11;
export const CLUSTER_SWITCH_AREA_KM = 18;
export const CLUSTER_ENABLE_AREA_KM = 75;
export const CLUSTER_DISABLE_AREA_KM = 60;
export const DEFAULT_OVERVIEW_FIT_ZOOM = CLUSTER_SWITCH_ZOOM + 1;
export const DEFAULT_OVERVIEW_FIT_PADDING_TOP_LEFT = [36, 40];
export const DEFAULT_OVERVIEW_FIT_PADDING_BOTTOM_RIGHT = [36, 120];
export const SOFT_MAP_EASE = 0.2;
export const SOFT_MAP_DURATION = 0.65;
export const PANEL_SWITCH_OVERLAY_MS = 900;
export const PANEL_SWITCH_PREP_MS = 70;
export const DEFAULT_OVERVIEW_MIN_SPAN_KM = 1600;

export const userLocationIcon = L.divIcon({
  className: "user-location-pin-wrapper",
  html: `
    <div class="user-location-pin">
      <span class="user-location-core"></span>
      <span class="user-location-pulse"></span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export const getVehicleIdentity = (vehicle) => {
  const latitude = Number(vehicle?.latitude);
  const longitude = Number(vehicle?.longitude);
  return String(
    vehicle?.id ||
      vehicle?.vehicleId ||
      vehicle?.imei_id ||
      vehicle?.vehicle_no ||
      vehicle?.obj_reg_no ||
      vehicle?.obj_name ||
      (Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `${latitude.toFixed(6)}:${longitude.toFixed(6)}`
        : `${vehicle?.latitude ?? "x"}:${vehicle?.longitude ?? "y"}`)
  ).trim();
};

export const dedupeVehicleList = (vehicles) => {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return [];

  const identityIndex = new Map();
  const deduped = [];

  vehicles.forEach((vehicle) => {
    const identity = getVehicleIdentity(vehicle);
    if (!identity) return;

    if (identityIndex.has(identity)) {
      deduped[identityIndex.get(identity)] = vehicle;
      return;
    }

    identityIndex.set(identity, deduped.length);
    deduped.push(vehicle);
  });

  return deduped;
};

export const getVisibleSpanBucket = (spanKm, limits = DEFAULT_VISIBLE_SPAN_BUCKET_LIMITS) => {
  const span = Number(spanKm);
  if (!Number.isFinite(span)) return limits.length;
  const bucketIndex = limits.findIndex((limit) => span <= limit);
  return bucketIndex === -1 ? limits.length : bucketIndex;
};

export const getClusterRadiusPxForBucket = (visibleSpanBucket, bucketCount = DEFAULT_VISIBLE_SPAN_BUCKET_LIMITS.length) => {
  if (!Number.isFinite(Number(visibleSpanBucket))) return 84;
  if (visibleSpanBucket >= bucketCount) return 84;
  if (visibleSpanBucket >= 12) return 76;
  if (visibleSpanBucket >= 10) return 70;
  if (visibleSpanBucket >= 8) return 62;
  if (visibleSpanBucket >= 6) return 56;
  if (visibleSpanBucket >= 4) return 50;
  return 44;
};

export const getVisibleSpanKm = (map) => {
  if (!map || typeof map.getBounds !== "function") return Number.POSITIVE_INFINITY;
  const bounds = map.getBounds();
  if (!bounds || typeof bounds.getCenter !== "function") return Number.POSITIVE_INFINITY;

  const center = bounds.getCenter();
  const west = bounds.getWest();
  const east = bounds.getEast();
  if (!Number.isFinite(center?.lat) || !Number.isFinite(west) || !Number.isFinite(east)) {
    return Number.POSITIVE_INFINITY;
  }

  const meters = map.distance(
    L.latLng(center.lat, west),
    L.latLng(center.lat, east)
  );
  return Number.isFinite(meters) ? meters / 1000 : Number.POSITIVE_INFINITY;
};

export const expandBoundsToMinimumSpan = (bounds, minSpanKm) => {
  if (!bounds?.isValid?.()) return bounds;

  const center = bounds.getCenter();
  if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) return bounds;

  const minLatDelta = minSpanKm / 111;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const minLngDelta = minSpanKm / (111 * Math.max(Math.abs(cosLat), 0.2));

  const currentLatDelta = Math.abs(bounds.getNorth() - bounds.getSouth());
  const currentLngDelta = Math.abs(bounds.getEast() - bounds.getWest());

  const finalLatDelta = Math.max(currentLatDelta, minLatDelta);
  const finalLngDelta = Math.max(currentLngDelta, minLngDelta);

  return L.latLngBounds(
    [center.lat - finalLatDelta / 2, center.lng - finalLngDelta / 2],
    [center.lat + finalLatDelta / 2, center.lng + finalLngDelta / 2]
  );
};

export const smoothFocusMapToPoint = (map, latLng, targetZoom, ease = 0.2, duration = 0.65) => {
  if (!map || !Array.isArray(latLng) || latLng.length !== 2) return;
  const lat = Number(latLng[0]);
  const lng = Number(latLng[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const currentCenter = map.getCenter?.();
  const currentZoom = Number(map.getZoom?.() ?? 0);
  const nextZoom = Number.isFinite(Number(targetZoom)) ? Number(targetZoom) : currentZoom;

  map.stop?.();

  if (
    Number.isFinite(currentCenter?.lat) &&
    Number.isFinite(currentCenter?.lng) &&
    currentZoom === nextZoom
  ) {
    const distance = map.distance?.(L.latLng(currentCenter.lat, currentCenter.lng), L.latLng(lat, lng));
    if (Number.isFinite(distance) && distance < 3500) {
      map.panTo([lat, lng], {
        animate: true,
        duration: 0.45,
        easeLinearity: ease,
      });
      return;
    }
  }

  map.setView([lat, lng], nextZoom, {
    animate: true,
    duration,
    easeLinearity: ease,
  });
};

export const smoothFocusMapToBounds = (map, bounds, options = {}, ease = 0.2, duration = 0.65) => {
  if (!map || !bounds?.isValid?.()) return;
  map.stop?.();
  map.fitBounds(bounds, {
    animate: true,
    duration,
    easeLinearity: ease,
    ...options,
  });
};

export const getOverviewVehicles = (vehicles, clusterRadiusKm = 0) => {
  if (!Array.isArray(vehicles) || vehicles.length <= 1 || !(clusterRadiusKm > 0)) {
    return Array.isArray(vehicles) ? vehicles : [];
  }

  const thresholdMeters = clusterRadiusKm * 1000;
  let bestCluster = [vehicles[0]];
  let bestAverageDistance = Number.POSITIVE_INFINITY;

  vehicles.forEach((anchorVehicle) => {
    const anchorPoint = [Number(anchorVehicle.latitude), Number(anchorVehicle.longitude)];
    if (!Number.isFinite(anchorPoint[0]) || !Number.isFinite(anchorPoint[1])) return;

    const members = vehicles.filter((vehicle) => {
      const point = [Number(vehicle.latitude), Number(vehicle.longitude)];
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false;
      return haversineMeters(anchorPoint, point) <= thresholdMeters;
    });

    const averageDistance =
      members.reduce((sum, vehicle) => {
        const point = [Number(vehicle.latitude), Number(vehicle.longitude)];
        return sum + haversineMeters(anchorPoint, point);
      }, 0) / Math.max(members.length, 1);

    if (
      members.length > bestCluster.length ||
      (members.length === bestCluster.length && averageDistance < bestAverageDistance)
    ) {
      bestCluster = members;
      bestAverageDistance = averageDistance;
    }
  });

  return bestCluster;
};

export const buildOverviewBounds = (vehicles, overviewClusterRadiusKm, overviewMinSpanKm) => {
  const overviewVehicles = getOverviewVehicles(vehicles, overviewClusterRadiusKm);
  const bounds = L.latLngBounds(
    overviewVehicles
      .map((vehicle) => [Number(vehicle?.latitude), Number(vehicle?.longitude)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
  );

  if (!bounds.isValid()) return null;
  return expandBoundsToMinimumSpan(bounds, overviewMinSpanKm);
};
