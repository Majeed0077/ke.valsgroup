import dynamic from "next/dynamic";

const OverSpeedSummaryReportPage = dynamic(() => import("@/features/reports/pages/OverSpeedSummaryReportPage"));

export default function OverSpeedSummaryReportRoute() {
  return <OverSpeedSummaryReportPage menuKey="report.activity.over-speed-summary" />;
}
