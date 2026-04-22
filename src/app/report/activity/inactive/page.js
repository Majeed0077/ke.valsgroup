import dynamic from "next/dynamic";

const InactiveSummaryReportPage = dynamic(() => import("@/features/reports/pages/InactiveSummaryReportPage"));

export default function InactiveSummaryReportRoute() {
  return <InactiveSummaryReportPage menuKey="report.activity.inactive" />;
}
