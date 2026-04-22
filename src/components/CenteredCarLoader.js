"use client";

import React from "react";
import styles from "@/app/page.module.css";

export default function CenteredCarLoader({
  fixed = false,
  scope = "page",
}) {
  return (
    <div
      className={styles.centerLoaderOverlay}
      data-loader-scope={scope}
      style={fixed ? { position: "fixed" } : undefined}
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.centerLoaderCard}>
        <div className={styles.loaderOrbit}>
          <div className={styles.loaderTrack} />
          <div className={styles.loaderCar} />
        </div>
      </div>
    </div>
  );
}
