import dynamic from "next/dynamic";

const KeOverSpeedSummaryReportPage = dynamic(() => import("@/features/reports/pages/KeOverSpeedSummaryReportPage"));

export default function KeOverSpeedSummaryReportRoute() {
  return (
    <KeOverSpeedSummaryReportPage
      menuKey="report.ke.over-speed-summary"
      accessMenuKey="report.activity.over-speed-summary"
    />
  );
}
