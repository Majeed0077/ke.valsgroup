import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Polyline } from "react-leaflet";
import { BaseVehicleMarker } from "@/components/map/markers/VehicleMarkers";
import { fetchSnapppedRoute } from "@/utils/osrm";
import { getIconForVehicle } from "@/components/map/vehicleIcons";
import {
  buildCoordinateKey,
  buildVehiclePacketKey,
  createRotatedDivIcon,
  densifyPath,
  getBearing,
  getPlaybackDuration,
  getPlaybackSamplesForPreset,
  getVehicleHeading,
  getVehiclePathSamples,
  getVehicleSourceTimestamp,
  haversineMeters,
  safelySetLeafletMarkerIcon,
  safelySetLeafletMarkerLatLng,
  shortestAngleDelta,
  smoothHeading,
  smoothPathPositions,
  buildLatLngKey,
} from "@/components/map/mapHelpers";

const LIVE_MOTION_STEP_MS = 2500;
const LIVE_MOTION_MIN_STEP_MS = 2200;
const LIVE_MOTION_MAX_STEP_MS = 8000;
const LIVE_MOTION_TARGET_LAG_MS = 700;
const MARKER_ROTATION_REDRAW_THRESHOLD_DEG = 8;
const SNAPPED_ROUTE_CACHE_LIMIT = 40;
const LIVE_SEGMENT_ROUTE_CACHE_LIMIT = 120;

const snappedRouteCache = new Map();
const liveSegmentRouteCache = new Map();
const liveSegmentRouteInflight = new Map();

const setBoundedRouteCacheEntry = (cache, key, value, maxEntries) => {
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

const RealisticVehicleAnimator = ({
  vehicle,
  onVehicleClick,
  onPlaybackMenuClick,
  onTelemetryOpen,
  isMobileViewport = false,
  showLabels,
  onSelectedVehiclePositionChange,
  showTrail = false,
  useSnappedRoute = false,
  loopPlayback = true,
  externalMarkerRef = null,
  playbackSamplesOverride = null,
  playbackPreset = "",
  playbackPaused = false,
  playbackSpeedMultiplier = 1,
  playbackRestartToken = 0,
  playbackSeekProgress = 0,
  playbackSeekToken = 0,
  onPlaybackProgressChange,
  onPlaybackRouteReady,
  playbackMarkerInfo = null,
}) => {
  const samples = useMemo(() => {
    if (Array.isArray(playbackSamplesOverride)) {
      return playbackSamplesOverride;
    }
    return getVehiclePathSamples(vehicle);
  }, [playbackSamplesOverride, vehicle]);
  const playbackSamples = useMemo(
    () => getPlaybackSamplesForPreset(samples, playbackPreset),
    [samples, playbackPreset]
  );
  const rawPath = useMemo(
    () => playbackSamples.map((point) => [point.lat, point.lng]),
    [playbackSamples]
  );
  const baseIcon = useMemo(() => getIconForVehicle(vehicle), [vehicle]);
  const initialHeading = useMemo(() => getVehicleHeading(vehicle, samples), [vehicle, samples]);
  const rawPathKey = useMemo(() => buildCoordinateKey(rawPath), [rawPath]);
  const isLiveMode = !playbackPreset;
  const livePacketKey = useMemo(
    () => buildVehiclePacketKey(vehicle, rawPathKey),
    [vehicle, rawPathKey]
  );

  const [routePath, setRoutePath] = useState(rawPath);
  const [liveTailPositions, setLiveTailPositions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setRoutePath(rawPath);

    if (!useSnappedRoute) {
      return () => {
        cancelled = true;
      };
    }

    if (rawPath.length >= 2 && rawPathKey) {
      const cachedRoute = snappedRouteCache.get(rawPathKey);
      if (cachedRoute) {
        setRoutePath(cachedRoute);
      } else {
        fetchSnapppedRoute(rawPath)
          .then((snapped) => {
            if (!cancelled && Array.isArray(snapped) && snapped.length >= 2) {
              setBoundedRouteCacheEntry(
                snappedRouteCache,
                rawPathKey,
                snapped,
                SNAPPED_ROUTE_CACHE_LIMIT
              );
              setRoutePath(snapped);
            }
          })
          .catch(() => {
            // fall back to raw path silently
          });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [rawPath, rawPathKey, useSnappedRoute]);

  const trackPositions = useMemo(
    () => smoothPathPositions(densifyPath(routePath, 14), 2),
    [routePath]
  );

  const pathKey = useMemo(() => {
    if (!trackPositions.length) return "";
    return buildCoordinateKey(trackPositions);
  }, [trackPositions]);

  const internalMarkerRef = useRef(null);
  const markerRef = externalMarkerRef || internalMarkerRef;
  const rafRef = useRef(null);
  const vehicleRef = useRef(vehicle);
  const rawPathRef = useRef(rawPath);
  const iconVehicleRef = useRef(vehicle);
  const baseIconRef = useRef(baseIcon);
  const lastPathKeyRef = useRef("");
  const lastLivePacketKeyRef = useRef("");
  const lastLivePositionRef = useRef(null);
  const appliedBearingRef = useRef(null);
  const appliedIconUrlRef = useRef(baseIcon?.options?.iconUrl || "");
  const rotationRef = useRef(initialHeading);
  const pausedProgressRef = useRef(0);
  const animationStartRef = useRef(null);
  const liveMotionRef = useRef(null);
  const initialPos = useMemo(() => {
    if (!isLiveMode) {
      if (trackPositions.length >= 2) return trackPositions[0];
      const firstRawPoint = rawPath[0];
      if (firstRawPoint) return firstRawPoint;
    }
    const lat = Number(vehicle?.latitude);
    const lng = Number(vehicle?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    const latest = rawPath[rawPath.length - 1];
    return latest || null;
  }, [isLiveMode, trackPositions, vehicle?.latitude, vehicle?.longitude, rawPath]);

  const resolvePlaybackFrame = useCallback((path, progress) => {
    if (!Array.isArray(path) || path.length === 0) return null;
    if (path.length === 1) {
      return {
        point: path[0],
        bearing: rotationRef.current,
      };
    }

    const boundedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
    const segmentLengths = [];
    const cumulativeDistance = [0];
    let totalDistance = 0;

    for (let index = 0; index < path.length - 1; index += 1) {
      const segmentDistance = haversineMeters(path[index], path[index + 1]);
      segmentLengths.push(segmentDistance);
      totalDistance += segmentDistance;
      cumulativeDistance.push(totalDistance);
    }

    if (totalDistance <= 0) {
      return {
        point: path[0],
        bearing: getBearing(path[0], path[1] || path[0]),
      };
    }

    const traveledDistance = boundedProgress * totalDistance;
    let currentSegment = 0;
    while (
      currentSegment < segmentLengths.length - 1 &&
      traveledDistance > cumulativeDistance[currentSegment + 1]
    ) {
      currentSegment += 1;
    }

    const segmentStart = path[currentSegment];
    const segmentEnd = path[currentSegment + 1] || segmentStart;
    const segmentStartDistance = cumulativeDistance[currentSegment];
    const segmentEndDistance = cumulativeDistance[currentSegment + 1] || segmentStartDistance + 1;
    const segmentProgress = Math.max(
      0,
      Math.min(
        1,
        (traveledDistance - segmentStartDistance) /
          Math.max(1e-6, segmentEndDistance - segmentStartDistance)
      )
    );

    return {
      point: [
        segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentProgress,
        segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentProgress,
      ],
      bearing: getBearing(segmentStart, segmentEnd),
    };
  }, []);

  useEffect(() => {
    vehicleRef.current = vehicle;
    iconVehicleRef.current = vehicle;
  }, [vehicle]);

  useEffect(() => {
    rawPathRef.current = rawPath;
  }, [rawPath]);

  useEffect(() => {
    baseIconRef.current = baseIcon;
  }, [baseIcon]);

  useEffect(() => {
    onPlaybackRouteReady?.(trackPositions);
  }, [trackPositions, onPlaybackRouteReady]);

  useEffect(() => {
    if (isLiveMode) return undefined;
    const controller = liveMotionRef.current;
    if (!controller) return undefined;
    if (controller.rafId) cancelAnimationFrame(controller.rafId);
    controller.active = false;
    controller.rafId = 0;
    controller.queue = [];
    return undefined;
  }, [isLiveMode]);

  useEffect(
    () => () => {
      const controller = liveMotionRef.current;
      if (!controller?.rafId) return;
      cancelAnimationFrame(controller.rafId);
      controller.active = false;
      controller.rafId = 0;
    },
    []
  );

  useEffect(() => {
    if (isLiveMode) return;
    const leafletMarker = markerRef.current;
    if (!leafletMarker?.setLatLng) return;

    const startupFrame = resolvePlaybackFrame(
      trackPositions.length >= 2 ? trackPositions : rawPathRef.current,
      playbackSeekProgress
    );
    if (!startupFrame?.point) return;

    rotationRef.current = smoothHeading(rotationRef.current, startupFrame.bearing, 1);
    if (
      leafletMarker.setIcon &&
      (appliedBearingRef.current == null ||
        Math.abs(shortestAngleDelta(appliedBearingRef.current, rotationRef.current)) >
          MARKER_ROTATION_REDRAW_THRESHOLD_DEG ||
        appliedIconUrlRef.current !== (baseIconRef.current?.options?.iconUrl || ""))
    ) {
      if (
        safelySetLeafletMarkerIcon(
          leafletMarker,
          createRotatedDivIcon(baseIconRef.current, rotationRef.current, iconVehicleRef.current)
        )
      ) {
        appliedBearingRef.current = rotationRef.current;
        appliedIconUrlRef.current = baseIconRef.current?.options?.iconUrl || "";
      }
    }

    if (!safelySetLeafletMarkerLatLng(leafletMarker, startupFrame.point)) return;
    onSelectedVehiclePositionChange?.(startupFrame.point);
  }, [
    isLiveMode,
    markerRef,
    onSelectedVehiclePositionChange,
    playbackRestartToken,
    playbackSeekProgress,
    playbackSeekToken,
    resolvePlaybackFrame,
    trackPositions,
  ]);

  useEffect(() => {
    const animationSignature = `${pathKey}-${playbackPreset}-${playbackRestartToken}-${playbackSeekToken}`;
    if (lastPathKeyRef.current !== animationSignature) {
      lastPathKeyRef.current = animationSignature;
      pausedProgressRef.current = Math.max(0, Math.min(1, Number(playbackSeekProgress) || 0));
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    appliedBearingRef.current = null;
    appliedIconUrlRef.current = baseIconRef.current?.options?.iconUrl || "";
    rotationRef.current = initialHeading;
    animationStartRef.current = null;

    const leafletMarker = markerRef.current;
    const getMarkerLatLngPoint = () => {
      const ll = leafletMarker?.getLatLng?.();
      if (!ll) return null;
      return [Number(ll.lat), Number(ll.lng)];
    };

    if (isLiveMode) {
      if (!leafletMarker?.setLatLng) return undefined;
      setLiveTailPositions([]);

      if (lastLivePacketKeyRef.current === livePacketKey) return undefined;
      lastLivePacketKeyRef.current = livePacketKey;

      const liveVehicle = vehicleRef.current;
      const lat = Number(liveVehicle?.latitude);
      const lng = Number(liveVehicle?.longitude);
      const latestPathPoint =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? [lat, lng]
          : trackPositions[trackPositions.length - 1] ||
            rawPathRef.current[rawPathRef.current.length - 1] ||
            initialPos;

      if (!latestPathPoint) return undefined;

      const latestKey = buildLatLngKey(latestPathPoint);
      const latestTs = getVehicleSourceTimestamp(liveVehicle) || Date.now();

      if (!liveMotionRef.current) {
        const seedPoint = getMarkerLatLngPoint() || latestPathPoint;
        liveMotionRef.current = {
          current: { point: seedPoint, ts: latestTs },
          queue: [],
          active: false,
          rafId: 0,
          lastKey: buildLatLngKey(seedPoint),
          lastInputTs: latestTs,
          stepMs: LIVE_MOTION_STEP_MS,
          started: false,
          primedAt: performance.now(),
        };
      }

      const controller = liveMotionRef.current;

      if (controller.lastKey === latestKey) return undefined;
      controller.lastKey = latestKey;
      lastLivePositionRef.current = latestPathPoint;

      let ts = Number(latestTs || 0);
      if (controller.lastInputTs && ts <= controller.lastInputTs) {
        ts = controller.lastInputTs + Math.max(600, Math.round(controller.stepMs || LIVE_MOTION_STEP_MS));
      }

      if (controller.lastInputTs && ts > controller.lastInputTs) {
        const observed = ts - controller.lastInputTs;
        if (Number.isFinite(observed) && observed > 500 && observed < 60000) {
          controller.stepMs = Math.max(
            LIVE_MOTION_MIN_STEP_MS,
            Math.min(
              LIVE_MOTION_MAX_STEP_MS,
              Math.round(controller.stepMs * 0.85 + observed * 0.15)
            )
          );
        }
      }
      controller.lastInputTs = ts;

      controller.queue.push({ point: latestPathPoint, ts });
      if (controller.queue.length > 6) controller.queue = controller.queue.slice(-6);

      const getSegmentRoute = async (fromPoint, toPoint) => {
        const fromKey = buildLatLngKey(fromPoint);
        const toKey = buildLatLngKey(toPoint);
        const segKey = `${fromKey}|${toKey}`;
        const cached = liveSegmentRouteCache.get(segKey);
        if (cached) return cached;
        if (liveSegmentRouteInflight.has(segKey)) return liveSegmentRouteInflight.get(segKey);
        const promise = fetchSnapppedRoute([fromPoint, toPoint])
          .then((snapped) => {
            if (Array.isArray(snapped) && snapped.length >= 2) {
              setBoundedRouteCacheEntry(
                liveSegmentRouteCache,
                segKey,
                snapped,
                LIVE_SEGMENT_ROUTE_CACHE_LIMIT
              );
              return snapped;
            }
            return null;
          })
          .catch(() => null)
          .finally(() => {
            liveSegmentRouteInflight.delete(segKey);
          });
        liveSegmentRouteInflight.set(segKey, promise);
        return promise;
      };

      const ensureRunning = async () => {
        if (!leafletMarker?.setLatLng) return;
        if (controller.active) return;

        if (!controller.started) {
          if (controller.queue.length < 1) return;
          controller.started = true;
        }

        if (!controller.queue.length) return;

        const next = controller.queue.shift();
        if (!next?.point) return;

        const from = Array.isArray(controller.current?.point) ? controller.current.point : getMarkerLatLngPoint();
        const to = next.point;
        if (!from || !to) return;

        const dist = haversineMeters(from, to);
        if (!Number.isFinite(dist) || dist < 3) {
          controller.current = next;
          ensureRunning();
          return;
        }

        const dt = Number(next.ts || 0) - Number(controller.current?.ts || 0);
        const baseStep = Math.max(
          LIVE_MOTION_MIN_STEP_MS,
          Math.min(LIVE_MOTION_MAX_STEP_MS, Math.round(controller.stepMs || LIVE_MOTION_STEP_MS))
        );
        const durationFromTime =
          Number.isFinite(dt) && dt > 500 && dt < 60000 ? Math.max(baseStep, Math.round(dt * 1.05)) : baseStep;

        const desiredQueue = 3;
        const targetLagMs = LIVE_MOTION_TARGET_LAG_MS;
        const queuePressure = (desiredQueue - controller.queue.length) / desiredQueue;
        const lagAdjust = Math.round(targetLagMs * Math.max(-1, Math.min(1, queuePressure)));

        let durationMs = durationFromTime + lagAdjust;
        if (controller.queue.length === 0) durationMs = Math.max(durationMs, durationFromTime + targetLagMs);

        durationMs = Math.max(1800, Math.min(22000, Math.round(durationMs)));

        controller.active = true;

        const routePoints =
          useSnappedRoute && Array.isArray(from) && Array.isArray(to)
            ? (await getSegmentRoute(from, to)) || [from, to]
            : [from, to];

        const denseRoute = smoothPathPositions(densifyPath(routePoints, 14), 2);
        const path = denseRoute.length >= 2 ? denseRoute : routePoints;

        const cumulativeDistance = [0];
        let totalDistance = 0;
        for (let i = 0; i < path.length - 1; i += 1) {
          const seg = haversineMeters(path[i], path[i + 1]);
          totalDistance += seg;
          cumulativeDistance.push(totalDistance);
        }
        const startedAt = performance.now();

        const applyAt = (t) => {
          const traveled = t * totalDistance;
          let idx = 0;
          while (idx < path.length - 2 && traveled > cumulativeDistance[idx + 1]) idx += 1;
          const a = path[idx];
          const b = path[idx + 1] || a;
          const segStart = cumulativeDistance[idx];
          const segEnd = cumulativeDistance[idx + 1] || segStart + 1;
          const localT = Math.max(0, Math.min(1, (traveled - segStart) / Math.max(1e-6, segEnd - segStart)));
          const latNow = a[0] + (b[0] - a[0]) * localT;
          const lngNow = a[1] + (b[1] - a[1]) * localT;
          if (showTrail) {
            setLiveTailPositions([
              [from[0], from[1]],
              [latNow, lngNow],
            ]);
          }

          const targetBearing = getBearing(a, b);
          rotationRef.current = smoothHeading(rotationRef.current, targetBearing, 0.2);

          if (
            leafletMarker.setIcon &&
            (appliedBearingRef.current == null ||
              Math.abs(shortestAngleDelta(appliedBearingRef.current, rotationRef.current)) >
                MARKER_ROTATION_REDRAW_THRESHOLD_DEG ||
              appliedIconUrlRef.current !== (baseIconRef.current?.options?.iconUrl || ""))
          ) {
            if (
              safelySetLeafletMarkerIcon(
                leafletMarker,
                createRotatedDivIcon(baseIconRef.current, rotationRef.current, iconVehicleRef.current)
              )
            ) {
              appliedBearingRef.current = rotationRef.current;
              appliedIconUrlRef.current = baseIconRef.current?.options?.iconUrl || "";
            }
          }

          if (!safelySetLeafletMarkerLatLng(leafletMarker, [latNow, lngNow])) return;
          onSelectedVehiclePositionChange?.([latNow, lngNow]);
        };

        const tick = () => {
          const elapsed = performance.now() - startedAt;
          const t = Math.min(1, Math.max(0, elapsed / durationMs));
          const eased = 1 - (1 - t) * (1 - t);
          applyAt(eased);

          if (t < 1) {
            controller.rafId = requestAnimationFrame(tick);
            return;
          }

          if (!safelySetLeafletMarkerLatLng(leafletMarker, to)) return;
          if (showTrail) {
            setLiveTailPositions([
              [from[0], from[1]],
              [to[0], to[1]],
            ]);
          }
          onSelectedVehiclePositionChange?.(to);
          controller.active = false;
          controller.rafId = 0;
          controller.current = next;
          ensureRunning();
        };

        if (controller.rafId) cancelAnimationFrame(controller.rafId);
        controller.rafId = requestAnimationFrame(tick);
      };

      ensureRunning();

      return undefined;
    }

    const path = trackPositions;
    const latestPathPoint = path[path.length - 1] || initialPos;

    if (!path || path.length < 2) {
      if (latestPathPoint) {
        onSelectedVehiclePositionChange?.(latestPathPoint);
        onPlaybackProgressChange?.(1);
      }
      return;
    }

    const segmentLengths = [];
    const cumulativeDistance = [0];
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i += 1) {
      const segmentDistance = haversineMeters(path[i], path[i + 1]);
      segmentLengths.push(segmentDistance);
      totalDistance += segmentDistance;
      cumulativeDistance.push(totalDistance);
    }
    if (totalDistance <= 0) return;

    const totalAnimationDuration =
      getPlaybackDuration(playbackSamples, totalDistance, vehicle.speed) /
      Math.max(0.5, Number(playbackSpeedMultiplier) || 1);

    const applyProgress = (progress) => {
      const boundedProgress = Math.max(0, Math.min(1, progress));
      const frame = resolvePlaybackFrame(path, boundedProgress);
      if (!frame?.point) return;
      const [lat, lng] = frame.point;
      const targetBearing = frame.bearing;
      rotationRef.current = smoothHeading(rotationRef.current, targetBearing, 0.2);
      const leafletMarkerLocal = markerRef.current;
      if (leafletMarkerLocal && leafletMarkerLocal.setLatLng) {
        if (
          leafletMarkerLocal.setIcon &&
          (
            appliedBearingRef.current == null ||
            Math.abs(shortestAngleDelta(appliedBearingRef.current, rotationRef.current)) >
              MARKER_ROTATION_REDRAW_THRESHOLD_DEG ||
            appliedIconUrlRef.current !== (baseIconRef.current?.options?.iconUrl || "")
          )
        ) {
          if (
            safelySetLeafletMarkerIcon(
              leafletMarkerLocal,
              createRotatedDivIcon(baseIconRef.current, rotationRef.current, iconVehicleRef.current)
            )
          ) {
            appliedBearingRef.current = rotationRef.current;
            appliedIconUrlRef.current = baseIconRef.current?.options?.iconUrl || "";
          }
        }
        if (!safelySetLeafletMarkerLatLng(leafletMarkerLocal, [lat, lng])) return;
        onSelectedVehiclePositionChange?.([lat, lng]);
      }
      onPlaybackProgressChange?.(boundedProgress);
    };

    const tick = (ts) => {
      if (playbackPaused) {
        rafRef.current = null;
        return;
      }
      if (animationStartRef.current == null) {
        animationStartRef.current = ts - pausedProgressRef.current * totalAnimationDuration;
      }

      const elapsed = ts - animationStartRef.current;
      const loopDuration = Math.max(1, totalAnimationDuration);
      const boundedElapsed = loopPlayback
        ? elapsed % loopDuration
        : Math.min(elapsed, loopDuration);
      const progress = Math.min(1, boundedElapsed / loopDuration);
      pausedProgressRef.current = progress;
      applyProgress(progress);

      if (progress < 1 || loopPlayback) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        if (leafletMarker?.setLatLng && latestPathPoint) {
          safelySetLeafletMarkerLatLng(leafletMarker, latestPathPoint);
          onSelectedVehiclePositionChange?.(latestPathPoint);
        }
        onPlaybackProgressChange?.(1);
        rafRef.current = null;
      }
    };

    applyProgress(pausedProgressRef.current);
    if (!playbackPaused) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    pathKey,
    trackPositions,
    vehicle.speed,
    playbackSamples,
    initialHeading,
    initialPos,
    markerRef,
    onSelectedVehiclePositionChange,
    onPlaybackProgressChange,
    loopPlayback,
    isLiveMode,
    livePacketKey,
    useSnappedRoute,
    playbackPaused,
    playbackPreset,
    playbackRestartToken,
    playbackSeekProgress,
    playbackSeekToken,
    playbackSpeedMultiplier,
    resolvePlaybackFrame,
    showTrail,
  ]);

    if (!initialPos) return null;

  return (
    <>
      {isLiveMode && showTrail && liveTailPositions.length >= 2 ? (
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
      <BaseVehicleMarker
        vehicle={vehicle}
        position={initialPos}
        rotation={rotationRef.current}
        baseIcon={baseIcon}
        onVehicleClick={onVehicleClick}
        onPlaybackMenuClick={onPlaybackMenuClick}
        onTelemetryOpen={onTelemetryOpen}
        isMobileViewport={isMobileViewport}
        markerRef={markerRef}
        showLabels={showLabels}
        playbackBadge={playbackMarkerInfo}
        zIndexOffset={1200}
        motionMode="external"
        createRotatedDivIcon={createRotatedDivIcon}
      />
    </>
  );
};

export default RealisticVehicleAnimator;
