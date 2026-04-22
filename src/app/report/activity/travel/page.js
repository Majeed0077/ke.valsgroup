import dynamic from "next/dynamic";

const TravelSummaryReportPage = dynamic(() => import("@/features/reports/pages/TravelSummaryReportPage"));

export default function TravelSummaryReportRoute() {
  return <TravelSummaryReportPage menuKey="report.activity.travel" />;
}
