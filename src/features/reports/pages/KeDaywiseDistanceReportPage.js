"use client";

import DaywiseDistanceReportPage from "@/features/reports/pages/DaywiseDistanceReportPage";

export default function KeDaywiseDistanceReportPage({ menuKey = "", accessMenuKey = menuKey }) {
  return <DaywiseDistanceReportPage menuKey={menuKey} accessMenuKey={accessMenuKey} mode="ke" />;
}
