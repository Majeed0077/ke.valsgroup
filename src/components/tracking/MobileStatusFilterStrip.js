"use client";

import React from "react";
import styles from "@/app/page.module.css";
import { MOBILE_STATUS_FILTERS } from "./mobileStatusFilterConfig";

export default function MobileStatusFilterStrip({
  activeFilter,
  statusSummary,
  onFilterChange,
}) {
  const applyFilter = (event, nextFilter) => {
    if (typeof onFilterChange === "function") {
      onFilterChange(event, nextFilter);
    }
  };

  return (
    <section className={styles.mobileStatusStrip} aria-label="Vehicle Status Summary">
      {MOBILE_STATUS_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.key;
        const countValue = statusSummary?.[filter.countKey] ?? 0;
        const helperText = filter.helperText(statusSummary);

        return (
          <button
            key={filter.key}
            type="button"
            className={`${styles.mobileStatusCard} ${styles[filter.toneClassName]} ${
              isActive ? styles.mobileStatusCardActive : ""
            }`}
            onMouseDown={(event) => applyFilter(event, filter.key)}
            onTouchStart={(event) => applyFilter(event, filter.key)}
            onPointerDown={(event) => applyFilter(event, filter.key)}
            onClick={(event) => applyFilter(event, filter.key)}
          >
            <span>{filter.label}</span>
            <strong>{countValue}</strong>
            <small>{helperText}</small>
          </button>
        );
      })}
    </section>
  );
}
