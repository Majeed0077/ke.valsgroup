"use client";

import React, { Suspense, useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import AccessGuardState from "@/components/AccessGuardState";
import MapControls from "@/components/MapControls";
import MapTypeSwitcher from "@/components/MapTypeSwitcher";
import MeasurePopup from "@/components/MeasurePopup";
import { FaPlay } from "react-icons/fa";
import TelemetryPanel from "@/components/TelemetryPanel";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuth } from "@/app/fleet-dashboard/useAuth";
import { useMapData } from "@/app/fleet-dashboard/useMapData";
import { getVehicleStatusSummary } from "@/lib/vehicleStatus";
import { useMenuAccess } from "@/lib/useRbacAccess";
import { useAppShell, useConfigureAppShell } from "@/components/AppShellContext";
import CenteredCarLoader from "@/components/CenteredCarLoader";
import styles from "@/app/page.module.css";

const Tracking = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <CenteredCarLoader scope="page" />,
});

const VEHICLE_POLL_INTERVAL_MS = 15000;
const REMOTE_SEARCH_TIMEOUT_MS = 1800;
const PANEL_VEHICLE_FOCUS_EVENT = "vtp:focus-vehicle";
const SEARCH_CACHE_LIMIT = 60;

const setBoundedCacheEntry = (cache, key, value, maxEntries = SEARCH_CACHE_LIMIT) => {
  if (!(cache instanceof Map) || !key) return;
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
};

function TrackingPageContent() {
  const searchParams = useSearchParams();
  const mapRef = useRef(null);
  const mobileSearchReqRef = useRef(0);
  const searchResultCacheRef = useRef(new Map());
  const searchSuggestCacheRef = useRef(new Map());
  const [isMapReady, setIsMapReady] = useState(false);
  const [activeGroups, setActiveGroups] = useState([]);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [showVehicleLabels, setShowVehicleLabels] = useState(false);
  const [mapType, setMapType] = useState("google_roadmap");
  const [isMapTypeOpen, setIsMapTypeOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [clusterPreviewResetKey, setClusterPreviewResetKey] = useState(0);
  const [isMeasurePopupOpen, setIsMeasurePopupOpen] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [measurementTool, setMeasurementTool] = useState({
    enabled: false,
    mode: "distance",
    distanceUnit: "km",
    areaUnit: "sq_km",
  });
  const [measurementClearToken, setMeasurementClearToken] = useState(0);
  const [measurementSummary, setMeasurementSummary] = useState(null);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [telemetryVehicle, setTelemetryVehicle] = useState(null);
  const [mobilePlaybackRequest, setMobilePlaybackRequest] = useState(null);
  const [panelFocusRequest, setPanelFocusRequest] = useState(null);
  const [geofences, setGeofences] = useState([]);
  const [geofenceError, setGeofenceError] = useState(null);
  const [pendingGeofenceShape, setPendingGeofenceShape] = useState(null);
  const [geofenceName, setGeofenceName] = useState("");
  const [isSavingGeofence, setIsSavingGeofence] = useState(false);
  const [isGeofenceToolbarCollapsed, setIsGeofenceToolbarCollapsed] = useState(true);
  const [infoMessage, setInfoMessage] = useState(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileSearchTerm, setMobileSearchTerm] = useState("");
  const [mobileSuggestions, setMobileSuggestions] = useState([]);
  const [isMobileSuggesting, setIsMobileSuggesting] = useState(false);
  const [showMobileSuggestions, setShowMobileSuggestions] = useState(false);
  const [mobileStatusFilter, setMobileStatusFilter] = useState("total");
  const { authChecked, isAuthenticated } = useAuth();
  const {
    allVehicles,
    groupedVehicles,
    isLoading,
    hasFetchedFreshVehiclesOnce,
    error,
    fetchCompanyMapData,
  } = useMapData();
  const { ready: accessReady, canView: canViewTracking } = useMenuAccess("tracking");
  const { shellActive } = useAppShell();
  const isAdminEmbeddedView = searchParams.get("admin_view") === "1";
  const isMapOnlyEmbeddedView = isAdminEmbeddedView && searchParams.get("map_only") === "1";
  const hasDeferredShellDataStartedRef = useRef(false);
  const isTrackingBootReady =
    authChecked && isAuthenticated && hasFetchedFreshVehiclesOnce;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "vtp_pending_track_focus_v1";
    let payload = null;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    } finally {
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
    }

    const focusId = String(payload?.focusId || "").trim();
    const issuedAt = Number(payload?.issuedAt || 0);
    if (!focusId) return;
    if (Number.isFinite(issuedAt) && issuedAt > 0 && Date.now() - issuedAt > 1000 * 60 * 10) return;

    setPanelFocusRequest({
      requestId: `notif-${focusId}-${Date.now()}`,
      focusId,
    });
    setShowVehicles(true);
  }, []);

  const fetchJsonWithTimeout = useCallback(async (url) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REMOTE_SEARCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (authChecked && isAuthenticated) fetchCompanyMapData();
  }, [authChecked, isAuthenticated, fetchCompanyMapData]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return undefined;

    const refreshVehicles = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetchCompanyMapData();
    };

    const intervalId = window.setInterval(refreshVehicles, VEHICLE_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCompanyMapData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authChecked, isAuthenticated, fetchCompanyMapData]);

  useEffect(() => {
    if (activeGroups.length === 0 && Object.keys(groupedVehicles).length > 0) {
      setActiveGroups(Object.keys(groupedVehicles));
    }
  }, [groupedVehicles, activeGroups.length]);

  useEffect(() => {
    searchSuggestCacheRef.current.clear();
  }, [allVehicles, geofences, groupedVehicles]);

  const vehicleMatchesFocus = useCallback((vehicle, focusId) => {
    const normalizedFocusId = String(focusId || "").trim().toLowerCase();
    if (!normalizedFocusId) return false;

    return [
      vehicle?.id,
      vehicle?.imei_id,
      vehicle?.vehicle_no,
      vehicle?.obj_reg_no,
      vehicle?.obj_name,
      vehicle?.vehicle_name,
    ].some((value) => String(value || "").trim().toLowerCase() === normalizedFocusId);
  }, []);

  const requestVehiclePanelFocus = useCallback((focusId) => {
    const nextFocusId = String(focusId || "").trim();
    if (!nextFocusId) return false;
    setPanelFocusRequest({
      requestId: `${nextFocusId}-${Date.now()}`,
      focusId: nextFocusId,
    });
    setShowVehicles(true);
    return true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handlePanelVehicleFocus = (event) => {
      const detail = event?.detail || {};
      const focusKeys = [
        detail?.imeiId,
        detail?.vehicleId,
        detail?.vehicleNo,
        detail?.vehicleName,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);

      if (focusKeys.length === 0) return;

      const targetVehicle = allVehicles.find((vehicle) =>
        focusKeys.some((key) => vehicleMatchesFocus(vehicle, key))
      );

      if (!targetVehicle) return;

      const nextFocusId = String(
        targetVehicle.id ||
        targetVehicle.imei_id ||
          targetVehicle.vehicle_no ||
          targetVehicle.obj_reg_no ||
          targetVehicle.obj_name ||
          targetVehicle.vehicle_name ||
          ""
      ).trim();

      if (!nextFocusId) return;

      setPanelFocusRequest({
        requestId: `${nextFocusId}-${Date.now()}`,
        focusId: nextFocusId,
      });
      setShowVehicles(true);

    };

    window.addEventListener(PANEL_VEHICLE_FOCUS_EVENT, handlePanelVehicleFocus);
    return () => window.removeEventListener(PANEL_VEHICLE_FOCUS_EVENT, handlePanelVehicleFocus);
  }, [allVehicles, vehicleMatchesFocus]);

  const fetchGeofences = useCallback(async () => {
    setGeofenceError(null);
    try {
      const response = await fetch("/api/geofences");
      if (!response.ok) throw new Error("Failed to fetch geofences");
      const data = await response.json();
      setGeofences(Array.isArray(data) ? data : []);
    } catch (error) {
      setGeofenceError(error.message);
    }
  }, []);

  useEffect(() => {
    if (!isTrackingBootReady || hasDeferredShellDataStartedRef.current) return undefined;
    hasDeferredShellDataStartedRef.current = true;
    const timer = setTimeout(() => {
      fetchGeofences();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchGeofences, isTrackingBootReady]);

  const handleGeofenceCreated = useCallback(
    async (geofenceShape) => {
      setGeofenceError(null);
      setGeofenceName("");
      setPendingGeofenceShape(geofenceShape);
    },
    []
  );

  const closeGeofenceModal = useCallback(() => {
    if (isSavingGeofence) return;
    setPendingGeofenceShape(null);
    setGeofenceName("");
  }, [isSavingGeofence]);

  const saveGeofence = useCallback(async () => {
    if (!pendingGeofenceShape) return;
    const trimmedName = geofenceName.trim();
    if (!trimmedName) {
      setGeofenceError("Please enter a geofence name.");
      return;
    }

    setIsSavingGeofence(true);
    setGeofenceError(null);

    try {
      const response = await fetch("/api/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          type: pendingGeofenceShape.type,
          data: pendingGeofenceShape.data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save geofence");
      }

      await fetchGeofences();
      setInfoMessage(`${trimmedName} geofence saved successfully.`);
      setPendingGeofenceShape(null);
      setGeofenceName("");
    } catch (error) {
      setGeofenceError(error.message);
    } finally {
      setIsSavingGeofence(false);
    }
  }, [fetchGeofences, geofenceName, pendingGeofenceShape]);

  const getFirstVisibleVehicle = useCallback(() => {
    const groupsToCheck =
      activeGroups && activeGroups.length > 0 ? activeGroups : Object.keys(groupedVehicles || {});
    for (const group of groupsToCheck) {
      const vehicles = groupedVehicles?.[group] || [];
      const found = vehicles.find(
        (v) => v && Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude))
      );
      if (found) return found;
    }
    return null;
  }, [activeGroups, groupedVehicles]);

  const normalizeSearchText = useCallback((value) => String(value || "").trim().toLowerCase(), []);

  const getGeofenceCenter = useCallback((geofence) => {
    if (!geofence || typeof geofence !== "object") return null;

    if (geofence.type === "Circle" && geofence.circle?.center) {
      return {
        lat: Number(geofence.circle.center.lat),
        lon: Number(geofence.circle.center.lng),
      };
    }

    if (geofence.type === "Marker" && geofence.marker?.point) {
      return {
        lat: Number(geofence.marker.point.lat),
        lon: Number(geofence.marker.point.lng),
      };
    }

    if (geofence.type === "Rectangle" && geofence.rectangle?.bounds) {
      const northEast = geofence.rectangle.bounds.northEast;
      const southWest = geofence.rectangle.bounds.southWest;
      if (northEast && southWest) {
        return {
          lat: (Number(northEast.lat) + Number(southWest.lat)) / 2,
          lon: (Number(northEast.lng) + Number(southWest.lng)) / 2,
        };
      }
    }

    if (geofence.type === "Polygon" && Array.isArray(geofence.polygon?.coordinates?.[0])) {
      const points = geofence.polygon.coordinates[0]
        .map(([lng, lat]) => ({ lat: Number(lat), lon: Number(lng) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
      if (points.length) {
        const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
        const lon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
        return { lat, lon };
      }
    }

    return null;
  }, []);

  const getLocalSearchMatches = useCallback((term) => {
    const query = normalizeSearchText(term);
    if (!query) return [];

    const matches = [];
    const seen = new Set();

    const addMatch = (item) => {
      if (!item) return;
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const key = `${item.type}:${item.id}:${lat}:${lon}`;
      if (seen.has(key)) return;
      seen.add(key);
      matches.push({ ...item, lat, lon });
    };

    allVehicles.forEach((vehicle) => {
      const tokens = [
        vehicle?.vehicle_no,
        vehicle?.obj_name,
        vehicle?.obj_reg_no,
        vehicle?.imei_id,
        vehicle?.driver_name,
      ]
        .map(normalizeSearchText)
        .filter(Boolean);

      if (!tokens.some((token) => token.includes(query))) return;

      addMatch({
        id: vehicle.id || vehicle.imei_id || vehicle.vehicle_no || vehicle.obj_name,
        type: "vehicle",
        label: vehicle.vehicle_no || vehicle.obj_name || vehicle.obj_reg_no || "Vehicle",
        subLabel: [vehicle.obj_name, vehicle.imei_id].filter(Boolean).join(" • "),
        lat: vehicle.latitude,
        lon: vehicle.longitude,
        rank: 0,
      });
    });

    Object.entries(groupedVehicles || {}).forEach(([groupName, vehicles]) => {
      if (!normalizeSearchText(groupName).includes(query)) return;
      const anchorVehicle = (vehicles || []).find(
        (vehicle) =>
          vehicle &&
          Number.isFinite(Number(vehicle.latitude)) &&
          Number.isFinite(Number(vehicle.longitude))
      );
      if (!anchorVehicle) return;
      addMatch({
        id: groupName,
        type: "group",
        label: groupName,
        subLabel: `${(vehicles || []).length} vehicles`,
        lat: anchorVehicle.latitude,
        lon: anchorVehicle.longitude,
        rank: 1,
      });
    });

    geofences.forEach((geofence) => {
      const label = String(geofence?.name || "");
      if (!normalizeSearchText(label).includes(query)) return;
      const center = getGeofenceCenter(geofence);
      if (!center) return;
      addMatch({
        id: geofence._id || geofence.name,
        type: "geofence",
        label,
        subLabel: geofence.type || "Geofence",
        lat: center.lat,
        lon: center.lon,
        rank: 1,
      });
    });

    return matches.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  }, [allVehicles, geofences, getGeofenceCenter, groupedVehicles, normalizeSearchText]);

  const handleSearch = useCallback(async (term) => {
    if (!term?.trim()) return setSearchError("Please enter a location.");
    if (!mapRef.current) return setSearchError("Map not ready.");

    const query = term.trim();
    const normalizedQuery = normalizeSearchText(query);
    const localMatches = getLocalSearchMatches(query);
    if (localMatches.length > 0) {
      const topMatch = localMatches[0];
      setSearchError(null);
      if (topMatch.type === "vehicle") {
        requestVehiclePanelFocus(topMatch.id || topMatch.label);
        return;
      }
      mapRef.current.flyTo([Number(topMatch.lat), Number(topMatch.lon)], topMatch.type === "vehicle" ? 16 : 14);
      return;
    }

    const cached = searchResultCacheRef.current.get(normalizedQuery);
    if (cached) {
      setSearchError(null);
      mapRef.current.flyTo([Number(cached.lat), Number(cached.lon)], 15);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await fetchJsonWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      if (data?.length > 0) {
        const { lat, lon } = data[0];
        setBoundedCacheEntry(searchResultCacheRef.current, normalizedQuery, {
          lat: Number(lat),
          lon: Number(lon),
        });
        mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 15);
      } else {
        setSearchError(`Location "${query}" not found.`);
      }
    } catch (err) {
      const message =
        err?.name === "AbortError"
          ? "Search timed out. Use a vehicle/geofence name or try again."
          : `Search error: ${err.message}`;
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  }, [fetchJsonWithTimeout, getLocalSearchMatches, normalizeSearchText, requestVehiclePanelFocus]);

  const handleSearchSuggest = useCallback(async (term) => {
    const query = String(term || "").trim();
    if (query.length < 2) return [];

    const normalizedQuery = normalizeSearchText(query);
    const cached = searchSuggestCacheRef.current.get(normalizedQuery);
    if (cached) return cached;

    const localMatches = getLocalSearchMatches(query).slice(0, 5);
    if (localMatches.length > 0) {
      setBoundedCacheEntry(searchSuggestCacheRef.current, normalizedQuery, localMatches);
      return localMatches;
    }

    const data = await fetchJsonWithTimeout(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&countrycodes=pk&limit=10&dedupe=1&q=${encodeURIComponent(
        query
      )}`
    ).catch(() => []);
    if (!Array.isArray(data)) return [];

    const rankType = (item) => {
      const a = item?.address || {};
      const cls = String(item?.class || "").toLowerCase();
      const typ = String(item?.type || "").toLowerCase();

      const isCity =
        Boolean(a.city || a.town || a.village || a.county || a.state_district) ||
        ["city", "town", "village", "county", "state", "administrative"].includes(typ);
      if (isCity) return 0;

      const isArea =
        Boolean(a.suburb || a.neighbourhood || a.quarter || a.hamlet || a.city_district) ||
        ["suburb", "neighbourhood", "quarter", "hamlet"].includes(typ);
      if (isArea) return 1;

      const isStreet =
        Boolean(a.road || a.pedestrian || a.residential || a.highway) ||
        cls === "highway" ||
        ["road", "residential", "pedestrian", "service", "living_street"].includes(typ);
      if (isStreet) return 2;

      return 3;
    };

    const mapped = data.map((item) => {
      const a = item?.address || {};
      const named = item?.namedetails?.name || item?.name;
      const primary =
        named ||
        a.road ||
        a.neighbourhood ||
        a.suburb ||
        a.quarter ||
        a.city_district ||
        a.city ||
        a.town ||
        a.village ||
        item.name ||
        item.display_name;
      const area = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.county;
      const city = a.city || a.town || a.village || a.state_district || a.county;
      const sub = [area, city, a.state, a.country].filter(Boolean).join(", ");
      const rank = rankType(item);
      return {
        id: item.place_id,
        label: primary,
        subLabel: sub,
        lat: Number(item.lat),
        lon: Number(item.lon),
        display_name: item.display_name,
        rank,
      };
    });

    const deduped = [];
    const seen = new Set();
    for (const item of [...localMatches, ...mapped]) {
      const key = `${item.label}|${item.lat}|${item.lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const finalResults = deduped.sort((a, b) => a.rank - b.rank).slice(0, 7);
    setBoundedCacheEntry(searchSuggestCacheRef.current, normalizedQuery, finalResults);
    return finalResults;
  }, [fetchJsonWithTimeout, getLocalSearchMatches, normalizeSearchText]);

  const handleSearchPick = useCallback((suggestion) => {
    if (!mapRef.current || !suggestion) return;
    if (suggestion.type === "vehicle") {
      setSearchError(null);
      requestVehiclePanelFocus(suggestion.id || suggestion.label);
      return;
    }
    const lat = Number(suggestion.lat);
    const lon = Number(suggestion.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setSearchError(null);
    mapRef.current.flyTo([lat, lon], 13);
  }, [requestVehiclePanelFocus]);

  const shellHeaderProps = useMemo(
    () => ({
      onSearch: handleSearch,
      onSearchSuggest: handleSearchSuggest,
      onSearchPick: handleSearchPick,
      isSearching,
      statusFilter: mobileStatusFilter,
      onStatusFilterChange: setMobileStatusFilter,
      hideAuthActions: !authChecked || !isAuthenticated,
    }),
    [
      authChecked,
      handleSearch,
      handleSearchPick,
      handleSearchSuggest,
      isAuthenticated,
      isSearching,
      mobileStatusFilter,
    ]
  );

  const shellSidebarProps = useMemo(
    () => ({
      vehicles: allVehicles,
      isVehiclesLoading: isLoading,
      vehiclesError: error,
      onRefreshVehicles: fetchCompanyMapData,
      onMobileStatusFilterChange: setMobileStatusFilter,
    }),
    [allVehicles, error, fetchCompanyMapData, isLoading]
  );

  useConfigureAppShell({
    headerVisible: true,
    headerProps: shellHeaderProps,
    sidebarProps: shellSidebarProps,
  });

  useEffect(() => {
    const query = mobileSearchTerm.trim();
    if (!isMobileView || query.length < 2) {
      setMobileSuggestions([]);
      setIsMobileSuggesting(false);
      return undefined;
    }

    const requestId = ++mobileSearchReqRef.current;
    setIsMobileSuggesting(true);

    const timer = setTimeout(async () => {
      try {
        const next = await handleSearchSuggest(query);
        if (requestId !== mobileSearchReqRef.current) return;
        setMobileSuggestions(Array.isArray(next) ? next : []);
        setShowMobileSuggestions(true);
      } catch {
        if (requestId !== mobileSearchReqRef.current) return;
        setMobileSuggestions([]);
      } finally {
        if (requestId === mobileSearchReqRef.current) setIsMobileSuggesting(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [mobileSearchTerm, handleSearchSuggest, isMobileView]);

  useEffect(() => {
    if (!isTelemetryOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target || typeof target.closest !== "function") return;

      const clickedInsideTelemetry = Boolean(target.closest('[data-telemetry-panel="true"]'));
      const clickedPlaybackFab = Boolean(target.closest('[data-mobile-playback-fab="true"]'));
      const clickedVehicleSurface = Boolean(
        target.closest(
          ".leaflet-marker-icon, .leaflet-popup, .vtp-cluster-shell, .vtp-cluster-hover-anchor, .vtp-cluster-menu-btn, .vtp-selected-vehicle-anchor, .vtp-vehicle-playback-panel"
        )
      );

      if (clickedInsideTelemetry || clickedPlaybackFab || clickedVehicleSurface) return;

      setIsTelemetryOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isTelemetryOpen]);

  const handleTelemetryClose = useCallback(() => {
    setIsTelemetryOpen(false);
    if (isMobileView) {
      setMobilePlaybackRequest(null);
    }
  }, [isMobileView]);

  const handleVehicleSurfaceSelect = useCallback(
    (vehicle) => {
      if (!vehicle) return;
      setTelemetryVehicle(vehicle);
      if (isMobileView) {
        setMobilePlaybackRequest(null);
        setIsTelemetryOpen(true);
      }
    },
    [isMobileView]
  );

  const handleTelemetryOpen = useCallback(
    (vehicle) => {
      if (!vehicle) return;

      const incomingVehicleKey =
        vehicle?.id ||
        vehicle?.imei_id ||
        vehicle?.vehicle_no ||
        vehicle?.obj_reg_no ||
        vehicle?.obj_name ||
        vehicle?.vehicle_name ||
        "";

      const isSameTelemetryVehicle =
        telemetryVehicle && vehicleMatchesFocus(telemetryVehicle, incomingVehicleKey);

      if (isMobileView) {
        setTelemetryVehicle(vehicle);
        setMobilePlaybackRequest(null);
        setIsTelemetryOpen(true);
        return;
      }

      if (isTelemetryOpen && isSameTelemetryVehicle) {
        setIsTelemetryOpen(false);
        return;
      }

      setTelemetryVehicle(vehicle);
      setIsTelemetryOpen(true);
    },
    [isMobileView, isTelemetryOpen, telemetryVehicle, vehicleMatchesFocus]
  );

  const openVehicleNavigation = useCallback(
    (vehicle, origin = null) => {
      const lat = Number(vehicle?.latitude);
      const lng = Number(vehicle?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setInfoMessage("Selected vehicle has no valid GPS location.");
        return false;
      }

      const destination = `${lat},${lng}`;
      const originQuery =
        origin &&
        Number.isFinite(Number(origin.lat)) &&
        Number.isFinite(Number(origin.lng))
          ? `&origin=${Number(origin.lat)},${Number(origin.lng)}`
          : "";
      const navigationUrl =
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` +
        `${originQuery}&travelmode=driving`;
      const openedWindow = window.open(navigationUrl, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        setInfoMessage("Navigation popup was blocked by the browser.");
        return false;
      }
      return true;
    },
    []
  );

  const handleSendToVehicle = useCallback(() => {
    if (!telemetryVehicle) {
      setInfoMessage("Select a vehicle first, then use navigate.");
      return;
    }

    const navigateWithOrigin = (origin) => {
      const didOpen = openVehicleNavigation(telemetryVehicle, origin);
      if (didOpen) {
        setInfoMessage(`Opening navigation for ${telemetryVehicle.vehicle_no || telemetryVehicle.obj_name || "selected vehicle"}.`);
      }
    };

    if (userLocation) {
      navigateWithOrigin(userLocation);
      return;
    }

    if (!navigator.geolocation) {
      navigateWithOrigin(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextOrigin = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          updatedAt: Date.now(),
        };
        setUserLocation(nextOrigin);
        navigateWithOrigin(nextOrigin);
      },
      () => navigateWithOrigin(null),
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      }
    );
  }, [openVehicleNavigation, telemetryVehicle, userLocation]);

  const handleMeasureApply = useCallback(({ mode, distanceUnit, areaUnit }) => {
    setMeasurementTool({
      enabled: true,
      mode,
      distanceUnit,
      areaUnit,
    });
    setIsMeasurePopupOpen(false);
    setInfoMessage(
      mode === "area"
        ? "Area measure active. Click to add points, right click to undo, double click to finish."
        : "Distance measure active. Click to add points, right click to undo, double click to finish."
    );
  }, []);

  const handleMeasureClear = useCallback(() => {
    setMeasurementTool((current) => ({
      ...current,
      enabled: false,
    }));
    setMeasurementSummary(null);
    setMeasurementClearToken((current) => current + 1);
    setInfoMessage("Map measurement cleared.");
  }, []);

  const statusSummary = React.useMemo(() => {
    return getVehicleStatusSummary(allVehicles);
  }, [allVehicles]);

  const applyMobileStatusFilter = useCallback((event, nextFilter) => {
    if (event) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (typeof event.stopPropagation === "function") event.stopPropagation();
    }
    setMobileStatusFilter(nextFilter);
  }, []);

  const loadingMessage =
    !authChecked
      ? "Checking authentication..."
      : !isAuthenticated
      ? "Redirecting to login..."
      : authChecked && isAuthenticated && !accessReady
      ? "Checking tracking access..."
      : authChecked &&
        isAuthenticated &&
        accessReady &&
        canViewTracking &&
        isLoading &&
        allVehicles.length === 0
      ? "Loading live vehicles..."
      : null;
  const showTrackingShell = authChecked && isAuthenticated && accessReady && canViewTracking;
  const showAccessDeniedState = authChecked && isAuthenticated && accessReady && !canViewTracking;

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
      {!shellActive && !isMobileView && !isAdminEmbeddedView ? (
        <Header
          onSearch={handleSearch}
          onSearchSuggest={handleSearchSuggest}
          onSearchPick={handleSearchPick}
          isSearching={isSearching}
          hideAuthActions={!authChecked || !isAuthenticated}
          deferAuthDataLoad={!isTrackingBootReady}
        />
      ) : null}
      <div
        className={styles.contentArea}
        style={{ width: "100%" }}
      >
        {!isMapOnlyEmbeddedView && geofenceError && (
          <div className={styles.errorBanner}>
            Geofence Error: {geofenceError}{" "}
            <button onClick={() => setGeofenceError(null)} className={styles.dismissErrorButton}>
              Dismiss
            </button>
          </div>
        )}
        {!isMapOnlyEmbeddedView && searchError && (
          <div className={styles.searchErrorBanner}>
            {searchError}{" "}
            <button onClick={() => setSearchError(null)} className={styles.dismissErrorButton}>
              &times;
            </button>
          </div>
        )}
        {!isMapOnlyEmbeddedView && error && (
          <div className={styles.errorBanner}>
            {error}{" "}
            <button onClick={fetchCompanyMapData} className={styles.dismissErrorButton}>
              Retry
            </button>
          </div>
        )}
        {!isMapOnlyEmbeddedView && infoMessage && (
          <div className={styles.loadingBanner}>
            {infoMessage}
            <button onClick={() => setInfoMessage(null)} className={styles.dismissErrorButton}>
              Dismiss
            </button>
          </div>
        )}
        <div className={styles.mapContainer}>
          {!isMapOnlyEmbeddedView && showTrackingShell ? (
            <button
              type="button"
              className={`${styles.geofenceToolbarToggle} ${
                isGeofenceToolbarCollapsed
                  ? styles.geofenceToolbarToggleCollapsed
                  : styles.geofenceToolbarToggleExpanded
              }`}
              onClick={() => setIsGeofenceToolbarCollapsed((prev) => !prev)}
              aria-label={
                isGeofenceToolbarCollapsed ? "Open geofence tools" : "Collapse geofence tools"
              }
              title={isGeofenceToolbarCollapsed ? "Open geofence tools" : "Collapse geofence tools"}
            >
              <span aria-hidden="true">
                {isGeofenceToolbarCollapsed ? "›" : "‹"}
              </span>
            </button>
          ) : null}
          {showTrackingShell ? (
            <Tracking
              whenReady={(map) => {
                mapRef.current = map;
                setIsMapReady(true);
              }}
              mapType={mapType}
              showVehiclesLayer={showVehicles}
              showTrafficLayer={showTrafficLayer}
              showLabelsLayer={true}
              showVehicleLabels={showVehicleLabels}
              vehicleData={groupedVehicles}
              activeGroups={activeGroups}
              panelFocusRequest={panelFocusRequest}
              onVehicleClick={handleVehicleSurfaceSelect}
              onTelemetryOpen={handleTelemetryOpen}
              onPlaybackStateChange={(isActive, vehicle) => {
                if (isActive) {
                  if (!isMobileView) {
                    setIsTelemetryOpen(false);
                  }
                  return;
                }
                if (vehicle) {
                  setTelemetryVehicle(vehicle);
                }
              }}
              geofences={geofences}
              onGeofenceCreated={handleGeofenceCreated}
              geofenceToolbarCollapsed={isGeofenceToolbarCollapsed}
              showBuiltInControls={false}
              userLocation={userLocation}
              forceClusterPreviewKey={clusterPreviewResetKey}
              overviewMinSpanKm={isMapOnlyEmbeddedView ? 700 : 900}
              overviewClusterRadiusKm={400}
              mobilePanelStatusFilter={mobileStatusFilter}
              playbackRequest={mobilePlaybackRequest}
              compareModeEnabled={isCompareMode}
              measurementMode={measurementTool.enabled ? measurementTool.mode : null}
              measurementDistanceUnit={measurementTool.distanceUnit}
              measurementAreaUnit={measurementTool.areaUnit}
              measurementClearToken={measurementClearToken}
              onMeasurementChange={setMeasurementSummary}
            />
          ) : null}
          {loadingMessage ? (
            <CenteredCarLoader scope="page" />
          ) : null}
          {showAccessDeniedState ? (
            <div className={styles.centerLoaderOverlay}>
              <div className={styles.centerLoaderCard} style={{ maxWidth: "560px" }}>
                <AccessGuardState
                  title="Tracking access denied"
                  message="You do not currently have view access for tracking."
                />
              </div>
            </div>
          ) : null}
          {!isMapOnlyEmbeddedView && showTrackingShell ? (
            <>
              <MapControls
                onZoomIn={() => mapRef.current?.zoomIn()}
                onZoomOut={() => mapRef.current?.zoomOut()}
                isMobileView={isMobileView}
                onControlClick={(id) => {
                  if (id === "send") handleSendToVehicle();
                  if (id === "layers") setIsMapTypeOpen((prev) => !prev);
                  if (id === "traffic") setShowTrafficLayer((prev) => !prev);
                  if (id === "labels") setShowVehicleLabels((prev) => !prev);
                  if (id === "swap") {
                    setIsCompareMode((prev) => !prev);
                    setIsMapTypeOpen(false);
                  }
                  if (id === "measure") setIsMeasurePopupOpen(true);
                  if (id === "refresh") {
                    setClusterPreviewResetKey((prev) => prev + 1);
                    fetchCompanyMapData();
                    fetchGeofences();
                  }
                  if (id === "locate") {
                    if (!navigator.geolocation || !mapRef.current) return;
                    navigator.geolocation.getCurrentPosition(
                      ({ coords }) => {
                        setUserLocation({
                          lat: coords.latitude,
                          lng: coords.longitude,
                          accuracy: coords.accuracy,
                          updatedAt: Date.now(),
                        });
                        mapRef.current?.flyTo([coords.latitude, coords.longitude], 16);
                      },
                      () => setInfoMessage("Unable to access your location.")
                    );
                  }
                  if (id === "favorites") {
                    if (!mapRef.current) return;
                    const saved = localStorage.getItem("vtp_map_favorite");
                    if (saved) {
                      try {
                        const fav = JSON.parse(saved);
                        if (Number.isFinite(fav?.lat) && Number.isFinite(fav?.lng) && Number.isFinite(fav?.zoom)) {
                          mapRef.current.flyTo([fav.lat, fav.lng], fav.zoom);
                          return;
                        }
                      } catch {
                        // ignore and overwrite below
                      }
                    }
                    const center = mapRef.current.getCenter?.();
                    const zoom = mapRef.current.getZoom?.();
                    if (!center || !Number.isFinite(zoom)) return;
                    localStorage.setItem(
                      "vtp_map_favorite",
                      JSON.stringify({ lat: center.lat, lng: center.lng, zoom })
                    );
                    setInfoMessage("Current map view saved as favorite.");
                  }
                  if (id === "gps") {
                    const target = telemetryVehicle || getFirstVisibleVehicle();
                    if (
                      target &&
                      Number.isFinite(Number(target.latitude)) &&
                      Number.isFinite(Number(target.longitude))
                    ) {
                      mapRef.current?.flyTo([Number(target.latitude), Number(target.longitude)], 16);
                    } else {
                      setInfoMessage("No valid vehicle GPS data available.");
                    }
                  }
                }}
                isPanelOpen={isTelemetryOpen}
              />
              {!isCompareMode ? (
                <MapTypeSwitcher
                  isOpen={isMapTypeOpen}
                  mapType={mapType}
                  onSelect={(type) => {
                    setMapType(type);
                    setIsMapTypeOpen(false);
                  }}
                />
              ) : null}
              {!isMobileView || !mobilePlaybackRequest ? (
                <TelemetryPanel
                  isOpen={isTelemetryOpen}
                  vehicle={telemetryVehicle}
                  onClose={handleTelemetryClose}
                />
              ) : null}
            </>
          ) : null}

          {isMobileView && !isAdminEmbeddedView ? (
            <>
              <div className={styles.mobileZoomDock} aria-label="Map zoom controls">
                <button
                  type="button"
                  className={styles.mobileZoomDockButton}
                  onClick={() => mapRef.current?.zoomIn()}
                  aria-label="Zoom In"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.mobileZoomDockButton}
                  onClick={() => mapRef.current?.zoomOut()}
                  aria-label="Zoom Out"
                  title="Zoom Out"
                >
                  -
                </button>
              </div>

              {!mobilePlaybackRequest ? (
              <section className={styles.mobileStatusStrip} aria-label="Vehicle Status Summary">
                <button
                  type="button"
                  className={`${styles.mobileStatusCard} ${styles.mobileStatusAll} ${
                    mobileStatusFilter === "total" ? styles.mobileStatusCardActive : ""
                  }`}
                  onClick={(event) => applyMobileStatusFilter(event, "total")}
                >
                  <span>All</span>
                  <strong>{statusSummary.all}</strong>
                  <small>{statusSummary.nodata} no data</small>
                </button>
                <button
                  type="button"
                  className={`${styles.mobileStatusCard} ${styles.mobileStatusActive} ${
                    mobileStatusFilter === "running" ? styles.mobileStatusCardActive : ""
                  }`}
                  onClick={(event) => applyMobileStatusFilter(event, "running")}
                >
                  <span>Active</span>
                  <strong>{statusSummary.running}</strong>
                  <small>Running</small>
                </button>
                <button
                  type="button"
                  className={`${styles.mobileStatusCard} ${styles.mobileStatusIdle} ${
                    mobileStatusFilter === "idle" ? styles.mobileStatusCardActive : ""
                  }`}
                  onClick={(event) => applyMobileStatusFilter(event, "idle")}
                >
                  <span>Idle</span>
                  <strong>{statusSummary.idle}</strong>
                  <small>Standby</small>
                </button>
                <button
                  type="button"
                  className={`${styles.mobileStatusCard} ${styles.mobileStatusStop} ${
                    mobileStatusFilter === "stopped" ? styles.mobileStatusCardActive : ""
                  }`}
                  onClick={(event) => applyMobileStatusFilter(event, "stopped")}
                >
                  <span>Stop</span>
                  <strong>{statusSummary.stopped}</strong>
                  <small>Stopped</small>
                </button>
                <button
                  type="button"
                  className={`${styles.mobileStatusCard} ${styles.mobileStatusInactive} ${
                    mobileStatusFilter === "inactive" ? styles.mobileStatusCardActive : ""
                  }`}
                  onClick={(event) => applyMobileStatusFilter(event, "inactive")}
                >
                  <span>Inactive</span>
                  <strong>{statusSummary.inactive}</strong>
                  <small>Offline</small>
                </button>
              </section>
              ) : null}

              <div className={styles.mobileSearchDock}>
                <div className={styles.mobileSearchBox}>
                  <input
                    type="search"
                    value={mobileSearchTerm}
                    placeholder="Search location"
                    onChange={(event) => {
                      setMobileSearchTerm(event.target.value);
                      setShowMobileSuggestions(true);
                    }}
                    onFocus={() => setShowMobileSuggestions(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSearch(mobileSearchTerm);
                        setShowMobileSuggestions(false);
                      }
                    }}
                  />
                  {(isSearching || isMobileSuggesting) ? (
                    <span className={styles.mobileSearchLoader} />
                  ) : null}
                </div>

                {showMobileSuggestions && mobileSuggestions.length > 0 ? (
                  <div className={styles.mobileSuggestionsPanel}>
                    {mobileSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={styles.mobileSuggestionItem}
                        onClick={() => {
                          setMobileSearchTerm(item.label || item.display_name || "");
                          handleSearchPick(item);
                          setShowMobileSuggestions(false);
                        }}
                      >
                        <span>{item.label || item.display_name}</span>
                        {item.subLabel ? <small>{item.subLabel}</small> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {isTelemetryOpen && telemetryVehicle ? (
                <button
                  type="button"
                  className={styles.mobilePlaybackFab}
                  data-mobile-playback-fab="true"
                  aria-label="Open playback"
                  title="Open playback"
                  onClick={() => {
                    setMobilePlaybackRequest({
                      requestId: `mobile-playback-${Date.now()}`,
                      vehicle: telemetryVehicle,
                    });
                  }}
                >
                  <FaPlay size={16} />
                </button>
              ) : null}
            </>
          ) : null}
          <div
            className={`${styles.mapBrandWatermark} ${
              isMobileView && !isAdminEmbeddedView ? styles.mapBrandWatermarkMobile : ""
            }`}
          >
            <Image
              src="/Valsgroup.png"
              alt="Valsgroup"
              width={18}
              height={18}
              className={styles.mapBrandWatermarkLogo}
            />
            <span>Powered by Vals Group</span>
          </div>
        </div>
      </div>
      <MeasurePopup
        isOpen={isMeasurePopupOpen}
        onClose={() => setIsMeasurePopupOpen(false)}
        mode={measurementTool.mode}
        distanceUnit={measurementTool.distanceUnit}
        areaUnit={measurementTool.areaUnit}
        isActive={measurementTool.enabled}
        summary={measurementSummary}
        onApply={handleMeasureApply}
        onClear={handleMeasureClear}
      />
      {pendingGeofenceShape ? (
        <div className={styles.geofenceModalOverlay}>
          <div className={styles.geofenceModalCard}>
            <div className={styles.geofenceModalHeader}>
              <div>
                <span className={styles.geofenceModalEyebrow}>Geofence Setup</span>
                <h3>Name Your {pendingGeofenceShape.type}</h3>
              </div>
              <button
                type="button"
                className={styles.geofenceModalClose}
                onClick={closeGeofenceModal}
                disabled={isSavingGeofence}
                aria-label="Close geofence modal"
              >
                ×
              </button>
            </div>
            <p className={styles.geofenceModalText}>
              Save this geofence inside your branded tracking workspace.
            </p>
            <label className={styles.geofenceModalLabel} htmlFor="geofence-name">
              Geofence Name
            </label>
            <input
              id="geofence-name"
              type="text"
              className={styles.geofenceModalInput}
              value={geofenceName}
              onChange={(event) => setGeofenceName(event.target.value)}
              placeholder={`e.g. ${pendingGeofenceShape.type} Zone`}
              autoFocus
            />
            <div className={styles.geofenceModalMeta}>
              <span>Type: {pendingGeofenceShape.type}</span>
              <span>Scope: Your account</span>
            </div>
            <div className={styles.geofenceModalActions}>
              <button
                type="button"
                className={styles.geofenceModalSecondary}
                onClick={closeGeofenceModal}
                disabled={isSavingGeofence}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.geofenceModalPrimary}
                onClick={saveGeofence}
                disabled={isSavingGeofence}
              >
                {isSavingGeofence ? "Saving..." : "Save Geofence"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isMobileView && !isAdminEmbeddedView ? <MobileBottomNav /> : null}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <TrackingPageContent />
    </Suspense>
  );
}
