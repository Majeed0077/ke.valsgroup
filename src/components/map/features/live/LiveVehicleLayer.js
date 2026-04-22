"use client";

import React from "react";
import RealisticVehicleAnimator from "@/components/map/VehicleAnimator";
import { StaticVehicleMarker } from "@/components/map/markers/VehicleMarkers";
import {
  createRotatedDivIcon,
  getVehicleHeading,
  getVehiclePathSamples,
} from "@/components/map/mapHelpers";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";
import { getIconForVehicle } from "@/components/map/vehicleIcons";
import { getVehicleIdentity } from "@/components/map/viewportHelpers";

const LiveVehicleLayer = React.memo(function LiveVehicleLayer({
  showVehiclesLayer,
  shouldHideVehicleVisualLayers,
  movingVehiclesToShow,
  selectedVehicleId,
  bubbleAnimatedVehicleIds,
  showVehicleLabels,
  shouldShowGlobalVehicleLabels,
  selectedVehiclePlaybackActive,
  getVehicleMarkerRef,
  previousVehicleStates,
  playbackScene,
  handleVehicleSelect,
  handlePlaybackMenuFromPopup,
  onTelemetryOpen,
  isMobileViewport,
}) {
  if (!showVehiclesLayer || shouldHideVehicleVisualLayers) return null;

  return (
    <>
      {movingVehiclesToShow.map((vehicle) => {
        const vehicleId = getVehicleIdentity(vehicle);
        const isSelectedVehicle = vehicleId === selectedVehicleId;
        const isBubbleAnimatedVehicle = bubbleAnimatedVehicleIds.has(String(vehicleId));
        const shouldShowVehicleLabel = Boolean(
          (!isMobileViewport && isSelectedVehicle) ||
            (showVehicleLabels &&
              (shouldShowGlobalVehicleLabels ||
                (!isMobileViewport && isSelectedVehicle) ||
                (selectedVehiclePlaybackActive && isSelectedVehicle)))
        );
        const shouldAnimateVehicle = Boolean(isSelectedVehicle || isBubbleAnimatedVehicle);
        const markerRef = getVehicleMarkerRef(vehicleId);
        const previousState = previousVehicleStates.get(String(vehicleId)) || null;
        const previousPosition = previousState?.pos || null;
        const previousTimestamp = Number(previousState?.ts || 0);

        return shouldAnimateVehicle ? (
          <RealisticVehicleAnimator
            key={`${vehicleId}-animated`}
            vehicle={vehicle}
            onVehicleClick={handleVehicleSelect}
            onPlaybackMenuClick={handlePlaybackMenuFromPopup}
            onTelemetryOpen={onTelemetryOpen}
            isMobileViewport={isMobileViewport}
            showLabels={shouldShowVehicleLabel}
            externalMarkerRef={markerRef}
            onSelectedVehiclePositionChange={
              isSelectedVehicle ? playbackScene.setSelectedVehiclePosition : undefined
            }
            showTrail={true}
            useSnappedRoute={false}
            loopPlayback={false}
            playbackSamplesOverride={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.selectedPlaybackSamples
                : null
            }
            playbackPreset={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.activePlaybackPreset
                : ""
            }
            playbackPaused={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.playbackPaused
                : false
            }
            playbackSpeedMultiplier={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.playbackSpeedMultiplier
                : 1
            }
            playbackRestartToken={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.playbackRestartToken
                : 0
            }
            playbackSeekProgress={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.playbackSeekValue
                : 0
            }
            playbackSeekToken={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.playbackSeekToken
                : 0
            }
            onPlaybackProgressChange={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.setPlaybackProgress
                : undefined
            }
            onPlaybackRouteReady={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.setPlaybackRoutePath
                : undefined
            }
            playbackMarkerInfo={
              isSelectedVehicle && playbackScene.shouldRenderPlaybackMapState
                ? playbackScene.playbackCurrentMarkerInfo
                : null
            }
          />
        ) : (
          <StaticVehicleMarker
            key={`${vehicleId}-static`}
            vehicle={vehicle}
            onVehicleClick={handleVehicleSelect}
            onPlaybackMenuClick={handlePlaybackMenuFromPopup}
            onTelemetryOpen={onTelemetryOpen}
            isMobileViewport={isMobileViewport}
            showLabels={shouldShowVehicleLabel}
            isSelected={isSelectedVehicle}
            markerRef={markerRef}
            previousPosition={previousPosition}
            previousTimestamp={previousTimestamp}
            motionMode="buffered"
            showLiveTail={getVehicleStatusKey(vehicle) === "running"}
            getVehiclePathSamples={getVehiclePathSamples}
            getIconForVehicle={getIconForVehicle}
            getVehicleHeading={getVehicleHeading}
            createRotatedDivIcon={createRotatedDivIcon}
          />
        );
      })}
    </>
  );
});

export default LiveVehicleLayer;
