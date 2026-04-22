"use client";

import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  createClusterIcon,
  buildClusterStatusSummary,
} from "@/components/map/clusterHelpers";
import {
  createRotatedDivIcon,
  safelySetLeafletMarkerLatLng,
} from "@/components/map/mapHelpers";
import { getIconForVehicle } from "@/components/map/vehicleIcons";
import {
  getVehicleIdentity,
  smoothFocusMapToBounds,
  smoothFocusMapToPoint,
} from "@/components/map/viewportHelpers";

const CLUSTER_SUMMARY_CHILD_SCAN_LIMIT = 80;
const INTERACTION_ICON_LITE_HOLD_MS = 220;

const safelySetLeafletMarkerIcon = (marker, nextIcon) => {
  if (!marker?.setIcon || !marker?._map) return false;
  try {
    marker.setIcon(nextIcon);
    return true;
  } catch {
    return false;
  }
};

const getClusterMarkerVisualKey = (vehicle, baseIcon, heading) =>
  [
    String(getVehicleIdentity(vehicle) || ""),
    Number(vehicle?.latitude).toFixed(6),
    Number(vehicle?.longitude).toFixed(6),
    Number(heading || 0).toFixed(2),
    Number(vehicle?.speed_kmh ?? vehicle?.speed ?? 0).toFixed(2),
    String(baseIcon?.options?.iconUrl || ""),
  ].join("|");

const VehicleClusterLayer = ({
  vehicles,
  activeStatusFilter = "all",
  onVehicleClick,
  onClusterHover,
  onClusterLeave,
  disableSpiderfy = false,
  clusterRadiusPx = 72,
}) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const markersRef = useRef(new Map());
  const isZoomGestureActiveRef = useRef(false);
  const clusterIconLiteUntilRef = useRef(0);
  const flushClusterVehicleSyncRef = useRef(null);
  const pendingSpiderfyTimeoutRef = useRef(null);
  const disableSpiderfyRef = useRef(Boolean(disableSpiderfy));
  const clusterRadiusRef = useRef(Math.max(1, Number(clusterRadiusPx) || 72));
  const activeStatusFilterRef = useRef(String(activeStatusFilter || "all").trim().toLowerCase());

  const handlersRef = useRef({ onVehicleClick, onClusterHover, onClusterLeave });
  handlersRef.current = { onVehicleClick, onClusterHover, onClusterLeave };

  useEffect(() => {
    disableSpiderfyRef.current = Boolean(disableSpiderfy);
    if (!disableSpiderfyRef.current) return;

    if (pendingSpiderfyTimeoutRef.current) {
      clearTimeout(pendingSpiderfyTimeoutRef.current);
      pendingSpiderfyTimeoutRef.current = null;
    }

    const group = clusterGroupRef.current;
    if (group && typeof group.unspiderfy === "function") group.unspiderfy();
  }, [disableSpiderfy]);

  useEffect(() => {
    clusterRadiusRef.current = Math.max(1, Number(clusterRadiusPx) || 72);
  }, [clusterRadiusPx]);

  useEffect(() => {
    activeStatusFilterRef.current = String(activeStatusFilter || "all").trim().toLowerCase();
    const group = clusterGroupRef.current;
    if (group && typeof group.refreshClusters === "function") {
      group.refreshClusters();
    }
  }, [activeStatusFilter]);

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: () => clusterRadiusRef.current,
      animate: true,
      animateAddingMarkers: false,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      removeOutsideVisibleBounds: true,
      chunkedLoading: true,
      chunkInterval: 24,
      chunkDelay: 16,
      iconCreateFunction: (cluster) => {
        const childCount = Number(cluster?.getChildCount?.() || 0);
        const iconLiteMode =
          isZoomGestureActiveRef.current || Date.now() < clusterIconLiteUntilRef.current;
        if (iconLiteMode || childCount > CLUSTER_SUMMARY_CHILD_SCAN_LIMIT) {
          return createClusterIcon(childCount, null, activeStatusFilterRef.current);
        }
        const childVehicles =
          cluster
            .getAllChildMarkers?.()
            ?.map((marker) => marker?.options?.vehicleData)
            ?.filter(Boolean) || [];
        return createClusterIcon(
          childCount,
          buildClusterStatusSummary(childVehicles),
          activeStatusFilterRef.current
        );
      },
      zoomToBoundsOnClick: false,
    });
    clusterGroupRef.current = clusterGroup;

    const CLUSTER_EXPAND_MAX_CHILDREN = 7;

    const focusCluster = (layer) => {
      if (!layer) return;
      const bounds = layer.getBounds?.();
      if (bounds?.isValid?.()) {
        smoothFocusMapToBounds(map, bounds, { padding: [48, 48], maxZoom: 18 });
        return;
      }
      const center = layer.getLatLng?.();
      if (center) {
        smoothFocusMapToPoint(map, [center.lat, center.lng], Math.min(18, map.getZoom() + 2));
      }
    };

    const scheduleSpiderfy = (layer) => {
      if (disableSpiderfyRef.current) return;
      if (pendingSpiderfyTimeoutRef.current) {
        clearTimeout(pendingSpiderfyTimeoutRef.current);
        pendingSpiderfyTimeoutRef.current = null;
      }
      pendingSpiderfyTimeoutRef.current = setTimeout(() => {
        pendingSpiderfyTimeoutRef.current = null;
        if (!layer || disableSpiderfyRef.current) return;
        const childMarkers = layer.getAllChildMarkers?.() || [];
        if (typeof clusterGroup.unspiderfy === "function") clusterGroup.unspiderfy();
        const shouldSpiderfy =
          childMarkers.length > 0 && childMarkers.length <= CLUSTER_EXPAND_MAX_CHILDREN;
        if (shouldSpiderfy && typeof layer.spiderfy === "function") layer.spiderfy();
        handlersRef.current.onClusterLeave?.();
      }, 220);
    };

    clusterGroup.on("clusterclick", (event) => {
      const layer = event?.propagatedFrom ?? event?.layer;
      if (!layer) return;
      if (event?.originalEvent) L.DomEvent.stop(event.originalEvent);
      const childCount = Number(layer?.getChildCount?.() || 0);
      if (childCount > 0 && childCount <= CLUSTER_EXPAND_MAX_CHILDREN) {
        scheduleSpiderfy(layer);
        return false;
      }
      focusCluster(layer);
      return false;
    });

    clusterGroup.on("clusterdblclick", (event) => {
      const layer = event?.propagatedFrom ?? event?.layer;
      if (!layer) return;
      if (event?.originalEvent) L.DomEvent.stop(event.originalEvent);
      if (pendingSpiderfyTimeoutRef.current) {
        clearTimeout(pendingSpiderfyTimeoutRef.current);
        pendingSpiderfyTimeoutRef.current = null;
      }
      focusCluster(layer);
      return false;
    });

    clusterGroup.on("clustermouseover", (event) => {
      const layer = event?.propagatedFrom ?? event?.layer;
      if (!layer) return;
      const latLng = layer.getLatLng?.();
      if (!latLng) return;
      const point = map.latLngToContainerPoint(latLng);
      const childMarkers = layer.getAllChildMarkers?.() || [];
      const clusterVehicles =
        childMarkers.map((marker) => marker?.options?.vehicleData).filter(Boolean) || [];
      const clusterPoints = childMarkers
        .map((marker) => marker?.getLatLng?.())
        .filter((ll) => Number.isFinite(ll?.lat) && Number.isFinite(ll?.lng))
        .map((ll) => [ll.lat, ll.lng]);
      handlersRef.current.onClusterHover?.({
        x: point.x,
        y: point.y,
        vehicles: clusterVehicles,
        points: clusterPoints,
      });
    });

    clusterGroup.on("clustermouseout", () => {
      handlersRef.current.onClusterLeave?.();
    });

    map.addLayer(clusterGroup);
    const currentMarkers = markersRef.current;

    const onZoomStart = () => {
      isZoomGestureActiveRef.current = true;
      clusterIconLiteUntilRef.current = Date.now() + INTERACTION_ICON_LITE_HOLD_MS;
    };
    const onZoomEnd = () => {
      isZoomGestureActiveRef.current = false;
      clusterIconLiteUntilRef.current = Date.now() + INTERACTION_ICON_LITE_HOLD_MS;
      requestAnimationFrame(() => {
        flushClusterVehicleSyncRef.current?.();
      });
    };
    map.on("zoomstart", onZoomStart);
    map.on("zoomend", onZoomEnd);

    return () => {
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
      isZoomGestureActiveRef.current = false;
      if (pendingSpiderfyTimeoutRef.current) clearTimeout(pendingSpiderfyTimeoutRef.current);
      map.removeLayer(clusterGroup);
      clusterGroup.clearLayers();
      currentMarkers.clear();
      if (clusterGroupRef.current === clusterGroup) clusterGroupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    const runSync = () => {
      const group = clusterGroupRef.current;
      if (!group) return;

      if (!vehicles || vehicles.length === 0) {
        group.clearLayers();
        markersRef.current.clear();
        return;
      }

      const currentMarkers = markersRef.current;
      const incomingIds = new Set();
      const newMarkers = [];

      vehicles.forEach((vehicle) => {
        const id = String(getVehicleIdentity(vehicle));
        incomingIds.add(id);

        const lat = Number(vehicle.latitude);
        const lng = Number(vehicle.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const nextLatLng = [lat, lng];
        const heading = Number(vehicle?.angle_name || 0);
        const baseIcon = getIconForVehicle(vehicle);
        const nextVisualKey = getClusterMarkerVisualKey(vehicle, baseIcon, heading);

        if (currentMarkers.has(id)) {
          const marker = currentMarkers.get(id);
          const oldLatLng = marker.getLatLng();

          marker.options.vehicleData = vehicle;
          if (marker.__visualKey !== nextVisualKey) {
            safelySetLeafletMarkerIcon(
              marker,
              createRotatedDivIcon(baseIcon, heading, vehicle)
            );
            marker.__visualKey = nextVisualKey;
          }

          if (oldLatLng.lat !== lat || oldLatLng.lng !== lng) {
            safelySetLeafletMarkerLatLng(marker, nextLatLng);
          }
        } else {
          const marker = L.marker(nextLatLng, {
            icon: createRotatedDivIcon(baseIcon, heading, vehicle),
            vehicleData: vehicle,
            interactive: true,
            bubblingMouseEvents: false,
            keyboard: false,
          });
          marker.__visualKey = nextVisualKey;

          marker.on("click", (event) => {
            if (event?.originalEvent) L.DomEvent.stop(event.originalEvent);
            if (marker.__clickTimeout) clearTimeout(marker.__clickTimeout);
            marker.__clickTimeout = setTimeout(() => {
              marker.__clickTimeout = null;
              handlersRef.current.onVehicleClick?.(marker.options.vehicleData, { origin: "map" });
            }, 220);
          });
          marker.on("dblclick", (event) => {
            if (event?.originalEvent) L.DomEvent.stop(event.originalEvent);
            if (marker.__clickTimeout) {
              clearTimeout(marker.__clickTimeout);
              marker.__clickTimeout = null;
            }
            handlersRef.current.onVehicleClick?.(marker.options.vehicleData, { origin: "map" });
            smoothFocusMapToPoint(map, marker.getLatLng(), Math.min(18, map.getZoom() + 2));
          });

          currentMarkers.set(id, marker);
          newMarkers.push(marker);
        }
      });

      const markersToRemove = [];
      currentMarkers.forEach((marker, id) => {
        if (!incomingIds.has(id)) {
          if (marker.__clickTimeout) {
            clearTimeout(marker.__clickTimeout);
            marker.__clickTimeout = null;
          }
          markersToRemove.push(marker);
          currentMarkers.delete(id);
        }
      });

      if (markersToRemove.length > 0) group.removeLayers(markersToRemove);
      if (newMarkers.length > 0) group.addLayers(newMarkers);
    };

    flushClusterVehicleSyncRef.current = runSync;

    if (isZoomGestureActiveRef.current) return;
    runSync();
  }, [vehicles, map]);

  return null;
};

export default VehicleClusterLayer;
