"use client";

import React, { useMemo, useState } from "react";
import { FaChevronLeft } from "react-icons/fa";
import styles from "./MapTypeSwitcher.module.css";

const PROVIDERS = [
  { id: "osm", label: "OSM" },
  { id: "google", label: "Google" },
];

const GOOGLE_TYPES = [
  { id: "google_roadmap", label: "Google Roadmap" },
  { id: "google_satellite", label: "Google Satellite" },
  { id: "google_hybrid", label: "Google Hybrid" },
  { id: "google_terrain", label: "Google Terrain" },
];

const isGoogleType = (type) => typeof type === "string" && type.startsWith("google_");

export default function MapTypeSwitcher({ isOpen, mapType, onSelect }) {
  const [submenu, setSubmenu] = useState("root");

  const activeProvider = useMemo(() => {
    if (mapType === "osm" || mapType === "default") return "osm";
    if (isGoogleType(mapType) || mapType === "satellite") return "google";
    return "osm";
  }, [mapType]);

  if (!isOpen) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Select Map</div>
      <div className={styles.body}>
        {submenu === "root" && (
          <div className={styles.menuList}>
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`${styles.menuItem} ${
                  activeProvider === provider.id ? styles.menuItemActive : ""
                }`}
                onClick={() => {
                  if (provider.id === "osm") {
                    onSelect?.("osm");
                    return;
                  }
                  setSubmenu("google");
                }}
              >
                <span>{provider.label}</span>
                <FaChevronLeft className={styles.chevron} />
              </button>
            ))}
          </div>
        )}

        {submenu === "google" && (
          <div className={styles.menuList}>
            {GOOGLE_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`${styles.menuItem} ${mapType === type.id ? styles.menuItemActive : ""}`}
                onClick={() => onSelect?.(type.id)}
              >
                <span>{type.label}</span>
              </button>
            ))}
            <button type="button" className={styles.backItem} onClick={() => setSubmenu("root")}>
              <FaChevronLeft />
              <span>Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
