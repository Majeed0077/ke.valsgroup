import dynamic from "next/dynamic";

const KeStoppageSummaryReportPage = dynamic(() => import("@/features/reports/pages/KeStoppageSummaryReportPage"));

export default function KeStoppageSummaryReportRoute() {
  return <KeStoppageSummaryReportPage menuKey="report.ke.stoppage" accessMenuKey="report.activity.stoppage" />;
}
