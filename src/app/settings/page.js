"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AccessGuardState from "@/components/AccessGuardState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";
import { navigateWithTransition } from "@/lib/navigation";
import MobileFeatureMenuPage from "@/components/MobileFeatureMenuPage";
import { hasAnyMenuAction, routeToMenuKey } from "@/lib/rbacAccess";
import { settingMenuItems } from "@/lib/customerMenus";
import { useRbacSession } from "@/lib/useRbacAccess";
import { customerSettingsModuleGroups, customerSettingsModuleItems } from "@/lib/customerSettingsModules";
import { useAppShell } from "@/components/AppShellContext";

const moduleRows = customerSettingsModuleItems.map((item) => ({
  label: item.label,
  href: item.href,
  sectionLabel: item.sectionLabel,
}));

const preferenceRows = [
  { label: "Notifications", action: "Manage" },
  { label: "Security", action: "Change Password" },
  { label: "Language", value: "English" },
  { label: "Timezone", value: "GMT+5 (PKT)" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [backLoading, setBackLoading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const { session, ready } = useRbacSession();
  const { shellActive } = useAppShell();
  const visibleModuleRows = moduleRows;
  const canViewSettings =
    hasAnyMenuAction(session, ["settings"], "view", { allowParentView: true }) ||
    hasAnyMenuAction(
      session,
      visibleModuleRows.map((item) => routeToMenuKey(item.href)),
      "view",
      { allowParentView: true }
    ) ||
    visibleModuleRows.length > 0;

  useEffect(() => {
    router.prefetch("/tracking");
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (isMobileView) {
    return (
      <MobileFeatureMenuPage
        title="Setting"
        primaryTabLabel="Setting"
        primaryItems={settingMenuItems}
        secondaryItems={[]}
        mobileVariant="settings"
        desktopDescription="Access customer settings modules from one branded workspace."
      />
    );
  }

  return (
    <>
      {!shellActive ? <Sidebar isOpen={true} /> : null}
      {!shellActive ? <Header /> : null}
      <main className={styles.page}>
        {!ready ? (
          <AccessGuardState
            mode="loading"
            title="Settings access is loading"
            message="Checking your allowed master-data modules."
          />
        ) : !canViewSettings ? (
          <AccessGuardState
            title="Settings access denied"
            message="You do not currently have view access to any settings modules."
          />
        ) : (
          <>
            <button
              type="button"
              className={styles.backBtn}
              aria-label="Back to Home"
              disabled={backLoading}
              onClick={() => {
                setBackLoading(true);
                navigateWithTransition(router, "/tracking");
              }}
            >
              {backLoading ? "Opening..." : "Back to Home"}
            </button>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.eyebrow}>Customer Settings</span>
                  <h1>Settings</h1>
                  <p className={styles.subtitle}>
                    Manage general preferences and open customer master modules from one place.
                  </p>
                </div>
              </div>

              <div className={styles.sectionGrid}>
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionTag}>General</span>
                    <h2>Preferences</h2>
                  </div>
                  {preferenceRows.map((item) => (
                    <div className={styles.row} key={item.label}>
                      <span>{item.label}</span>
                      {item.action ? (
                        <button type="button" className={styles.linkBtn}>
                          {item.action}
                        </button>
                      ) : (
                        <strong>{item.value}</strong>
                      )}
                    </div>
                  ))}
                </section>

                <section className={styles.sectionCard}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionTag}>Modules</span>
                    <h2>Master Data</h2>
                  </div>
                  {customerSettingsModuleGroups.map((group) => {
                    const groupRows = visibleModuleRows.filter((item) => item.sectionLabel === group.sectionLabel);
                    if (!groupRows.length) return null;
                    return (
                      <React.Fragment key={group.sectionLabel}>
                        <div className={styles.row}>
                          <strong>{group.sectionLabel}</strong>
                          <span />
                        </div>
                        {groupRows.map((item) => (
                          <div className={styles.row} key={item.href}>
                            <span>{item.label}</span>
                            <Link href={item.href} className={styles.linkBtn}>
                              View
                            </Link>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </section>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
