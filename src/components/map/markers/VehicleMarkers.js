"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";

const toLeafletLatLng = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return L.latLng(lat, lng);
};

const getVehicleTimestampMs = (vehicle) => {
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

const buildLatLngKey = (latLng, precision = 6) => {
  if (!latLng) return "";
  return `${Number(latLng.lat).toFixed(precision)}:${Number(latLng.lng).toFixed(precision)}`;
};

const safelySetMarkerLatLng = (marker, nextLatLng) => {
  if (!marker?.setLatLng || !marker?._map) return false;
  try {
    marker.setLatLng(nextLatLng);
    return true;
  } catch {
    return false;
  }
};

const getVehiclePopupStatusMeta = (vehicle) => {
  const statusKey = getVehicleStatusKey(vehicle);

  switch (statusKey) {
    case "running":
      return { className: "is-running", label: "Running" };
    case "idle":
      return { className: "is-idle", label: "Idle" };
    case "inactive":
      return { className: "is-inactive", label: "Inactive" };
    case "stopped":
      return { className: "is-stopped", label: "Stopped" };
    default:
      return { className: "is-nodata", label: "No Data" };
  }
};

const isMeaningfulText = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return !["--", "-", "n/a", "na", "null", "undefined"].includes(text.toLowerCase());
};

const getVehicleDisplayTitle = (vehicle) => {
  const label = vehicle?.vehicle_no || vehicle?.imei_id || vehicle?.obj_reg_no || vehicle?.obj_name || "Vehicle";
  return String(label).trim().toUpperCase();
};

const getVehicleLocationLabel = (vehicle) => {
  const candidates = [
    vehicle?.address,
    vehicle?.location,
    vehicle?.location_name,
    vehicle?.locationName,
    vehicle?.location_label,
    vehicle?.locationLabel,
    vehicle?.place_name,
    vehicle?.placeName,
    vehicle?.place,
    vehicle?.last_location,
    vehicle?.lastLocation,
    vehicle?.current_location,
    vehicle?.currentLocation,
  ];

  for (const candidate of candidates) {
    if (isMeaningfulText(candidate)) return String(candidate).trim();
  }

  const lat = Number(vehicle?.latitude);
  const lng = Number(vehicle?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `Loc at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  return "Location not available";
};

const getVehicleDriverPhone = (vehicle) => {
  const candidates = [
    vehicle?.driver_mobile,
    vehicle?.driverMobile,
    vehicle?.driver_phone,
    vehicle?.driverPhone,
    vehicle?.mobile,
    vehicle?.phone,
    vehicle?.contact_no,
    vehicle?.contactNo,
    vehicle?.contact_number,
    vehicle?.contactNumber,
    vehicle?.driver_contact,
    vehicle?.driverContact,
  ];

  for (const candidate of candidates) {
    if (isMeaningfulText(candidate)) return String(candidate).trim();
  }

  return "Not available";
};

const formatPopupDateTime = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const getVehiclePopupTime = (vehicle, keys) => {
  for (const key of keys) {
    const value = vehicle?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return formatPopupDateTime(value);
    }
  }
  return "N/A";
};

const getVehicleDirectionInfo = (vehicle) => {
  const rawHeading = Number(vehicle?.heading ?? vehicle?.angle_name ?? vehicle?.course ?? vehicle?.direction);
  if (!Number.isFinite(rawHeading)) {
    return { label: "NE", angle: 45 };
  }

  const normalized = ((rawHeading % 360) + 360) % 360;
  const directions = [
    { label: "N", angle: 0 },
    { label: "NE", angle: 45 },
    { label: "E", angle: 90 },
    { label: "SE", angle: 135 },
    { label: "S", angle: 180 },
    { label: "SW", angle: 225 },
    { label: "W", angle: 270 },
    { label: "NW", angle: 315 },
  ];
  return directions[Math.round(normalized / 45) % directions.length];
};

const PopupIcon = ({ children, className = "" }) => (
  <span className={`vtp-vehicle-popup-icon ${className}`.trim()}>{children}</span>
);

const PopupCarIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M5 11h14l-1.3-4.1A2 2 0 0 0 15.8 5H8.2a2 2 0 0 0-1.9 1.9L5 11Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M4.5 11h15a2 2 0 0 1 2 2v2.2a1.8 1.8 0 0 1-1.8 1.8H4.3A1.8 1.8 0 0 1 2.5 15.2V13a2 2 0 0 1 2-2Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M7.2 15.9h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M16.8 15.9h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const PopupPinIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11Z" fill="currentColor" />
    <circle cx="12" cy="10" r="2.6" fill="#f7fbff" />
  </svg>
);

const PopupPhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      d="M7.5 3.5c.7-.6 1.7-.6 2.4 0l1.6 1.6c.7.7.7 1.8 0 2.5l-1.1 1.1c-.3.3-.4.8-.2 1.2.9 1.7 2.3 3.1 4 4 .4.2.9.1 1.2-.2l1.1-1.1c.7-.7 1.8-.7 2.5 0l1.6 1.6c.6.7.6 1.7 0 2.4l-1 1c-.9.9-2.2 1.2-3.4.8-5.2-1.7-9.4-5.9-11.1-11.1-.4-1.2-.1-2.5.8-3.4l1-1Z"
      fill="currentColor"
    />
  </svg>
);

const PopupPlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M8.4 6.9v10.2c0 1 .98 1.63 1.84 1.18l7.52-3.96c.91-.48.91-1.88 0-2.36l-7.52-4.06c-.86-.46-1.84.17-1.84 1.18Z"
      fill="currentColor"
    />
  </svg>
);

const PopupTelemetryIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
    <rect x="4.5" y="12.5" width="3" height="6" rx="1" fill="currentColor" />
    <rect x="10.5" y="9" width="3" height="9.5" rx="1" fill="currentColor" opacity="0.9" />
    <rect x="16.5" y="5.5" width="3" height="13" rx="1" fill="currentColor" opacity="0.78" />
  </svg>
);

const PopupArrowIcon = ({ angle = 45 }) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    aria-hidden="true"
    style={{ transform: `rotate(${angle}deg)` }}
  >
    <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 6h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PopupCloseIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const PopupExpandIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M8 10l4 4 4-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PopupDriverAvatar = () => (
  <div className="vtp-vehicle-popup-driver-avatar-inner">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/Drive-icon.png" alt="" className="vtp-vehicle-popup-driver-avatar-image" />
  </div>
);

export const BaseVehicleMarker = ({
  vehicle,
  position,
  previousPosition = null,
  previousTimestamp = 0,
  rotation,
  baseIcon,
  onVehicleClick,
  onPlaybackMenuClick,
  onTelemetryOpen,
  isMobileViewport = false,
  motionMode = "simple",
  markerRef,
  showLabels,
  showLiveTail = false,
  playbackBadge = null,
  zIndexOffset = 0,
  createRotatedDivIcon,
}) => {
  const map = useMap();
  const iconToUse = baseIcon;
  const markerIcon = createRotatedDivIcon(iconToUse, rotation, vehicle);
  const stableControlledPositionRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const shouldLockMarkerPosition = motionMode === "buffered" || motionMode === "external";
  if (shouldLockMarkerPosition) {
    if (!stableControlledPositionRef.current) {
      stableControlledPositionRef.current =
        motionMode === "buffered" ? previousPosition || position : position;
    }
  } else if (stableControlledPositionRef.current) {
    stableControlledPositionRef.current = null;
  }

  // IMPORTANT: React-Leaflet updates marker lat/lng when `position` prop changes.
  // For buffered/external motion we control movement imperatively (RAF), so keep the prop stable.
  const markerPosition = shouldLockMarkerPosition ? stableControlledPositionRef.current || position : position;
  const vehicleTitle = vehicle.vehicle_no || vehicle.imei_id || "Vehicle";
  const speedValue = Math.max(
    0,
    Number(vehicle?.speed_kmh ?? vehicle?.speed ?? vehicle?.speedKmh ?? 0) || 0
  );
  const driverLabel =
    vehicle?.driver_name || vehicle?.driver || vehicle?.driverName || "Driver not assigned";
  const popupStatus = getVehiclePopupStatusMeta(vehicle);
  const popupTitle = useMemo(() => getVehicleDisplayTitle(vehicle), [vehicle]);
  const popupLocation = useMemo(() => getVehicleLocationLabel(vehicle), [vehicle]);
  const popupDriverPhone = useMemo(() => getVehicleDriverPhone(vehicle), [vehicle]);
  const popupDirection = useMemo(() => getVehicleDirectionInfo(vehicle), [vehicle]);
  const popupDeviceTime = useMemo(
    () => getVehiclePopupTime(vehicle, ["device_datetime", "device_time", "deviceTime", "gps_time", "gpstime"]),
    [vehicle]
  );
  const popupServerTime = useMemo(
    () => getVehiclePopupTime(vehicle, ["server_datetime", "server_time", "serverTime", "servertime", "updated_at", "timestamp"]),
    [vehicle]
  );
  const popupPrimaryTime = popupDeviceTime !== "N/A" ? popupDeviceTime : popupServerTime;
  const popupPrimaryTimeLabel = popupDeviceTime !== "N/A" ? "Date/Time" : "Server Time";
  const [isPopupExpanded, setIsPopupExpanded] = useState(false);
  const [liveTailPositions, setLiveTailPositions] = useState([]);

  useEffect(() => {
    if (motionMode !== "simple") return undefined;
    const marker = markerRef?.current;
    if (!marker?.setLatLng) return undefined;

    const start = toLeafletLatLng(previousPosition);
    const end = toLeafletLatLng(position);
    if (!start || !end) {
      setLiveTailPositions([]);
      return undefined;
    }

    const dist = start.distanceTo(end);
    if (!Number.isFinite(dist) || dist < 3) {
      setLiveTailPositions([]);
      return undefined;
    }

    // Ignore extreme teleports (usually bad GPS or device reset).
    if (dist > 25000) {
      safelySetMarkerLatLng(marker, end);
      return undefined;
    }

    const currentTs = getVehicleTimestampMs(vehicle);
    const previousTs = Number(previousTimestamp || 0);
    const dt = Number.isFinite(currentTs) && Number.isFinite(previousTs) ? currentTs - previousTs : 0;

    // Prefer time-based interpolation (feels continuous between polling packets).
    const durationFromTime =
      Number.isFinite(dt) && dt > 250 && dt < 90000 ? Math.max(300, Math.min(20000, Math.round(dt * 0.92))) : 0;
    const durationFromDistance = Math.round(Math.min(1200, Math.max(420, dist * 1.1)));
    const durationMs = durationFromTime || durationFromDistance;
    const startedAt = performance.now();

    // Force start point so React-Leaflet's immediate update doesn't look like a jump.
    safelySetMarkerLatLng(marker, start);

    let rafId = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const t = Math.min(1, Math.max(0, elapsed / durationMs));
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      const lat = start.lat + (end.lat - start.lat) * eased;
      const lng = start.lng + (end.lng - start.lng) * eased;
      if (showLiveTail) {
        setLiveTailPositions([
          [start.lat, start.lng],
          [lat, lng],
        ]);
      }
      if (!safelySetMarkerLatLng(marker, [lat, lng])) return;
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [markerRef, motionMode, position, previousPosition, previousTimestamp, showLiveTail, vehicle]);

  useEffect(
    () => () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (motionMode !== "buffered") return undefined;
    const marker = markerRef?.current;
    if (!marker?.setLatLng) return undefined;

    const DEFAULT_STEP_MS = 5000; // tracking poll interval is ~5000ms (fallback)
    const MIN_START_BUFFER = 2; // confirmed interpolation: store P1, animate once P2 arrives
    const MAX_QUEUE = 5; // keep a tight real-packet queue to avoid excessive visual lag

    if (!marker.__vtpBufferedMotion) {
      marker.__vtpBufferedMotion = {
        queue: [],
        rafId: 0,
        active: false,
        lastLatLngKey: "",
        lastTs: 0,
        lastInputTs: 0,
        stepMs: DEFAULT_STEP_MS,
        started: false,
        activeTargetKey: "",
      };
    }

    const controller = marker.__vtpBufferedMotion;

    const clampStepMs = (value) => Math.max(2500, Math.min(12000, Math.round(value || DEFAULT_STEP_MS)));

    const buildQueueKey = (item) => {
      const ll = item?.latLng;
      const key = buildLatLngKey(ll);
      const ts = Number(item?.ts || 0);
      return `${key}:${ts || 0}`;
    };

    const trimQueue = () => {
      // Never drop the currently animating target (usually queue[0] while active).
      while (controller.queue.length > MAX_QUEUE) {
        if (controller.active) {
          // Keep queue[0] (current target) and drop the next-oldest entry to prefer freshness.
          if (controller.queue.length > 1) controller.queue.splice(1, 1);
          else break;
          continue;
        }
        controller.queue.shift();
      }
    };

    const ensureRunning = () => {
      if (controller.active) return;
      if (!controller.queue.length) return;

      // Start as soon as we have two confirmed packets: current marker point + next real point.
      if (!controller.started) {
        if (controller.queue.length < MIN_START_BUFFER) return;
        controller.started = true;
      }

      const next = controller.queue[0];
      const to = next?.latLng;
      if (!to) {
        controller.queue.shift();
        ensureRunning();
        return;
      }

      const from = marker.getLatLng?.();
      if (!from) return;

      const dist = from.distanceTo(to);
      if (!Number.isFinite(dist) || dist < 3) {
        controller.lastTs = Number(next?.ts || controller.lastTs || 0);
        controller.queue.shift();
        trimQueue();
        ensureRunning();
        return;
      }

      if (dist > 25000) {
        if (!safelySetMarkerLatLng(marker, to)) return;
        controller.lastTs = Number(next?.ts || controller.lastTs || 0);
        controller.queue.shift();
        trimQueue();
        ensureRunning();
        return;
      }

      // If we don't have a baseline timestamp yet, assume we are one step behind the next point.
      const estimatedStepMs = clampStepMs(controller.stepMs || DEFAULT_STEP_MS);
      const fromTs = Number(controller.lastTs || (Number(next?.ts || 0) - estimatedStepMs) || 0);
      const toTs = Number(next?.ts || 0);
      const dt = toTs > 0 && fromTs > 0 ? toTs - fromTs : 0;
      const durationFromTime =
        Number.isFinite(dt) && dt > 250 && dt < 90000
          ? Math.max(600, Math.min(20000, Math.round(dt)))
          : 0;

      // Confirmed packet-to-packet playback should track real cadence, not invent extra lag.
      const durationMs = Math.max(600, Math.min(20000, Math.round(durationFromTime || estimatedStepMs)));
      const startedAt = performance.now();

      controller.active = true;
      controller.activeTargetKey = buildQueueKey(next);

      const tick = () => {
        const elapsed = performance.now() - startedAt;
        const t = Math.min(1, Math.max(0, elapsed / durationMs));
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        if (showLiveTail) {
          setLiveTailPositions([
            [from.lat, from.lng],
            [lat, lng],
          ]);
        }
        if (!safelySetMarkerLatLng(marker, [lat, lng])) {
          controller.active = false;
          controller.rafId = 0;
          return;
        }

        if (t < 1) {
          controller.rafId = requestAnimationFrame(tick);
          return;
        }

        if (!safelySetMarkerLatLng(marker, to)) {
          controller.active = false;
          controller.rafId = 0;
          return;
        }
        if (showLiveTail) {
          setLiveTailPositions([
            [from.lat, from.lng],
            [to.lat, to.lng],
          ]);
        }
        controller.active = false;
        controller.rafId = 0;
        controller.lastTs = Number(next?.ts || controller.lastTs || 0);
        // Remove the exact target we just animated to, even if the queue was trimmed while active.
        const targetIndex = controller.queue.findIndex((item) => buildQueueKey(item) === controller.activeTargetKey);
        if (targetIndex >= 0) controller.queue.splice(targetIndex, 1);
        else controller.queue.shift();
        controller.activeTargetKey = "";
        trimQueue();
        ensureRunning();
      };

      if (controller.rafId) cancelAnimationFrame(controller.rafId);
      controller.rafId = requestAnimationFrame(tick);
    };

    controller.__ensureRunning = ensureRunning;

    return () => {
      // When the marker unmounts, stop any in-flight animation to avoid leaks.
      if (marker.__vtpBufferedMotion?.rafId) {
        cancelAnimationFrame(marker.__vtpBufferedMotion.rafId);
      }
      marker.__vtpBufferedMotion = null;
    };
  }, [markerRef, motionMode, showLiveTail]);

  useEffect(() => {
    if (motionMode !== "buffered") return undefined;
    const marker = markerRef?.current;
    if (!marker?.setLatLng) return undefined;
    const controller = marker.__vtpBufferedMotion;
    if (!controller) return undefined;

    const latLng = toLeafletLatLng(position);
    if (!latLng) return undefined;

    const latLngKey = buildLatLngKey(latLng);
    if (controller.lastLatLngKey === latLngKey) return undefined;
    controller.lastLatLngKey = latLngKey;

    let ts = getVehicleTimestampMs(vehicle);
    if (!ts) {
      const base = Number(controller.lastInputTs || controller.lastTs || Date.now());
      ts = base + 5000;
    }

    // Guard against out-of-order timestamps causing "backward" playback-like motion.
    // If the feed isn't strictly monotonic, synthesize a monotonic timestamp.
    if (controller.lastInputTs && ts <= controller.lastInputTs) {
      ts = controller.lastInputTs + Math.max(1000, Math.round(controller.stepMs || 5000));
    }

    // Update our observed poll interval estimate (EWMA).
    if (controller.lastInputTs && ts > controller.lastInputTs) {
      const observed = ts - controller.lastInputTs;
      if (Number.isFinite(observed) && observed > 500 && observed < 60000) {
        const prev = Number(controller.stepMs || DEFAULT_STEP_MS);
        controller.stepMs = Math.max(2500, Math.min(12000, Math.round(prev * 0.8 + observed * 0.2)));
      }
    }
    controller.lastInputTs = ts;

    controller.queue.push({ latLng, ts });
    // Keep queue size bounded without dropping the current target while it's animating.
    while (controller.queue.length > 6) {
      if (controller.active) {
        if (controller.queue.length > 1) controller.queue.splice(1, 1);
        else break;
      } else {
        controller.queue.shift();
      }
    }

    if (typeof controller.__ensureRunning === "function") controller.__ensureRunning();
    return undefined;
  }, [markerRef, motionMode, position, vehicle]);

  return (
    <>
      {showLiveTail && liveTailPositions.length >= 2 ? (
        <Polyline
          positions={liveTailPositions}
          pathOptions={{
            color: "#0f9f45",
            weight: 5,
            opacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
            interactive: false,
          }}
        />
      ) : null}
      <Marker
        position={markerPosition}
        icon={markerIcon}
        ref={markerRef}
        zIndexOffset={zIndexOffset}
        title={vehicleTitle}
        alt={vehicleTitle}
        eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
          if (isMobileViewport) {
            setIsPopupExpanded(false);
            onVehicleClick?.(vehicle);
            return;
          }
          clickTimeoutRef.current = setTimeout(() => {
            clickTimeoutRef.current = null;
            setIsPopupExpanded(false);
            onVehicleClick?.(vehicle);
          }, 220);
        },
        dblclick: (e) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.stop(e);
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }

          setIsPopupExpanded(false);
          onVehicleClick?.(vehicle);

          const latLng = markerRef?.current?.getLatLng?.() || toLeafletLatLng(position);
          if (!latLng || !map) return;
          const currentZoom = typeof map.getZoom === "function" ? map.getZoom() : 12;
          const maxZoom = typeof map.getMaxZoom === "function" ? map.getMaxZoom() : 18;
          const targetZoom = Math.min(18, Number.isFinite(maxZoom) ? maxZoom : 18, currentZoom + 2);

          if (typeof map.flyTo === "function") {
            map.flyTo(latLng, targetZoom, { animate: true, duration: 0.35, easeLinearity: 0.25 });
            return;
          }
          if (typeof map.setView === "function") {
            map.setView(latLng, targetZoom, { animate: true });
          }
        },
      }}
      >
      {!isMobileViewport && showLabels ? (
        <Tooltip
          direction="top"
          offset={[0, -14]}
          permanent
          interactive={false}
          className="vtp-vehicle-label-tooltip"
        >
          {vehicle.vehicle_no || vehicle.imei_id}
        </Tooltip>
      ) : null}
      {!isMobileViewport && playbackBadge?.label ? (
        <Tooltip
          direction="right"
          offset={[18, -4]}
          interactive={false}
          opacity={1}
          className="vtp-playback-marker-tooltip"
        >
          <span className="vtp-playback-marker-tooltip-text">{playbackBadge.label}</span>
        </Tooltip>
      ) : null}
      {!isMobileViewport ? (
      <Popup
        className="vtp-vehicle-popup"
        closeButton={false}
        eventHandlers={{
          add: () => setIsPopupExpanded(false),
          remove: () => setIsPopupExpanded(false),
        }}
      >
        <div
          className={`vtp-vehicle-popup-card ${isPopupExpanded ? "is-expanded" : "is-collapsed"}`}
        >
          {!isPopupExpanded ? (
            <div
              className="vtp-vehicle-popup-chip"
              role="button"
              tabIndex={0}
              aria-label={`Open details for ${popupTitle}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsPopupExpanded(true);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                setIsPopupExpanded(true);
              }}
            >
              <div className="vtp-vehicle-popup-chip-main">
                <span className={`vtp-vehicle-popup-dot ${popupStatus.className}`} aria-hidden="true" />
                <strong className="vtp-vehicle-popup-chip-title">{popupTitle}</strong>
              </div>
              <div className="vtp-vehicle-popup-chip-actions">
                <button
                  type="button"
                  className="vtp-vehicle-popup-expand-btn"
                  title="Expand details"
                  aria-label="Expand details"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPopupExpanded(true);
                  }}
                >
                  <PopupExpandIcon />
                </button>
                {typeof onPlaybackMenuClick === "function" ? (
                  <button
                    type="button"
                    className="vtp-vehicle-popup-quick-btn is-playback"
                    title="Playback"
                    aria-label="Playback"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPlaybackMenuClick(vehicle);
                    }}
                  >
                    <PopupPlayIcon />
                  </button>
                ) : null}
                {typeof onTelemetryOpen === "function" ? (
                  <button
                    type="button"
                    className="vtp-vehicle-popup-quick-btn is-telemetry"
                    title="Telemetry"
                    aria-label="Telemetry"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTelemetryOpen(vehicle);
                    }}
                  >
                    <PopupTelemetryIcon />
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="vtp-vehicle-popup-close"
                title="Collapse popup"
                aria-label="Collapse popup"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsPopupExpanded(false);
                }}
              >
                <PopupCloseIcon />
              </button>

              <div className="vtp-vehicle-popup-head">
                <div className="vtp-vehicle-popup-title-wrap">
                  <strong>{popupTitle}</strong>
                </div>
                <div className="vtp-vehicle-popup-status-row">
                  <span className={`vtp-vehicle-popup-status-dot ${popupStatus.className}`} aria-hidden="true" />
                  <span className={`vtp-vehicle-popup-status ${popupStatus.className}`}>
                    {popupStatus.label.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="vtp-vehicle-popup-divider" />

              <div className="vtp-vehicle-popup-section">
                <div className="vtp-vehicle-popup-row vtp-vehicle-popup-row-motion">
                  <PopupIcon className="vtp-vehicle-popup-icon-motion">
                    <PopupCarIcon />
                  </PopupIcon>
                  <div className="vtp-vehicle-popup-motion-copy">
                    <strong>{`${Math.round(speedValue)} km/h`}</strong>
                    <span>{popupDirection.label}</span>
                    <PopupArrowIcon angle={popupDirection.angle} />
                  </div>
                </div>

                <div className="vtp-vehicle-popup-row vtp-vehicle-popup-row-location">
                  <PopupIcon className="vtp-vehicle-popup-icon-location">
                    <PopupPinIcon />
                  </PopupIcon>
                  <strong>{popupLocation}</strong>
                </div>
              </div>

              <div className="vtp-vehicle-popup-divider" />

              <div className="vtp-vehicle-popup-driver">
                <div className="vtp-vehicle-popup-driver-avatar">
                  <PopupDriverAvatar />
                </div>
                <div className="vtp-vehicle-popup-driver-copy">
                  <strong>{driverLabel}</strong>
                  <span>
                    <PopupIcon className="vtp-vehicle-popup-icon-phone">
                      <PopupPhoneIcon />
                    </PopupIcon>
                    {popupDriverPhone}
                  </span>
                </div>
              </div>

              <div className="vtp-vehicle-popup-mobile-times" aria-label="Vehicle timestamp">
                <div className="vtp-vehicle-popup-mobile-time-row">
                  <span className="vtp-vehicle-popup-mobile-time-label">{popupPrimaryTimeLabel}</span>
                  <strong className="vtp-vehicle-popup-mobile-time-value">{popupPrimaryTime}</strong>
                </div>
              </div>

              <div className="vtp-vehicle-popup-actions">
                {typeof onPlaybackMenuClick === "function" ? (
                  <button
                    type="button"
                    className="vtp-vehicle-popup-action-btn"
                    title="Playback"
                    aria-label="Playback"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPlaybackMenuClick(vehicle);
                    }}
                  >
                    <PopupIcon className="vtp-vehicle-popup-action-icon">
                      <PopupPlayIcon />
                    </PopupIcon>
                    <span>Playback</span>
                  </button>
                ) : null}

                {typeof onTelemetryOpen === "function" ? (
                  <button
                    type="button"
                    className="vtp-vehicle-popup-action-btn"
                    title="Telemetry"
                    aria-label="Telemetry"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTelemetryOpen(vehicle);
                    }}
                  >
                    <PopupIcon className="vtp-vehicle-popup-action-icon">
                      <PopupTelemetryIcon />
                    </PopupIcon>
                    <span>Telemetry</span>
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Popup>
      ) : null}
      </Marker>
    </>
  );
};

export const StaticVehicleMarker = ({
  vehicle,
  onVehicleClick,
  onPlaybackMenuClick,
  onTelemetryOpen,
  isMobileViewport = false,
  motionMode = "simple",
  showLabels,
  showLiveTail = false,
  isSelected = false,
  markerRef,
  previousPosition = null,
  previousTimestamp = 0,
  getVehiclePathSamples,
  getIconForVehicle,
  getVehicleHeading,
  createRotatedDivIcon,
}) => {
  const samples = useMemo(() => getVehiclePathSamples(vehicle), [getVehiclePathSamples, vehicle]);
  const position = useMemo(() => {
    const lat = Number(vehicle?.latitude);
    const lng = Number(vehicle?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }
    const latestSample = samples[samples.length - 1];
    return latestSample ? [latestSample.lat, latestSample.lng] : null;
  }, [samples, vehicle?.latitude, vehicle?.longitude]);
  const baseIcon = useMemo(() => getIconForVehicle(vehicle), [getIconForVehicle, vehicle]);
  const heading = useMemo(
    () => getVehicleHeading(vehicle, samples),
    [getVehicleHeading, vehicle, samples]
  );

  if (!position) return null;

  return (
    <BaseVehicleMarker
      vehicle={vehicle}
      position={position}
      previousPosition={previousPosition}
      previousTimestamp={previousTimestamp}
      rotation={heading}
      baseIcon={baseIcon}
      onVehicleClick={onVehicleClick}
      onPlaybackMenuClick={onPlaybackMenuClick}
      onTelemetryOpen={onTelemetryOpen}
      isMobileViewport={isMobileViewport}
      motionMode={motionMode}
      markerRef={markerRef}
      showLabels={showLabels}
      showLiveTail={showLiveTail}
      zIndexOffset={isSelected ? 1000 : 0}
      createRotatedDivIcon={createRotatedDivIcon}
    />
  );
};
