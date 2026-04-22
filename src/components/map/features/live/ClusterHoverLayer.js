"use client";

import React from "react";
import { Polygon, Rectangle } from "react-leaflet";

const ClusterHoverLayer = React.memo(function ClusterHoverLayer({ clusterHoverGeometry }) {
  if (
    !clusterHoverGeometry?.bounds &&
    (!Array.isArray(clusterHoverGeometry?.hull) || clusterHoverGeometry.hull.length < 3)
  ) {
    return null;
  }

  return (
    <>
      {clusterHoverGeometry.bounds ? (
        <Rectangle
          bounds={clusterHoverGeometry.bounds}
          pathOptions={{
            color: "#2f6dff",
            weight: 2,
            fillColor: "#3a73ff",
            fillOpacity: 0.12,
            dashArray: "8 6",
            interactive: false,
          }}
        />
      ) : null}

      {clusterHoverGeometry.hull.length >= 3 ? (
        <Polygon
          positions={clusterHoverGeometry.hull}
          pathOptions={{
            color: "#2f6dff",
            weight: 2,
            fillColor: "#3a73ff",
            fillOpacity: 0.12,
            dashArray: "8 6",
            interactive: false,
          }}
        />
      ) : null}
    </>
  );
});

export default ClusterHoverLayer;
