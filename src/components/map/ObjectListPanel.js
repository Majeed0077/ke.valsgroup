"use client";

import React from "react";
import { FaChevronRight, FaSearch, FaTimes } from "react-icons/fa";
import styles from "./ObjectListPanel.module.css";

const FILTERS = [
  { key: "all", label: "All", className: styles.tabAll },
  { key: "running", label: "Active", className: styles.tabRunning },
  { key: "idle", label: "Idle", className: styles.tabIdle },
  { key: "stopped", label: "Stop", className: styles.tabStopped },
  { key: "inactive", label: "Inactive", className: styles.tabInactive },
];

const STATUS_CLASS_MAP = {
  running: {
    text: styles.statusRunning,
    item: styles.itemRunning,
  },
  stopped: {
    text: styles.statusStopped,
    item: styles.itemStopped,
  },
  idle: {
    text: styles.statusIdle,
    item: styles.itemIdle,
  },
  inactive: {
    text: styles.statusInactive,
    item: styles.itemInactive,
  },
};

export default function ObjectListPanel({
  totalCount,
  vehicles,
  searchTerm,
  onSearchChange,
  activeFilter,
  onFilterChange,
  counts,
  selectedVehicleId,
  getStatusKey,
  getSignalText,
  statusLabels,
  onVehicleSelect,
  onClose,
}) {
  const getVehicleStableId = (vehicle) =>
    String(
      vehicle?.id ||
        vehicle?.vehicleId ||
        vehicle?.imei_id ||
        vehicle?.vehicle_no ||
        vehicle?.obj_reg_no ||
        vehicle?.obj_name ||
        `${vehicle?.latitude ?? "x"}:${vehicle?.longitude ?? "y"}`
    ).trim();

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h3 className={styles.title}>Objects</h3>
        </div>
        <div className={styles.badgeRow}>
          <span className={styles.countBadge}>{totalCount}</span>
          {typeof onClose === "function" ? (
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close object list">
              <FaTimes />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.searchWrap}>
        <label className={styles.searchShell} aria-label="Search objects">
          <FaSearch aria-hidden="true" />
          <input
            className={styles.searchInput}
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Search objects..."
          />
        </label>
      </div>

      <div className={styles.tabs}>
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`${styles.tab} ${filter.className} ${activeFilter === filter.key ? styles.tabActive : ""}`}
            onClick={() => onFilterChange?.(filter.key)}
          >
            <span className={styles.tabText}>
              {filter.label} {counts?.[filter.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {vehicles.length === 0 ? (
          <div className={styles.empty}>No vehicles found.</div>
        ) : (
           vehicles.map((vehicle) => {
             const statusKey = getStatusKey(vehicle);
             const visualStatus = STATUS_CLASS_MAP[statusKey] || {
              text: styles.statusFallback,
              item: styles.itemFallback,
             };

             return (
               <button
                 key={getVehicleStableId(vehicle)}
                 type="button"
                 className={`${styles.item} ${
                   getVehicleStableId(vehicle) === String(selectedVehicleId ?? "") ? styles.itemActive : ""
                } ${visualStatus.item}`}
                 onClick={() => onVehicleSelect?.(vehicle)}
               >
                 <span className={styles.main}>
                   <span
                     className={styles.head}
                     // Inline fallback so first-open doesn't look broken if CSS chunk is late (dev/HMR).
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span className={styles.vehicleId}>
                      {vehicle.vehicle_no || vehicle.imei_id || "Vehicle"}
                    </span>
                    <span className={`${styles.status} ${visualStatus.text}`}>
                      {statusLabels?.[statusKey] || statusLabels?.nodata || "Unknown"}
                    </span>
                  </span>
                  <span className={styles.signal}>{getSignalText(vehicle)}</span>
                </span>
                <span className={styles.chevron} aria-hidden="true">
                  <FaChevronRight />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
