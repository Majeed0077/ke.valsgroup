"use client";

import React, { useMemo } from "react";
import { Polyline } from "react-leaflet";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";
import { getVehicleIdentity } from "@/components/map/viewportHelpers";

const LiveTrailLayer = React.memo(function LiveTrailLayer({
  showVehiclesLayer,
  shouldHideVehicleVisualLayers,
  selectedVehiclePlaybackActive,
  movingVehiclesToShow,
  previousVehicleStates,
}) {
  const segments = useMemo(() => {
    if (
      !showVehiclesLayer ||
      shouldHideVehicleVisualLayers ||
      selectedVehiclePlaybackActive ||
      !Array.isArray(movingVehiclesToShow) ||
      !(previousVehicleStates instanceof Map)
    ) {
      return [];
    }

    return movingVehiclesToShow
      .map((vehicle) => {
        if (getVehicleStatusKey(vehicle) !== "running") return null;

        const vehicleId = String(getVehicleIdentity(vehicle) || "");
        if (!vehicleId) return null;

        const previousState = previousVehicleStates.get(vehicleId);
        const previousPoint = Array.isArray(previousState?.prevPos) ? previousState.prevPos : null;
        const currentPoint = Array.isArray(previousState?.pos) ? previousState.pos : null;

        if (
          !previousPoint ||
          !currentPoint ||
          previousPoint.length !== 2 ||
          currentPoint.length !== 2
        ) {
          return null;
        }

        const hasMovement =
          Number(previousPoint[0]) !== Number(currentPoint[0]) ||
          Number(previousPoint[1]) !== Number(currentPoint[1]);
        if (!hasMovement) return null;

        return {
          key: vehicleId,
          positions: [previousPoint, currentPoint],
        };
      })
      .filter(Boolean);
  }, [
    movingVehiclesToShow,
    previousVehicleStates,
    selectedVehiclePlaybackActive,
    shouldHideVehicleVisualLayers,
    showVehiclesLayer,
  ]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((segment) => (
        <Polyline
          key={`live-tail-${segment.key}`}
          positions={segment.positions}
          pathOptions={{
            color: "#0f9f45",
            weight: 5,
            opacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
            interactive: false,
          }}
        />
      ))}
    </>
  );
});

export default LiveTrailLayer;
