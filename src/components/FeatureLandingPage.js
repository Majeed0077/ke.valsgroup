"use client";

import React, { useMemo } from "react";
import AccessGuardState from "@/components/AccessGuardState";
import { useMenuAccess } from "@/lib/useRbacAccess";
import styles from "./FeatureLandingPage.module.css";

function titleCaseFromSlug(slug) {
  return String(slug || "")
    .split(/[-/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function FeatureLandingPage({ section, slug, menuKey = "" }) {
  const title = useMemo(() => titleCaseFromSlug(slug), [slug]);
  const { ready, canView, allowedActions } = useMenuAccess(menuKey);

  return (
    <main className={styles.page}>
      {!ready && menuKey ? (
        <AccessGuardState
          mode="loading"
          title={`${title || "Module"} access is loading`}
          message="Checking your menu rights before opening this module."
        />
      ) : menuKey && !canView ? (
        <AccessGuardState
          title={`${title || "Module"} access denied`}
          message={`You do not currently have view access for ${menuKey}.`}
        />
      ) : (
        <section className={styles.card}>
          <h1 className={styles.title}>{title || "Module"}</h1>
          <p className={styles.sub}>
            {section} module view opened successfully. You can connect full API/workflow here.
          </p>
          <div className={styles.row}>
            <span>Section</span>
            <strong>{section}</strong>
          </div>
          <div className={styles.row}>
            <span>Module</span>
            <strong>{title || "-"}</strong>
          </div>
          <div className={styles.row}>
            <span>Status</span>
            <span className={styles.tag}>Open</span>
          </div>
          {Object.keys(allowedActions || {}).length ? (
            <div className={styles.row}>
              <span>Allowed Actions</span>
              <strong>
                {Object.entries(allowedActions)
                  .filter(([, allowed]) => allowed)
                  .map(([action]) => action)
                  .join(", ") || "view"}
              </strong>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
