"use client";

import React from "react";

const ClusterLayer = React.memo(function ClusterLayer({
  showVehiclesLayer,
  shouldHideVehicleVisualLayers,
  shouldClusterVehicles,
  clusteredVehiclesToShow,
  activeClusterFilter = "all",
  handleVehicleSelect,
  handleClusterHover,
  handleClusterLeave,
  disableClusterSpiderfy,
  clusterRadiusPx,
  ClusterRenderer,
}) {
  if (
    !showVehiclesLayer ||
    shouldHideVehicleVisualLayers ||
    !shouldClusterVehicles ||
    clusteredVehiclesToShow.length < 1 ||
    typeof ClusterRenderer !== "function"
  ) {
    return null;
  }

  return (
    <ClusterRenderer
      vehicles={clusteredVehiclesToShow}
      activeStatusFilter={activeClusterFilter}
      onVehicleClick={handleVehicleSelect}
      onClusterHover={handleClusterHover}
      onClusterLeave={handleClusterLeave}
      disableSpiderfy={disableClusterSpiderfy}
      clusterRadiusPx={clusterRadiusPx}
    />
  );
});

export default ClusterLayer;
