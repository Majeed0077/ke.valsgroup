import React from "react";
import { CircleMarker, Marker, Polyline, Tooltip } from "react-leaflet";
import {
  createPlaybackCustomColorIcon,
  createPlaybackEventIcon,
  getPlaybackEventRenderOptions,
} from "@/components/map/mapHelpers";

const PlaybackMapLayer = React.memo(function PlaybackMapLayer({
  shouldRenderPlaybackMapState,
  playbackSettings,
  playbackRoutePath,
  playbackRouteStyle,
  playbackVisibleDataPoints,
  playbackDataPointRadius,
  playbackVisibleEventDescriptors,
  playbackMarkerPresentation,
  visibleSpanBucket,
}) {
  if (!shouldRenderPlaybackMapState) return null;

  return (
    <>
      {playbackSettings.route && playbackRoutePath.length >= 2 ? (
        <>
          <Polyline
            positions={playbackRoutePath}
            pathOptions={{
              color: "#ffffff",
              weight: playbackRouteStyle.outlineWeight,
              opacity: playbackRouteStyle.outlineOpacity,
              lineCap: "round",
              lineJoin: "round",
              interactive: false,
            }}
          />
          <Polyline
            positions={playbackRoutePath}
            pathOptions={{
              color: "#7ec3ff",
              weight: Math.max(1, playbackRouteStyle.routeWeight + 1.6),
              opacity: 0.42,
              lineCap: "round",
              lineJoin: "round",
              interactive: false,
            }}
          />
          <Polyline
            positions={playbackRoutePath}
            pathOptions={{
              color: "#1786ff",
              weight: playbackRouteStyle.routeWeight,
              opacity: playbackRouteStyle.routeOpacity,
              className: "vtp-ant-route-playback",
              lineCap: "round",
              lineJoin: "round",
              interactive: false,
            }}
          />
        </>
      ) : null}

      {playbackSettings.dataPoints
        ? playbackVisibleDataPoints.map(({ point, index }) => {
            if (!Array.isArray(point) || point.length !== 2) return null;
            const isLastPoint = index === playbackRoutePath.length - 1;
            return (
              <CircleMarker
                key={`playback-point-${index}`}
                center={point}
                radius={isLastPoint ? playbackDataPointRadius + 1 : playbackDataPointRadius}
                pathOptions={{
                  color: isLastPoint ? "#2ca54a" : "#d63a32",
                  fillColor: isLastPoint ? "#79d04f" : "#de4f47",
                  fillOpacity: 0.95,
                  weight: 1,
                }}
              />
            );
          })
        : null}

      {playbackVisibleEventDescriptors.map((event) => (
        <Marker
          key={event.key}
          position={event.position}
          icon={
            (() => {
              const renderOptions = {
                ...getPlaybackEventRenderOptions(event, playbackMarkerPresentation, visibleSpanBucket),
                rotateDegrees: event.shape === "triangle" ? Number(event.markerHeading || 0) : 0,
              };
              return event.tone === "custom"
                ? createPlaybackCustomColorIcon(event.label, event.color, event.shape, renderOptions)
                : createPlaybackEventIcon(event.label, event.tone, event.shape, renderOptions);
            })()
          }
          zIndexOffset={900 - event.priority * 10}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {event.shape === "triangle" && event.movementDirection
              ? `${event.tooltip} | ${event.movementDirection === "backward" ? "Backward" : "Forward"}`
              : event.tooltip}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
});

export default PlaybackMapLayer;
