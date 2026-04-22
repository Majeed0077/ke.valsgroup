import dynamic from "next/dynamic";

const KeDaywiseDistanceReportPage = dynamic(() => import("@/features/reports/pages/KeDaywiseDistanceReportPage"));

export default function KeDaywiseDistanceReportRoute() {
  return (
    <KeDaywiseDistanceReportPage
      menuKey="report.ke.daywise-distance"
      accessMenuKey="report.activity.daywise-distance"
    />
  );
}
