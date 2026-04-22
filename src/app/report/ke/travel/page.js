import dynamic from "next/dynamic";

const KeTravelSummaryReportPage = dynamic(() => import("@/features/reports/pages/KeTravelSummaryReportPage"));

export default function KeTravelSummaryReportRoute() {
  return <KeTravelSummaryReportPage menuKey="report.ke.travel" accessMenuKey="report.activity.travel" />;
}
