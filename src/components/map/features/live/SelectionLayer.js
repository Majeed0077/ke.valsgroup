"use client";

import React from "react";
import { Circle } from "react-leaflet";

const SelectionLayer = React.memo(function SelectionLayer({
  selectedCenter,
  isSelectedVehicleClustered,
  selectedVehiclePlaybackActive,
}) {
  if (!selectedCenter || isSelectedVehicleClustered || selectedVehiclePlaybackActive) {
    return null;
  }

  return (
    <Circle
      center={selectedCenter}
      radius={16}
      pathOptions={{
        color: "#0b6bd3",
        fillColor: "#0b6bd3",
        fillOpacity: 0.08,
        weight: 2,
        interactive: false,
      }}
    />
  );
});

export default SelectionLayer;
