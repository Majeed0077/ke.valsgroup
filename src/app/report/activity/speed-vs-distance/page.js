import dynamic from "next/dynamic";

const SpeedVsDistanceReportPage = dynamic(() => import("@/features/reports/pages/SpeedVsDistanceReportPage"));

export default function SpeedVsDistanceReportRoute() {
  return <SpeedVsDistanceReportPage menuKey="report.activity.speed-vs-distance" />;
}
