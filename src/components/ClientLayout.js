"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  NavigationProgressProvider,
  announceNavigationEnd,
} from "@/components/NavigationProgress";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import {
  AppShellProvider,
  DEFAULT_APP_HEADER_PROPS,
  DEFAULT_APP_SIDEBAR_PROPS,
} from "@/components/AppShellContext";
import styles from "./ClientLayout.module.css";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/public-map",
];

function shouldHideDesktopShell(pathname) {
  if (!pathname || pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const ClientLayoutFrame = React.memo(function ClientLayoutFrame({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileView, setIsMobileView] = React.useState(false);
  const [headerVisible, setHeaderVisibleState] = React.useState(false);
  const [headerProps, setHeaderPropsState] = React.useState(DEFAULT_APP_HEADER_PROPS);
  const [sidebarProps, setSidebarPropsState] = React.useState(DEFAULT_APP_SIDEBAR_PROPS);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    announceNavigationEnd({
      pathname,
      query: searchParams?.toString?.() || "",
    });
  }, [pathname, searchParams]);

  const isAdminEmbeddedView = searchParams.get("admin_view") === "1";
  const shellActive = !isAdminEmbeddedView && !isMobileView && !shouldHideDesktopShell(pathname);
  const sidebarOffset = shellActive ? "88px" : "0";

  const setHeaderProps = React.useCallback((nextProps) => {
    setHeaderPropsState({
      ...DEFAULT_APP_HEADER_PROPS,
      ...(nextProps || {}),
    });
  }, []);

  const resetHeaderProps = React.useCallback(() => {
    setHeaderPropsState(DEFAULT_APP_HEADER_PROPS);
  }, []);

  const setHeaderVisible = React.useCallback((nextVisible) => {
    setHeaderVisibleState(Boolean(nextVisible));
  }, []);

  const resetHeaderVisible = React.useCallback(() => {
    setHeaderVisibleState(false);
  }, []);

  const setSidebarProps = React.useCallback((nextProps) => {
    setSidebarPropsState({
      ...DEFAULT_APP_SIDEBAR_PROPS,
      ...(nextProps || {}),
    });
  }, []);

  const resetSidebarProps = React.useCallback(() => {
    setSidebarPropsState(DEFAULT_APP_SIDEBAR_PROPS);
  }, []);

  const shellValue = React.useMemo(
    () => ({
      shellActive,
      isMobileView,
      headerVisible,
      headerProps,
      sidebarProps,
      setHeaderVisible,
      resetHeaderVisible,
      setHeaderProps,
      resetHeaderProps,
      setSidebarProps,
      resetSidebarProps,
    }),
    [
      headerProps,
      headerVisible,
      isMobileView,
      resetHeaderVisible,
      resetHeaderProps,
      resetSidebarProps,
      setHeaderVisible,
      setHeaderProps,
      setSidebarProps,
      shellActive,
      sidebarProps,
    ]
  );

  return (
    <AppShellProvider value={shellValue}>
      <div className={styles.routeShell}>
        {shellActive ? <Sidebar {...sidebarProps} /> : null}
        <div
          className={styles.contentFrame}
          style={{
            marginLeft: sidebarOffset,
            width: shellActive ? `calc(100% - ${sidebarOffset})` : "100%",
          }}
        >
          {shellActive && headerVisible ? <Header {...headerProps} /> : null}
          <div className={styles.contentSurface}>{children}</div>
        </div>
      </div>
    </AppShellProvider>
  );
});

export default function ClientLayout({ children }) {
  return (
    <NavigationProgressProvider>
      <ClientLayoutFrame>{children}</ClientLayoutFrame>
    </NavigationProgressProvider>
  );
}
