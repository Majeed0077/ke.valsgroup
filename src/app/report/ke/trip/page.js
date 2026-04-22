import dynamic from "next/dynamic";

const KeTripSummaryReportPage = dynamic(() => import("@/features/reports/pages/KeTripSummaryReportPage"));

export default function KeTripSummaryReportRoute() {
  return <KeTripSummaryReportPage menuKey="report.ke.trip" accessMenuKey="report.activity.trip" />;
}
