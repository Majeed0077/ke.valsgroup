"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuth } from "@/app/fleet-dashboard/useAuth";
import { useConfigureAppShell } from "@/components/AppShellContext";
import CenteredCarLoader from "@/components/CenteredCarLoader";

const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
  loading: () => <DashboardPageLoader />,
});

function DashboardPageLoader() {
  return <CenteredCarLoader fixed scope="page" />;
}

export default function DashboardPage() {
  const [isMobileView, setIsMobileView] = useState(false);
  const { authChecked, isAuthenticated } = useAuth();
  const shellHeaderProps = useMemo(
    () => ({
      hideAuthActions: !authChecked || !isAuthenticated,
    }),
    [authChecked, isAuthenticated]
  );

  useConfigureAppShell({ headerProps: shellHeaderProps });

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileView(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!authChecked) {
    return <DashboardPageLoader />;
  }

  if (!isAuthenticated) {
    return <DashboardPageLoader />;
  }

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          paddingBottom: isMobileView ? "100px" : "0",
          background: isMobileView ? "#0e1116" : undefined,
        }}
      >
        <Dashboard isMobileView={isMobileView} />
      </div>
      {isMobileView ? <MobileBottomNav /> : null}
    </>
  );
}
