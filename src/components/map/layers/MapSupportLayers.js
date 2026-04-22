"use client";

import React, { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";

export const GeofenceDrawControl = ({ onGeofenceCreated, collapsed = false }) => {
  const map = useMap();

  useEffect(() => {
    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: { shapeOptions: { color: "#f357a1" } },
        circle: { shapeOptions: { color: "#f357a1" } },
        polyline: false,
        rectangle: { shapeOptions: { color: "#f357a1" } },
        marker: true,
      },
      edit: false,
    });

    map.addControl(drawControl);
    const drawContainer = drawControl.getContainer?.();
    if (drawContainer) {
      drawContainer.classList.add("vtp-geofence-draw");
      drawContainer.classList.toggle("vtp-geofence-draw-collapsed", Boolean(collapsed));
    }

    const handleDrawCreated = (e) => {
      const { layerType, layer } = e;
      if (!onGeofenceCreated) return;

      let geofenceData = { type: "", data: {} };

      if (layerType === "polygon") {
        geofenceData.type = "Polygon";
        const geoJson = layer.toGeoJSON();
        geofenceData.data = { coordinates: geoJson.geometry.coordinates };
      } else if (layerType === "rectangle") {
        geofenceData.type = "Rectangle";
        const bounds = layer.getBounds();
        geofenceData.data = {
          bounds: {
            northEast: bounds.getNorthEast(),
            southWest: bounds.getSouthWest(),
          },
        };
      } else if (layerType === "circle") {
        geofenceData.type = "Circle";
        const center = layer.getLatLng();
        geofenceData.data = {
          center: { lat: center.lat, lng: center.lng },
          radius: layer.getRadius(),
        };
      } else if (layerType === "marker") {
        geofenceData.type = "Marker";
        const markerPoint = layer.getLatLng();
        geofenceData.data = {
          point: { lat: markerPoint.lat, lng: markerPoint.lng },
        };
      }

      onGeofenceCreated(geofenceData);
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    return () => {
      map.removeControl(drawControl);
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
    };
  }, [collapsed, map, onGeofenceCreated]);

  return null;
};

export const GeofenceDisplayLayer = ({ geofences }) => {
  const map = useMap();

  useEffect(() => {
    const geofenceLayerGroup = L.layerGroup();

    if (geofences && geofences.length > 0) {
      geofences.forEach((geofence) => {
        let shape;
        const options = { color: "#ff7800", weight: 3, fillOpacity: 0.15 };

        if (geofence.type === "Polygon" && geofence.polygon?.coordinates) {
          const leafletCoords = geofence.polygon.coordinates[0].map((p) => [p[1], p[0]]);
          shape = L.polygon(leafletCoords, options);
        } else if (geofence.type === "Rectangle" && geofence.rectangle?.bounds) {
          const northEast = geofence.rectangle.bounds.northEast;
          const southWest = geofence.rectangle.bounds.southWest;
          if (northEast && southWest) {
            shape = L.rectangle(
              [
                [southWest.lat, southWest.lng],
                [northEast.lat, northEast.lng],
              ],
              options
            );
          }
        } else if (geofence.type === "Circle" && geofence.circle?.center) {
          shape = L.circle([geofence.circle.center.lat, geofence.circle.center.lng], {
            ...options,
            radius: geofence.circle.radius,
          });
        } else if (geofence.type === "Marker" && geofence.marker?.point) {
          shape = L.marker([geofence.marker.point.lat, geofence.marker.point.lng]);
        }

        if (shape) {
          shape.bindTooltip(geofence.name || "Unnamed Geofence", {
            permanent: true,
            direction: "center",
            className: "geofence-label",
          });
          geofenceLayerGroup.addLayer(shape);
        }
      });
    }

    geofenceLayerGroup.addTo(map);

    return () => {
      map.removeLayer(geofenceLayerGroup);
    };
  }, [map, geofences]);

  return null;
};

export const MapScaleControl = () => {
  const map = useMap();

  useEffect(() => {
    const scaleControl = L.control.scale({
      position: "bottomright",
      metric: true,
      imperial: false,
      maxWidth: 120,
    });
    map.addControl(scaleControl);
    return () => {
      map.removeControl(scaleControl);
    };
  }, [map]);

  return null;
};
