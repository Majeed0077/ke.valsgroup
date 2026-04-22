import dynamic from "next/dynamic";

const OverSpeedingReportPage = dynamic(() => import("@/features/reports/pages/OverSpeedingReportPage"));

export default function OverSpeedingReportRoute() {
  return <OverSpeedingReportPage menuKey="report.activity.over-speeding-report" />;
}
