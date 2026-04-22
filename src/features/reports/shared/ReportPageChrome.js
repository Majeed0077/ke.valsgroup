"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useConfigureAppShell, useAppShell } from "@/components/AppShellContext";

const Sidebar = dynamic(() => import("@/components/Sidebar"), {
  ssr: false,
  loading: () => null,
});

const MobileBottomNav = dynamic(() => import("@/components/MobileBottomNav"), {
  ssr: false,
  loading: () => null,
});

export function useReportPageMobileView() {
  const [isMobileView, setIsMobileView] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobileView;
}

export default function ReportPageChrome({
  isMobileView,
  hideDashboardToggle = true,
}) {
  const { shellActive } = useAppShell();
  const shellSidebarProps = React.useMemo(
    () => ({
      hideDashboardToggle,
    }),
    [hideDashboardToggle]
  );

  useConfigureAppShell({ headerVisible: false, sidebarProps: shellSidebarProps });

  return (
    <>
      {!shellActive && !isMobileView ? <Sidebar isOpen={true} hideDashboardToggle={hideDashboardToggle} /> : null}
      {isMobileView ? <MobileBottomNav /> : null}
    </>
  );
}
