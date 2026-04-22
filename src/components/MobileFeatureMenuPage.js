"use client";

import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FaChevronRight, FaSignOutAlt, FaUser } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import { redirectToLogout } from "@/lib/authClient";
import { navigateWithTransition } from "@/lib/navigation";
import { filterMenuItemsByAccess } from "@/lib/rbacAccess";
import { useRbacSession } from "@/lib/useRbacAccess";
import styles from "./MobileFeatureMenuPage.module.css";

const PROFILE_STORAGE_KEY = "vtp_profile_data_v1";
const DEFAULT_PROFILE_NAME = "Majeed Abro";

export default function MobileFeatureMenuPage({
  title,
  primaryTabLabel,
  secondaryTabLabel,
  primaryItems = [],
  secondaryItems = [],
  primaryMode = "flat",
  secondaryMode = "flat",
  mobileVariant = "default",
  desktopDescription,
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("primary");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [profileName, setProfileName] = useState(DEFAULT_PROFILE_NAME);
  const { session, ready } = useRbacSession();

  const filteredPrimaryItems = useMemo(() => {
    if (mobileVariant === "settings") return primaryItems;
    if (!ready) return primaryItems;
    return filterMenuItemsByAccess(primaryItems, session);
  }, [mobileVariant, primaryItems, ready, session]);
  const filteredSecondaryItems = useMemo(() => {
    if (mobileVariant === "settings") return secondaryItems;
    if (!ready) return secondaryItems;
    return filterMenuItemsByAccess(secondaryItems, session);
  }, [mobileVariant, ready, secondaryItems, session]);
  const items = activeTab === "primary" ? filteredPrimaryItems : filteredSecondaryItems;
  const activeMode = activeTab === "primary" ? primaryMode : secondaryMode;

  const groupedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        targetHref: item.subItems?.[0]?.href || item.href,
      })),
    [items]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nextName = String(parsed?.name || "").trim();
      if (nextName) setProfileName(nextName);
    } catch {
      // ignore invalid profile storage
    }
  }, []);

  const profileInitials = useMemo(() => {
    const parts = String(profileName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "VT";
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [profileName]);

  const handleLogout = () => {
    redirectToLogout("/login");
  };

  const handleFastNavigate = (href) => {
    if (!href) return;
    router.prefetch(href);
    startTransition(() => {
      navigateWithTransition(router, href);
    });
  };

  return (
    <>
      <div className={styles.desktopShell}>
        <Sidebar
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
        <Header />
        <main
          className={styles.desktopPage}
          style={{
            marginLeft: isSidebarOpen ? "88px" : "0",
            width: isSidebarOpen ? "calc(100% - 88px)" : "100%",
          }}
        >
          <section className={styles.desktopCard}>
            <h1>{title}</h1>
            <p>{desktopDescription}</p>
            <div className={styles.desktopList}>
              {filteredPrimaryItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.desktopRow}
                  onMouseEnter={() => item.subItems?.[0]?.href || item.href ? router.prefetch(item.subItems?.[0]?.href || item.href) : null}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleFastNavigate(item.subItems?.[0]?.href || item.href);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleFastNavigate(item.subItems?.[0]?.href || item.href);
                  }}
                  onClick={() => handleFastNavigate(item.subItems?.[0]?.href || item.href)}
                >
                  <span>{item.label}</span>
                  <FaChevronRight size={12} />
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>

      <div className={styles.mobilePage}>
        <div className={styles.mobilePhoneShell}>
          {mobileVariant === "settings" ? (
            <>
              <div className={styles.settingsProfileBar}>
                <div className={styles.settingsProfileLeft}>
                  <div className={styles.settingsAvatar}>{profileInitials}</div>
                  <div className={styles.settingsProfileText}>
                    <strong>{profileName}</strong>
                  </div>
                </div>
              </div>
              <div className={styles.settingsTitleBar}>Settings</div>
              <div className={styles.settingsActionsRow}>
                <button
                  type="button"
                  className={styles.settingsActionBtn}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    handleFastNavigate("/profile");
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleFastNavigate("/profile");
                  }}
                  onClick={() => handleFastNavigate("/profile")}
                >
                  <FaUser size={14} />
                  <span>Profile</span>
                </button>
                {/* <button
                  type="button"
                  className={styles.settingsActionBtn}
                  onClick={() => navigateWithTransition(router, "/settings")}
                >
                  <FaCog size={14} />
                  <span>Setting</span>
                </button> */}
                <button
                  type="button"
                  className={`${styles.settingsActionBtn} ${styles.settingsActionBtnDanger}`}
                  onClick={handleLogout}
                >
                  <FaSignOutAlt size={14} />
                  <span>Logout</span>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.mobileTopBar}>
              <strong>{title}</strong>
            </div>
          )}

          {filteredSecondaryItems.length > 0 ? (
            <div className={styles.segmentedTabs}>
              <button
                type="button"
                className={`${styles.segmentBtn} ${activeTab === "primary" ? styles.segmentBtnActive : ""}`}
                onClick={() => setActiveTab("primary")}
              >
                {primaryTabLabel}
              </button>
              <button
                type="button"
                className={`${styles.segmentBtn} ${activeTab === "secondary" ? styles.segmentBtnActive : ""}`}
                onClick={() => setActiveTab("secondary")}
              >
                {secondaryTabLabel}
              </button>
            </div>
          ) : null}

          <div className={`${styles.mobileListWrap} ${mobileVariant === "settings" ? styles.mobileListWrapSettings : ""}`}>
            {activeMode === "sections"
              ? groupedItems.map((item) => (
                  <section key={item.key} className={styles.mobileSection}>
                    <h4 className={styles.mobileSectionTitle}>{item.label}</h4>
                    <div className={styles.mobileSectionList}>
                      {(item.subItems || []).map((subItem) => (
                        <button
                          key={subItem.href}
                          type="button"
                          className={styles.mobileRow}
                          onMouseEnter={() => router.prefetch(subItem.href)}
                          onTouchStart={() => router.prefetch(subItem.href)}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            handleFastNavigate(subItem.href);
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleFastNavigate(subItem.href);
                          }}
                          onClick={() => handleFastNavigate(subItem.href)}
                        >
                          <span className={styles.mobileRowLeft}>
                            {item.Icon ? <item.Icon size={15} className={styles.mobileIcon} /> : null}
                            <span>{subItem.label}</span>
                          </span>
                          <FaChevronRight size={12} className={styles.mobileChevron} />
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              : groupedItems.map((item) => {
                  const Icon = item.Icon;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.mobileRow}
                      onMouseEnter={() => item.targetHref ? router.prefetch(item.targetHref) : null}
                      onTouchStart={() => item.targetHref ? router.prefetch(item.targetHref) : null}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        handleFastNavigate(item.targetHref);
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleFastNavigate(item.targetHref);
                      }}
                      onClick={() => handleFastNavigate(item.targetHref)}
                    >
                      <span className={styles.mobileRowLeft}>
                        {Icon ? <Icon size={17} className={styles.mobileIcon} /> : null}
                        <span>{item.label}</span>
                      </span>
                      <FaChevronRight size={12} className={styles.mobileChevron} />
                    </button>
                  );
                })}

            {ready && groupedItems.length === 0 ? (
              <div className={styles.mobileRow} style={{ cursor: "default" }}>
                <span className={styles.mobileRowLeft}>
                  <span>No permitted items available in this section.</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <MobileBottomNav />
      </div>
    </>
  );
}
