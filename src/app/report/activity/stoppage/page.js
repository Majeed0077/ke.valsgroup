import dynamic from "next/dynamic";

const StoppageSummaryReportPage = dynamic(() => import("@/features/reports/pages/StoppageSummaryReportPage"));

export default function StoppageSummaryReportRoute() {
  return <StoppageSummaryReportPage menuKey="report.activity.stoppage" />;
}
