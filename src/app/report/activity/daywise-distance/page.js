import dynamic from "next/dynamic";

const DaywiseDistanceReportPage = dynamic(() => import("@/features/reports/pages/DaywiseDistanceReportPage"));

export default function DaywiseDistanceReportRoute() {
  return <DaywiseDistanceReportPage menuKey="report.activity.daywise-distance" accessMenuKey="report.activity.daywise-distance" mode="activity" />;
}
