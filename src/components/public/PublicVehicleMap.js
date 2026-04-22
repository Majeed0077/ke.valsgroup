"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import styles from "@/components/public/PublicVehicleMap.module.css";
import { getVehicleImageSrc } from "@/lib/vehicleImage";

const DEFAULT_CENTER = [24.8607, 67.0011];
const DEFAULT_ZOOM = 15;
const PUBLIC_MAP_STATE_KEY = "vtp-public-map-state-v1";

function readParam(params, keys) {
  for (const key of keys) {
    const value = params?.[key];
    if (Array.isArray(value)) {
      const first = String(value[0] || "").trim();
      if (first) return first;
      continue;
    }
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function readCoordinate(params, primaryKeys, queryKeys) {
  const direct = readParam(params, primaryKeys);
  if (direct) {
    const numeric = Number(direct);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const queryValue = readParam(params, queryKeys);
  if (queryValue.includes(",")) {
    const [latValue, lngValue] = queryValue.split(",").map((item) => Number(String(item || "").trim()));
    return Number.isFinite(primaryKeys[0] === "lat" || primaryKeys[0] === "latitude" ? latValue : lngValue)
      ? primaryKeys[0] === "lat" || primaryKeys[0] === "latitude"
        ? latValue
        : lngValue
      : null;
  }

  return null;
}

function buildVehicleIcon(vehicleType) {
  const iconUrl = getVehicleImageSrc(vehicleType || "default");
  const isBike = String(vehicleType || "").toLowerCase().includes("bike");
  const size = isBike ? [36, 36] : [46, 46];
  return L.icon({
    iconUrl,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1] + 8],
  });
}

function buildViewData(params = {}) {
  const vehicleType = readParam(params, ["vehicle_type", "type", "vehicleType"]) || "car";
  const vehicleNumber = readParam(params, [
    "vehicle_no",
    "vehicle_number",
    "vehicleNumber",
    "reg_no",
    "obj_reg_no",
    "number",
  ]);
  const title = readParam(params, ["title", "alert_title", "subject"]) || "Vehicle Location";
  const message = readParam(params, ["message", "alert_message", "text", "description"]);
  const company = readParam(params, ["company", "org", "organization", "client"]);
  const timestamp = readParam(params, ["at", "timestamp", "time", "datetime"]);
  const latitude = readCoordinate(params, ["lat", "latitude"], ["q", "coords", "coordinates"]);
  const longitude = readCoordinate(params, ["lng", "lon", "longitude"], ["q", "coords", "coordinates"]);

  return {
    vehicleType,
    vehicleNumber,
    title,
    message,
    company,
    timestamp,
    latitude,
    longitude,
  };
}

function hasQueryPayload(params = {}) {
  return Object.values(params || {}).some((value) => {
    if (Array.isArray(value)) return value.some((item) => String(item || "").trim());
    return String(value || "").trim();
  });
}

function FitVehicleBounds({ center }) {
  const map = useMap();

  React.useEffect(() => {
    if (!Array.isArray(center) || center.length !== 2) return;
    map.setView(center, DEFAULT_ZOOM, { animate: false });
  }, [center, map]);

  return null;
}

function VehicleMarker({ center, icon, vehicleNumber, vehicleType, latitude, longitude }) {
  const markerRef = useRef(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker?.setIcon) return;
    marker.setIcon(icon);
  }, [icon]);

  return (
    <Marker ref={markerRef} position={center} icon={icon}>
      {vehicleNumber ? (
        <Tooltip
          direction="top"
          offset={[0, -34]}
          permanent
          interactive={false}
          className={styles.vehicleNumberTooltip}
        >
          {vehicleNumber}
        </Tooltip>
      ) : null}
      <Popup>
        <strong>{vehicleNumber || "Vehicle"}</strong>
        <br />
        {vehicleType || "Vehicle"}
        <br />
        {latitude}, {longitude}
      </Popup>
    </Marker>
  );
}

export default function PublicVehicleMap({ params }) {
  const [viewData, setViewData] = useState(() => buildViewData(params));
  const { vehicleType, vehicleNumber, title, message, company, timestamp, latitude, longitude } = viewData;

  const hasValidCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const center = hasValidCoordinates ? [latitude, longitude] : DEFAULT_CENTER;
  const icon = useMemo(() => buildVehicleIcon(vehicleType), [vehicleType]);
  const googleMapsUrl = hasValidCoordinates
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : "";

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (hasQueryPayload(params)) {
      const nextViewData = buildViewData(params);
      setViewData(nextViewData);
      window.sessionStorage.setItem(PUBLIC_MAP_STATE_KEY, JSON.stringify(nextViewData));
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    try {
      const stored = window.sessionStorage.getItem(PUBLIC_MAP_STATE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        setViewData((current) => ({ ...current, ...parsed }));
      }
    } catch {
      // Ignore malformed stored state.
    }
  }, [params]);

  return (
    <div className={styles.page}>
      <div className={styles.mapShell}>
        {hasValidCoordinates ? (
          <>
            <MapContainer
              center={center}
              zoom={DEFAULT_ZOOM}
              scrollWheelZoom={true}
              zoomControl={false}
              className={styles.map}
            >
              <ZoomControl position="bottomright" />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitVehicleBounds center={center} />
              <CircleMarker
                center={center}
                radius={24}
                pathOptions={{
                  color: "#ff8a24",
                  weight: 2,
                  opacity: 0.9,
                  fillColor: "#ff8a24",
                  fillOpacity: 0.12,
                }}
              />
              <CircleMarker
                center={center}
                radius={10}
                pathOptions={{
                  color: "#0b1017",
                  weight: 2,
                  opacity: 0.55,
                  fillColor: "#ffffff",
                  fillOpacity: 0.22,
                }}
              />
              <VehicleMarker
                center={center}
                icon={icon}
                vehicleNumber={vehicleNumber}
                vehicleType={vehicleType}
                latitude={latitude}
                longitude={longitude}
              />
            </MapContainer>

            <div className={styles.overlayTop}>
              <div className={styles.headerCard}>
                <h1 className={styles.title}>{vehicleNumber || "Single Vehicle Map"}</h1>
                <p className={styles.subtitle}>{title}</p>
              </div>

              <div className={styles.actionsCard}>
                {googleMapsUrl ? (
                  <a
                    className={styles.mapsLink}
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                ) : null}
              </div>
            </div>

            <div className={styles.overlayBottomLeft}>
              <div className={styles.poweredCard}>
                <span className={styles.brandName}>{company || "Visual Telematics Platform"}</span>
                <span className={styles.brandSub}>Powered by VTP</span>
              </div>
            </div>

            <div className={styles.overlayBottomRight}>
              <div className={styles.infoStrip}>
                {message ? <span className={styles.messageInline}>{message}</span> : null}
                {timestamp ? <span className={styles.infoPill}>{timestamp}</span> : null}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <h2>Location unavailable</h2>
            <p>
              Required query params missing. Use <code>lat</code> and <code>lng</code> or a{" "}
              <code>q=lat,lng</code> pair.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
