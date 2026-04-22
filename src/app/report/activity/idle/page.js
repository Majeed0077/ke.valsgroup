import dynamic from "next/dynamic";

const IdleSummaryReportPage = dynamic(() => import("@/features/reports/pages/IdleSummaryReportPage"));

export default function IdleSummaryReportRoute() {
  return <IdleSummaryReportPage menuKey="report.activity.idle" />;
}
