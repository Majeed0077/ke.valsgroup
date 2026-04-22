import { useEffect, useMemo, useState } from "react";
import {
  buildChartPolyline,
  formatPlaybackBadgeStamp,
  formatPlaybackCoords,
  formatPlaybackDistance,
  formatPlaybackDuration,
  formatPlaybackStamp,
  getBearing,
  getPlaybackDuration,
  getPlaybackEventIndexes,
  getPlaybackProgressTimestamp,
  haversineMeters,
} from "@/components/map/mapHelpers";

const KEYWORD_GROUPS = {
  fuel: ["fuel", "refuel", "drain"],
  seatBelt: [
    "seat belt",
    "seatbelt",
    "emergency lights",
    "air conditioner",
    "center broom",
    "left broom",
    "right broom",
    "rear nozzle",
  ],
  toll: ["toll", "m-tag", "mtag"],
  opal: ["opal"],
};

const normalizePlaybackText = (value) => String(value || "").trim().toLowerCase();

const includesAnyKeyword = (value, keywords = []) => keywords.some((keyword) => value.includes(keyword));

const toPlaybackTitle = (value, fallback = "") => {
  const normalized = normalizePlaybackText(value);
  if (!normalized) return fallback;
  return normalized
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getPlaybackDerivedState = (sample) => {
  const movementStatus = normalizePlaybackText(sample?.movement_status);
  const ignitionStatus = normalizePlaybackText(sample?.ignition_status);
  const gpsFixStatus = normalizePlaybackText(sample?.gps_fix_status);
  const speed = Math.max(0, Number(sample?.derivedSpeed || 0));

  if (movementStatus.includes("inactive") || movementStatus.includes("lost") || movementStatus.includes("no data")) {
    return "inactive";
  }
  if (movementStatus.includes("idle")) return "idle";
  if (movementStatus.includes("stop") || movementStatus.includes("park")) return "stopped";
  if (movementStatus.includes("run") || movementStatus.includes("move")) return "running";

  if (gpsFixStatus && gpsFixStatus !== "fix") return "inactive";
  if (ignitionStatus === "off") return speed > 5 ? "running" : "stopped";
  if (ignitionStatus === "on") return speed <= 2 ? "idle" : "running";
  if (speed <= 2) return "stopped";
  if (speed <= 8) return "idle";
  return "running";
};

const matchesPlaybackAlertFilter = (eventName, filters = []) => {
  const normalized = normalizePlaybackText(eventName);
  if (!normalized) return false;

  const selectedFilters = Array.isArray(filters) && filters.length > 0 ? filters : ["All"];
  if (selectedFilters.includes("All")) return true;

  return selectedFilters.some((filter) => {
    const normalizedFilter = normalizePlaybackText(filter);
    if (!normalizedFilter) return false;
    if (normalizedFilter === "ignition/acc") {
      return normalized.includes("ignition") || normalized.includes("acc");
    }
    if (normalizedFilter === "idle") {
      return normalized.includes("idle");
    }
    if (normalizedFilter === "harsh braking") {
      return normalized.includes("harsh braking") || normalized.includes("brake");
    }
    return normalized.includes(normalizedFilter);
  });
};

const collectPlaybackStateIntervals = (samples, targetState, minDurationMs = 0) => {
  if (!Array.isArray(samples) || samples.length === 0) return [];

  const intervals = [];
  let startIndex = null;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const isMatch = sample?.derivedState === targetState;

    if (isMatch && startIndex === null) {
      startIndex = index;
    }

    const isLastSample = index === samples.length - 1;
    if (startIndex === null || (isMatch && !isLastSample)) continue;

    const endIndex = isMatch && isLastSample ? index : index - 1;
    const startSample = samples[startIndex];
    const endSample = samples[endIndex];
    const durationMs = Math.max(0, Number(endSample?.timestamp || 0) - Number(startSample?.timestamp || 0));

    if (durationMs >= minDurationMs) {
      const markerIndex = startIndex + Math.floor((endIndex - startIndex) / 2);
      const markerSample = samples[markerIndex] || endSample || startSample;
      intervals.push({
        startIndex,
        endIndex,
        markerIndex,
        durationMs,
        startSample,
        endSample,
        markerSample,
      });
    }

    startIndex = null;
  }

  return intervals;
};

const samplePlaybackDescriptors = (descriptors, maxItems = 6) => {
  if (!Array.isArray(descriptors) || descriptors.length <= maxItems) return descriptors || [];
  const step = Math.max(1, Math.ceil(descriptors.length / maxItems));
  return descriptors.filter((_, index) => index % step === 0).slice(0, maxItems);
};

const normalizeHeadingDelta = (from, to) => {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  let delta = ((to - from + 540) % 360) - 180;
  if (delta < -180) delta += 360;
  return delta;
};

const finalizePlaybackDescriptors = (descriptors) => {
  return descriptors
    .slice()
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map((descriptor) => ({ ...descriptor, position: descriptor.basePoint }));
};

export default function usePlaybackMetrics({
  selectedVehicle,
  selectedVehiclePlaybackActive,
  selectedPlaybackSamples,
  playbackRoutePath,
  playbackProgress,
  visibleSpanBucket,
  visibleSpanBucketLimits,
  playbackSettings,
  playbackThresholds,
}) {
  const playbackMarkerPresentation = useMemo(() => {
    if (visibleSpanBucket <= 1 || visibleSpanBucket >= visibleSpanBucketLimits.length) {
      return { scale: 1, showLabel: true, dataPointRadius: 3.6 };
    }
    if (visibleSpanBucket <= 3) return { scale: 0.94, showLabel: true, dataPointRadius: 3.4 };
    if (visibleSpanBucket <= 7) return { scale: 0.82, showLabel: false, dataPointRadius: 3 };
    if (visibleSpanBucket <= 11) return { scale: 0.74, showLabel: false, dataPointRadius: 2.6 };
    if (visibleSpanBucket <= 13) return { scale: 0.68, showLabel: false, dataPointRadius: 2.3 };
    return { scale: 0.64, showLabel: false, dataPointRadius: 2.1 };
  }, [visibleSpanBucket, visibleSpanBucketLimits.length]);

  const playbackRouteStyle = useMemo(() => {
    const routeWeight =
      visibleSpanBucket <= 2 || visibleSpanBucket >= visibleSpanBucketLimits.length
        ? 5.6
        : visibleSpanBucket <= 6
          ? 5
          : visibleSpanBucket <= 12
            ? 4.5
            : 4;
    const outlineWeight = routeWeight + (visibleSpanBucket <= 6 ? 3.2 : 2.8);
    return {
      outlineWeight,
      routeWeight,
      outlineOpacity: 0.98,
      routeOpacity: visibleSpanBucket <= 6 ? 0.98 : 0.95,
    };
  }, [visibleSpanBucket, visibleSpanBucketLimits.length]);

  const playbackDistanceMeters = useMemo(() => {
    if (playbackRoutePath.length < 2) return 0;
    let total = 0;
    for (let index = 0; index < playbackRoutePath.length - 1; index += 1) {
      total += haversineMeters(playbackRoutePath[index], playbackRoutePath[index + 1]);
    }
    return total;
  }, [playbackRoutePath]);

  const playbackDurationMs = useMemo(() => {
    if (selectedVehiclePlaybackActive && selectedPlaybackSamples.length < 2) return 0;
    if (selectedPlaybackSamples.length >= 2) {
      const first = Number(selectedPlaybackSamples[0]?.timestamp || 0);
      const last = Number(selectedPlaybackSamples[selectedPlaybackSamples.length - 1]?.timestamp || 0);
      if (last > first) return last - first;
    }
    return getPlaybackDuration(selectedPlaybackSamples, playbackDistanceMeters, selectedVehicle?.speed);
  }, [playbackDistanceMeters, selectedPlaybackSamples, selectedVehicle?.speed, selectedVehiclePlaybackActive]);

  const playbackCurrentTimeLabel = useMemo(
    () => getPlaybackProgressTimestamp(selectedPlaybackSamples, playbackProgress),
    [playbackProgress, selectedPlaybackSamples]
  );

  const shouldRenderPlaybackDataPoints = Boolean(playbackSettings?.dataPoints);
  const shouldRenderPlaybackEventOverlays = Boolean(
    playbackSettings?.stoppage ||
      playbackSettings?.speeding ||
      playbackSettings?.alerts ||
      playbackSettings?.idle ||
      playbackSettings?.inactive ||
      playbackSettings?.fuel ||
      playbackSettings?.seatBelt ||
      playbackSettings?.tollInformation ||
      playbackSettings?.opalEvent
  );

  const playbackDataPointRadius = playbackMarkerPresentation.dataPointRadius;

  const playbackSampleMetrics = useMemo(() => {
    if (!Array.isArray(selectedPlaybackSamples) || selectedPlaybackSamples.length === 0) return [];
    let cumulativeDistanceMeters = 0;

    return selectedPlaybackSamples.map((sample, index) => {
      const previous = selectedPlaybackSamples[index - 1];
      const next = selectedPlaybackSamples[index + 1];
      const currentPoint = [Number(sample?.lat), Number(sample?.lng)];
      const previousPoint = previous ? [Number(previous?.lat), Number(previous?.lng)] : null;
      const nextPoint = next ? [Number(next?.lat), Number(next?.lng)] : null;
      const segmentDistanceMeters =
        previousPoint && currentPoint.every(Number.isFinite) && previousPoint.every(Number.isFinite)
          ? haversineMeters(previousPoint, currentPoint)
          : 0;
      cumulativeDistanceMeters += segmentDistanceMeters;

      const elapsedMs = previous ? Math.max(0, Number(sample?.timestamp || 0) - Number(previous?.timestamp || 0)) : 0;
      const calculatedSpeed =
        elapsedMs > 0 ? segmentDistanceMeters / 1000 / (elapsedMs / 3600000) : Number(selectedVehicle?.speed || 0);
      const rawSpeed = Number(sample?.speed_kmh ?? sample?.speed);
      const derivedSpeed = Number.isFinite(rawSpeed) && rawSpeed >= 0 ? rawSpeed : calculatedSpeed;
      const movementStatus = String(sample?.movement_status || "").trim();
      const ignitionStatus = String(sample?.ignition_status || "").trim().toUpperCase();
      const gpsFixStatus = String(sample?.gps_fix_status || "").trim().toUpperCase();
      const explicitHeading = Number(sample?.heading);
      const travelBearing =
        previousPoint && nextPoint && previousPoint.every(Number.isFinite) && nextPoint.every(Number.isFinite)
          ? getBearing(previousPoint, nextPoint)
          : currentPoint.every(Number.isFinite) && nextPoint && nextPoint.every(Number.isFinite)
            ? getBearing(currentPoint, nextPoint)
            : previousPoint && previousPoint.every(Number.isFinite) && currentPoint.every(Number.isFinite)
              ? getBearing(previousPoint, currentPoint)
              : null;
      const markerHeading = Number.isFinite(explicitHeading)
        ? explicitHeading
        : Number.isFinite(travelBearing)
          ? travelBearing
          : 0;
      const movementDirection = Number.isFinite(explicitHeading) && Number.isFinite(travelBearing)
        ? Math.abs(normalizeHeadingDelta(travelBearing, explicitHeading)) > 100
          ? "backward"
          : "forward"
        : "forward";
      const fallbackStatusKey = derivedSpeed > 2 ? "Running" : index === 0 || segmentDistanceMeters > 5 ? "Stopped" : "Idle";
      const statusKey =
        movementStatus ||
        (ignitionStatus === "ON" && gpsFixStatus === "FIX"
          ? "Running"
          : ignitionStatus === "OFF"
            ? "Stopped"
            : fallbackStatusKey);

      return {
        ...sample,
        index,
        point: currentPoint.every(Number.isFinite) ? currentPoint : null,
        segmentDistanceMeters,
        cumulativeDistanceMeters,
        derivedSpeed,
        derivedState: getPlaybackDerivedState({
          movement_status: movementStatus,
          ignition_status: ignitionStatus,
          gps_fix_status: gpsFixStatus,
          derivedSpeed,
        }),
        markerHeading,
        movementDirection,
        statusLabel: statusKey,
        addressLabel: sample?.address || formatPlaybackCoords(sample?.lat, sample?.lng),
        batteryVoltage: Number.isFinite(Number(sample?.battery_voltage)) ? Number(sample.battery_voltage).toFixed(1) : "N/A",
        rawEventName: String(sample?.event_name || "").trim(),
      };
    });
  }, [selectedPlaybackSamples, selectedVehicle?.speed]);

  const playbackCurrentMarkerInfo = useMemo(() => {
    if (!playbackSampleMetrics.length) return null;
    const boundedProgress = Math.max(0, Math.min(1, Number(playbackProgress) || 0));
    const currentIndex = Math.max(
      0,
      Math.min(playbackSampleMetrics.length - 1, Math.round(boundedProgress * (playbackSampleMetrics.length - 1)))
    );
    const sample = playbackSampleMetrics[currentIndex];
    if (!sample) return null;

    const currentSpeed = Math.max(0, Number(sample.derivedSpeed || selectedVehicle?.speed || 0));
    return {
      statusKey: sample.derivedState || (currentSpeed <= 2 ? "stopped" : currentSpeed <= 8 ? "idle" : "running"),
      currentSpeed,
      label: `${Math.round(currentSpeed)} km/hr | ${formatPlaybackDistance(sample.cumulativeDistanceMeters)} | ${formatPlaybackBadgeStamp(sample.timestamp)}`,
    };
  }, [playbackProgress, playbackSampleMetrics, selectedVehicle?.speed]);

  const playbackTrips = useMemo(() => {
    if (playbackSampleMetrics.length < 2) return [];
    const segmentCount = Math.min(3, Math.max(1, playbackSampleMetrics.length - 1));
    const chunkSize = Math.max(2, Math.ceil(playbackSampleMetrics.length / segmentCount));

    return Array.from({ length: segmentCount }, (_, tripIndex) => {
      const startIndex = tripIndex * chunkSize;
      const endIndex = Math.min(playbackSampleMetrics.length - 1, startIndex + chunkSize - 1);
      const startSample = playbackSampleMetrics[startIndex];
      const endSample = playbackSampleMetrics[endIndex];
      if (!startSample || !endSample) return null;

      const samples = playbackSampleMetrics.slice(startIndex, endIndex + 1);
      const distanceKm = samples.reduce((total, sample) => total + sample.segmentDistanceMeters, 0) / 1000;
      const durationMs = Math.max(0, Number(endSample.timestamp || 0) - Number(startSample.timestamp || 0));
      const maxSpeed = Math.max(...samples.map((sample) => Number(sample.derivedSpeed || 0)));
      const avgSpeed = samples.length
        ? samples.reduce((total, sample) => total + Number(sample.derivedSpeed || 0), 0) / samples.length
        : 0;

      return {
        id: `trip-${tripIndex + 1}`,
        objName: startSample.obj_name || endSample.obj_name || "",
        objRegNo: startSample.obj_reg_no || endSample.obj_reg_no || "",
        imeiId: startSample.imei_id || endSample.imei_id || "",
        startTime: formatPlaybackStamp(startSample.timestamp),
        startLocation: startSample.addressLabel,
        endTime: formatPlaybackStamp(endSample.timestamp),
        endLocation: endSample.addressLabel,
        running: formatPlaybackDuration(durationMs),
        distance: distanceKm.toFixed(distanceKm >= 10 ? 0 : 2),
        avgSpeed: Math.round(avgSpeed),
        maxSpeed: Math.round(maxSpeed),
        alerts: samples.filter((sample) => sample.rawEventName).length,
        driver:
          endSample.driver_name ||
          startSample.driver_name ||
          selectedVehicle?.driver_name ||
          selectedVehicle?.driver ||
          selectedVehicle?.driverName ||
          "Unassigned",
        movementStatus: endSample.movement_status || startSample.movement_status || "",
        ignitionStatus: endSample.ignition_status || startSample.ignition_status || "",
        gpsFixStatus: endSample.gps_fix_status || startSample.gps_fix_status || "",
        tripStatus: tripIndex === 0 ? "Current" : "Completed",
      };
    }).filter(Boolean);
  }, [playbackSampleMetrics, selectedVehicle]);

  const playbackSpeedSeries = useMemo(
    () => playbackSampleMetrics.map((sample) => Math.max(0, Number(sample.derivedSpeed || 0))),
    [playbackSampleMetrics]
  );
  const playbackFuelSeries = useMemo(
    () => playbackSampleMetrics.map((sample) => Number(sample?.fuel_level)).filter((value) => Number.isFinite(value)),
    [playbackSampleMetrics]
  );
  const playbackTemperatureSeries = useMemo(() => {
    const values = playbackSampleMetrics.map((sample) => Number(sample?.temperature)).filter((value) => Number.isFinite(value));
    return values.length > 0 ? { Temperature: values } : {};
  }, [playbackSampleMetrics]);

  const [activeTemperatureSensor, setActiveTemperatureSensor] = useState("Dallas Temperature 1");
  const activeTemperatureSeries = playbackTemperatureSeries[activeTemperatureSensor] || [];

  useEffect(() => {
    if (playbackTemperatureSeries[activeTemperatureSensor]) return;
    setActiveTemperatureSensor(Object.keys(playbackTemperatureSeries)[0] || "Dallas Temperature 1");
  }, [activeTemperatureSensor, playbackTemperatureSeries]);

  const playbackStoppageIntervals = useMemo(
    () =>
      collectPlaybackStateIntervals(
        playbackSampleMetrics,
        "stopped",
        Math.max(0, Number(playbackThresholds.stoppageMinutes) || 0) * 60 * 1000
      ),
    [playbackSampleMetrics, playbackThresholds.stoppageMinutes]
  );
  const playbackIdleIntervals = useMemo(
    () =>
      collectPlaybackStateIntervals(
        playbackSampleMetrics,
        "idle",
        Math.max(0, Number(playbackThresholds.idleMinutes) || 0) * 60 * 1000
      ),
    [playbackSampleMetrics, playbackThresholds.idleMinutes]
  );
  const playbackInactiveIntervals = useMemo(
    () => collectPlaybackStateIntervals(playbackSampleMetrics, "inactive", 0),
    [playbackSampleMetrics]
  );

  const playbackPointIndexes = useMemo(
    () => playbackStoppageIntervals.map((interval) => interval.markerSample?.index).filter(Number.isFinite),
    [playbackStoppageIntervals]
  );
  const playbackAlertIndexes = useMemo(
    () =>
      playbackRoutePath.length < 4
        ? []
        : [Math.max(1, Math.floor((playbackRoutePath.length - 1) * 0.18)), Math.max(2, Math.floor((playbackRoutePath.length - 1) * 0.54))],
    [playbackRoutePath]
  );
  const playbackSpeedIndexes = useMemo(() => {
    const normalizedLimit = Math.max(0, Number(playbackThresholds.speedLimit) || 0);
    const comparisonMode = playbackThresholds.speedComparison === "lessThan" ? "lessThan" : "moreThan";
    const matchedIndexes = playbackSampleMetrics
      .filter((sample) => {
        if (!sample || sample.index <= 0) return false;
        const speedValue = Math.max(0, Number(sample.derivedSpeed || 0));
        return comparisonMode === "lessThan" ? speedValue > 0 && speedValue <= normalizedLimit : speedValue >= normalizedLimit;
      })
      .map((sample) => sample.index);
    const samplingStep = Math.max(1, Math.ceil(matchedIndexes.length / 6));
    return matchedIndexes.filter((_, index) => index % samplingStep === 0).slice(0, 6);
  }, [playbackSampleMetrics, playbackThresholds.speedComparison, playbackThresholds.speedLimit]);
  const playbackIdleIndexes = useMemo(
    () => playbackIdleIntervals.map((interval) => interval.markerSample?.index).filter(Number.isFinite),
    [playbackIdleIntervals]
  );
  const playbackInactiveIndexes = useMemo(
    () => playbackInactiveIntervals.map((interval) => interval.markerSample?.index).filter(Number.isFinite),
    [playbackInactiveIntervals]
  );
  const playbackFuelIndexes = useMemo(() => getPlaybackEventIndexes(playbackRoutePath.length, [0.58]), [playbackRoutePath.length]);
  const playbackSeatBeltIndexes = useMemo(() => getPlaybackEventIndexes(playbackRoutePath.length, [0.4]), [playbackRoutePath.length]);
  const playbackTollIndexes = useMemo(() => getPlaybackEventIndexes(playbackRoutePath.length, [0.88]), [playbackRoutePath.length]);
  const playbackOpalIndexes = useMemo(() => getPlaybackEventIndexes(playbackRoutePath.length, [0.65]), [playbackRoutePath.length]);

  const playbackApiEventSamples = useMemo(
    () => playbackSampleMetrics.filter((sample) => sample.rawEventName),
    [playbackSampleMetrics]
  );

  const playbackFuelEventDescriptors = useMemo(
    () =>
      playbackApiEventSamples
        .filter((sample) => includesAnyKeyword(normalizePlaybackText(sample.rawEventName), KEYWORD_GROUPS.fuel))
        .map((sample, index) => ({
          key: `playback-fuel-api-${sample.index}-${index}`,
          index: sample.index,
          sampleIndex: sample.index,
          basePoint: sample.point,
          markerHeading: sample.markerHeading,
          movementDirection: sample.movementDirection,
          label: "F",
          tone: "fuel",
          shape: "square",
          priority: 6,
          showMapLabel: true,
          tooltip: sample.rawEventName || "Fuel event",
          rowLabel: sample.rawEventName || "Fuel event",
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackApiEventSamples]
  );

  const playbackSeatBeltEventDescriptors = useMemo(() => {
    const normalizedMode = normalizePlaybackText(playbackThresholds.seatBeltMode);
    const modeKeywords = KEYWORD_GROUPS.seatBelt.filter(
      (keyword) => normalizedMode.includes(keyword) || keyword.includes(normalizedMode)
    );

    return playbackApiEventSamples
      .filter((sample) => {
        const normalizedName = normalizePlaybackText(sample.rawEventName);
        if (!normalizedName) return false;
        if (modeKeywords.length > 0) return includesAnyKeyword(normalizedName, modeKeywords);
        return includesAnyKeyword(normalizedName, KEYWORD_GROUPS.seatBelt);
      })
      .map((sample, index) => ({
        key: `playback-seatbelt-api-${sample.index}-${index}`,
        index: sample.index,
        sampleIndex: sample.index,
        basePoint: sample.point,
        markerHeading: sample.markerHeading,
        movementDirection: sample.movementDirection,
        label: "SB",
        tone: "seatbelt",
        shape: "pill",
        priority: 7,
        showMapLabel: true,
        tooltip: sample.rawEventName || playbackThresholds.seatBeltMode || "Seat belt event",
        rowLabel: sample.rawEventName || playbackThresholds.seatBeltMode || "Seat belt event",
      }))
      .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2);
  }, [playbackApiEventSamples, playbackThresholds.seatBeltMode]);

  const playbackTollEventDescriptors = useMemo(
    () =>
      playbackApiEventSamples
        .filter((sample) => includesAnyKeyword(normalizePlaybackText(sample.rawEventName), KEYWORD_GROUPS.toll))
        .map((sample, index) => ({
          key: `playback-toll-api-${sample.index}-${index}`,
          index: sample.index,
          sampleIndex: sample.index,
          basePoint: sample.point,
          markerHeading: sample.markerHeading,
          movementDirection: sample.movementDirection,
          label: "T",
          tone: "custom",
          shape: "square",
          priority: 8,
          showMapLabel: true,
          color: playbackThresholds.tollColor,
          tooltip: sample.rawEventName || "Toll information",
          rowLabel: sample.rawEventName || "Toll information",
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackApiEventSamples, playbackThresholds.tollColor]
  );

  const playbackOpalEventDescriptors = useMemo(
    () =>
      playbackApiEventSamples
        .filter((sample) => includesAnyKeyword(normalizePlaybackText(sample.rawEventName), KEYWORD_GROUPS.opal))
        .map((sample, index) => ({
          key: `playback-opal-api-${sample.index}-${index}`,
          index: sample.index,
          sampleIndex: sample.index,
          basePoint: sample.point,
          markerHeading: sample.markerHeading,
          movementDirection: sample.movementDirection,
          label: "",
          tone: "opal",
          shape: "circle",
          priority: 9,
          showMapLabel: false,
          tooltip: sample.rawEventName || "Opal event",
          rowLabel: sample.rawEventName || "Opal event",
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackApiEventSamples]
  );

  const playbackAlertEventDescriptors = useMemo(
    () =>
      playbackApiEventSamples
        .filter((sample) => {
          const normalizedName = normalizePlaybackText(sample.rawEventName);
          if (!normalizedName) return false;
          if (
            includesAnyKeyword(normalizedName, KEYWORD_GROUPS.fuel) ||
            includesAnyKeyword(normalizedName, KEYWORD_GROUPS.seatBelt) ||
            includesAnyKeyword(normalizedName, KEYWORD_GROUPS.toll) ||
            includesAnyKeyword(normalizedName, KEYWORD_GROUPS.opal)
          ) {
            return false;
          }
          return matchesPlaybackAlertFilter(sample.rawEventName, playbackThresholds.alertFilters);
        })
        .map((sample, index) => ({
          key: `playback-alert-api-${sample.index}-${index}`,
          index: sample.index,
          sampleIndex: sample.index,
          basePoint: sample.point,
          markerHeading: sample.markerHeading,
          movementDirection: sample.movementDirection,
          label: "",
          tone: "alert",
          shape: "triangle",
          priority: 3,
          showMapLabel: false,
          tooltip: sample.rawEventName || `Alert ${index + 1}`,
          rowLabel: sample.rawEventName || `Alert ${index + 1}`,
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackApiEventSamples, playbackThresholds.alertFilters]
  );

  const playbackStoppageEventDescriptors = useMemo(
    () =>
      playbackStoppageIntervals
        .map((interval, index) => ({
          key: `playback-stop-${interval.markerSample?.index ?? index}`,
          index: interval.markerSample?.index ?? 0,
          sampleIndex: interval.markerSample?.index ?? 0,
          basePoint: interval.markerSample?.point,
          markerHeading: interval.markerSample?.markerHeading,
          movementDirection: interval.markerSample?.movementDirection,
          label: "",
          tone: "stoppage",
          shape: "circle",
          priority: 1,
          showMapLabel: false,
          tooltip: `Stoppage ${index + 1}`,
          rowLabel: `Stoppage ${index + 1} (${formatPlaybackDuration(interval.durationMs)})`,
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackStoppageIntervals]
  );

  const playbackSpeedEventDescriptors = useMemo(() => {
    const normalizedLimit = Math.max(0, Number(playbackThresholds.speedLimit) || 0);
    const comparisonMode = playbackThresholds.speedComparison === "lessThan" ? "lessThan" : "moreThan";
    const label =
      comparisonMode === "lessThan"
        ? `Speed less than ${normalizedLimit} km/hr`
        : `Speed more than ${normalizedLimit} km/hr`;

    return samplePlaybackDescriptors(
      playbackSampleMetrics
        .filter((sample) => playbackSpeedIndexes.includes(sample.index))
        .map((sample, index) => ({
          key: `playback-speed-${sample.index}-${index}`,
          index: sample.index,
          sampleIndex: sample.index,
          basePoint: sample.point,
          markerHeading: sample.markerHeading,
          movementDirection: sample.movementDirection,
          label: "S",
          tone: "speed",
          shape: "square",
          priority: 2,
          showMapLabel: true,
          tooltip: label,
          rowLabel: label,
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
      6
    );
  }, [playbackSampleMetrics, playbackSpeedIndexes, playbackThresholds.speedComparison, playbackThresholds.speedLimit]);

  const playbackIdleEventDescriptors = useMemo(
    () =>
      playbackIdleIntervals
        .map((interval, index) => ({
          key: `playback-idle-${interval.markerSample?.index ?? index}`,
          index: interval.markerSample?.index ?? 0,
          sampleIndex: interval.markerSample?.index ?? 0,
          basePoint: interval.markerSample?.point,
          markerHeading: interval.markerSample?.markerHeading,
          movementDirection: interval.markerSample?.movementDirection,
          label: "",
          tone: "idle",
          shape: "circle",
          priority: 4,
          showMapLabel: false,
          tooltip: `Idle ${index + 1}`,
          rowLabel: `Idle ${index + 1} (${formatPlaybackDuration(interval.durationMs)})`,
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackIdleIntervals]
  );

  const playbackInactiveEventDescriptors = useMemo(
    () =>
      playbackInactiveIntervals
        .map((interval, index) => ({
          key: `playback-inactive-${interval.markerSample?.index ?? index}`,
          index: interval.markerSample?.index ?? 0,
          sampleIndex: interval.markerSample?.index ?? 0,
          basePoint: interval.markerSample?.point,
          markerHeading: interval.markerSample?.markerHeading,
          movementDirection: interval.markerSample?.movementDirection,
          label: "",
          tone: "inactive",
          shape: "circle",
          priority: 5,
          showMapLabel: false,
          tooltip: `Inactive ${index + 1}`,
          rowLabel: `Inactive ${index + 1}`,
        }))
        .filter((descriptor) => Array.isArray(descriptor.basePoint) && descriptor.basePoint.length === 2),
    [playbackInactiveIntervals]
  );

  const playbackDataPoints = useMemo(() => {
    if (!shouldRenderPlaybackDataPoints || playbackRoutePath.length === 0) return [];
    const lastIndex = playbackRoutePath.length - 1;
    const step = Math.max(1, Math.ceil(playbackRoutePath.length / 36));
    return playbackRoutePath.map((point, index) => ({ point, index })).filter(({ index }) => index === 0 || index === lastIndex || index % step === 0);
  }, [playbackRoutePath, shouldRenderPlaybackDataPoints]);

  const playbackVisibleDataPoints = useMemo(() => {
    if (!shouldRenderPlaybackDataPoints || playbackDataPoints.length === 0) return [];
    if (visibleSpanBucket >= visibleSpanBucketLimits.length) return playbackDataPoints.slice(0, 8);
    if (visibleSpanBucket > 2) return [];
    const maxPoints = visibleSpanBucket <= 0 ? 8 : 5;
    const step = Math.max(1, Math.ceil(playbackDataPoints.length / maxPoints));
    return playbackDataPoints.filter((_, index) => index % step === 0).slice(0, maxPoints);
  }, [playbackDataPoints, shouldRenderPlaybackDataPoints, visibleSpanBucket, visibleSpanBucketLimits.length]);

  const playbackEventDescriptors = useMemo(() => {
    if (!selectedVehiclePlaybackActive || !shouldRenderPlaybackEventOverlays) return [];

    const descriptors = [];
    const pushFallbackMarkers = (enabled, indexes, configFactory) => {
      if (!enabled) return;
      indexes.forEach((index, markerIndex) => {
        const point = playbackRoutePath[index];
        const sample = playbackSampleMetrics[index] || null;
        if (!Array.isArray(point) || point.length !== 2) return;
        descriptors.push({
          index,
          sampleIndex: sample?.index ?? index,
          basePoint: point,
          markerHeading: sample?.markerHeading ?? 0,
          movementDirection: sample?.movementDirection || "forward",
          ...configFactory(index, markerIndex),
        });
      });
    };
    const pushDescriptorSet = (enabled, dynamicDescriptors, fallbackIndexes, configFactory) => {
      if (!enabled) return;
      if (Array.isArray(dynamicDescriptors) && dynamicDescriptors.length > 0) {
        descriptors.push(...dynamicDescriptors);
        return;
      }
      pushFallbackMarkers(enabled, fallbackIndexes, configFactory);
    };

    pushDescriptorSet(playbackSettings.stoppage, playbackStoppageEventDescriptors, playbackPointIndexes, (index, markerIndex) => ({
      key: `playback-stop-fallback-${index}`,
      label: "",
      tone: "stoppage",
      shape: "circle",
      priority: 1,
      showMapLabel: false,
      tooltip: `Stoppage ${markerIndex + 1}`,
      rowLabel: `Stoppage ${markerIndex + 1}`,
    }));
    pushDescriptorSet(playbackSettings.speeding, playbackSpeedEventDescriptors, playbackSpeedIndexes, (index) => ({
      key: `playback-speed-fallback-${index}`,
      label: "S",
      tone: "speed",
      shape: "square",
      priority: 2,
      showMapLabel: true,
      tooltip:
        playbackThresholds.speedComparison === "lessThan"
          ? `Speed less than ${playbackThresholds.speedLimit} km/hr`
          : `Speed more than ${playbackThresholds.speedLimit} km/hr`,
      rowLabel:
        playbackThresholds.speedComparison === "lessThan"
          ? `Speed less than ${playbackThresholds.speedLimit} km/hr`
          : `Speed more than ${playbackThresholds.speedLimit} km/hr`,
    }));
    pushDescriptorSet(playbackSettings.alerts, playbackAlertEventDescriptors, playbackAlertIndexes, (index, markerIndex) => ({
      key: `playback-alert-fallback-${index}`,
      label: "",
      tone: "alert",
      shape: "triangle",
      priority: 3,
      showMapLabel: false,
      tooltip: `Alert ${markerIndex + 1}`,
      rowLabel: `Alert ${markerIndex + 1}`,
    }));
    pushDescriptorSet(playbackSettings.idle, playbackIdleEventDescriptors, playbackIdleIndexes, (index, markerIndex) => ({
      key: `playback-idle-fallback-${index}`,
      label: "",
      tone: "idle",
      shape: "circle",
      priority: 4,
      showMapLabel: false,
      tooltip: `Idle ${markerIndex + 1}`,
      rowLabel: `Idle ${markerIndex + 1}`,
    }));
    pushDescriptorSet(playbackSettings.inactive, playbackInactiveEventDescriptors, playbackInactiveIndexes, (index, markerIndex) => ({
      key: `playback-inactive-fallback-${index}`,
      label: "",
      tone: "inactive",
      shape: "circle",
      priority: 5,
      showMapLabel: false,
      tooltip: `Inactive ${markerIndex + 1}`,
      rowLabel: `Inactive ${markerIndex + 1}`,
    }));
    pushDescriptorSet(playbackSettings.fuel, playbackFuelEventDescriptors, playbackFuelIndexes, (index) => ({
      key: `playback-fuel-fallback-${index}`,
      label: "F",
      tone: "fuel",
      shape: "square",
      priority: 6,
      showMapLabel: true,
      tooltip: "Fuel event",
      rowLabel: "Fuel event",
    }));
    pushDescriptorSet(playbackSettings.seatBelt, playbackSeatBeltEventDescriptors, playbackSeatBeltIndexes, (index) => ({
      key: `playback-seatbelt-fallback-${index}`,
      label: "SB",
      tone: "seatbelt",
      shape: "pill",
      priority: 7,
      showMapLabel: true,
      tooltip: playbackThresholds.seatBeltMode || "Seat belt event",
      rowLabel: playbackThresholds.seatBeltMode || "Seat belt event",
    }));
    pushDescriptorSet(playbackSettings.tollInformation, playbackTollEventDescriptors, playbackTollIndexes, (index) => ({
      key: `playback-toll-fallback-${index}`,
      label: "T",
      tone: "custom",
      shape: "square",
      priority: 8,
      showMapLabel: true,
      color: playbackThresholds.tollColor,
      tooltip: "Toll information",
      rowLabel: "Toll information",
    }));
    pushDescriptorSet(playbackSettings.opalEvent, playbackOpalEventDescriptors, playbackOpalIndexes, (index) => ({
      key: `playback-opal-fallback-${index}`,
      label: "",
      tone: "opal",
      shape: "circle",
      priority: 9,
      showMapLabel: false,
      tooltip: "Opal event",
      rowLabel: "Opal event",
    }));

    return finalizePlaybackDescriptors(descriptors);
  }, [
    playbackAlertEventDescriptors,
    playbackAlertIndexes,
    playbackFuelEventDescriptors,
    playbackFuelIndexes,
    playbackIdleEventDescriptors,
    playbackIdleIndexes,
    playbackInactiveEventDescriptors,
    playbackInactiveIndexes,
    playbackOpalEventDescriptors,
    playbackOpalIndexes,
    playbackPointIndexes,
    playbackSampleMetrics,
    playbackRoutePath,
    playbackSeatBeltEventDescriptors,
    playbackSeatBeltIndexes,
    playbackSettings,
    playbackSpeedEventDescriptors,
    playbackSpeedIndexes,
    playbackStoppageEventDescriptors,
    playbackThresholds.seatBeltMode,
    playbackThresholds.speedComparison,
    playbackThresholds.speedLimit,
    playbackThresholds.tollColor,
    playbackTollEventDescriptors,
    playbackTollIndexes,
    selectedVehiclePlaybackActive,
    shouldRenderPlaybackEventOverlays,
  ]);

  const playbackEventRows = useMemo(() => {
    const metricsByIndex = new Map(playbackSampleMetrics.map((sample) => [sample.index, sample]));

    return playbackEventDescriptors
      .map((event, eventIndex) => {
        const sample =
          metricsByIndex.get(event.sampleIndex ?? event.index) ||
          playbackSampleMetrics[event.index] ||
          playbackSampleMetrics.at(-1);
        return {
          id: event.key,
          objName: sample?.obj_name || "",
          objRegNo: sample?.obj_reg_no || "",
          imeiId: sample?.imei_id || "",
          event: event.rowLabel || event.tooltip || `Event ${eventIndex + 1}`,
          time: formatPlaybackStamp(sample?.timestamp),
          address: sample?.addressLabel || formatPlaybackCoords(event.position?.[0], event.position?.[1]),
          speed: Math.max(0, Number(sample?.derivedSpeed || 0)),
          movementStatus: sample?.movement_status || toPlaybackTitle(sample?.derivedState, ""),
          ignitionStatus: sample?.ignition_status || "",
          gpsFixStatus: sample?.gps_fix_status || "",
          driver: sample?.driver_name || selectedVehicle?.driver_name || selectedVehicle?.driver || selectedVehicle?.driverName || "Unassigned",
          sortTimestamp: Number(sample?.timestamp || 0),
        };
      })
      .sort((left, right) => left.sortTimestamp - right.sortTimestamp)
      .map(({ sortTimestamp, ...row }) => row);
  }, [playbackEventDescriptors, playbackSampleMetrics, selectedVehicle]);

  const playbackVisibleEventDescriptors = useMemo(() => {
    if (!shouldRenderPlaybackEventOverlays || playbackEventDescriptors.length === 0) return [];
    if (visibleSpanBucket >= visibleSpanBucketLimits.length || visibleSpanBucket <= 2) return playbackEventDescriptors;
    if (visibleSpanBucket <= 4) return playbackEventDescriptors;
    if (visibleSpanBucket <= 8) return playbackEventDescriptors.filter((event) => event.priority <= 7);
    return playbackEventDescriptors;
  }, [playbackEventDescriptors, shouldRenderPlaybackEventOverlays, visibleSpanBucket, visibleSpanBucketLimits.length]);

  return {
    playbackMarkerPresentation,
    playbackRouteStyle,
    playbackDistanceMeters,
    playbackDurationMs,
    playbackCurrentTimeLabel,
    playbackDataPointRadius,
    playbackSampleMetrics,
    playbackCurrentMarkerInfo,
    playbackTrips,
    playbackFuelSeries,
    playbackTemperatureSeries,
    activeTemperatureSensor,
    setActiveTemperatureSensor,
    playbackPointIndexes,
    playbackVisibleDataPoints,
    playbackEventRows,
    playbackVisibleEventDescriptors,
    playbackSpeedChart: buildChartPolyline(playbackSpeedSeries, 1040, 188, 18),
    playbackFuelChart: buildChartPolyline(playbackFuelSeries, 1040, 188, 18),
    playbackTemperatureChart: buildChartPolyline(activeTemperatureSeries, 1040, 188, 18),
  };
}
