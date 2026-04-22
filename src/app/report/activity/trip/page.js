import dynamic from "next/dynamic";

const TripSummaryReportPage = dynamic(() => import("@/features/reports/pages/TripSummaryReportPage"));

export default function TripSummaryReportRoute() {
  return <TripSummaryReportPage menuKey="report.activity.trip" />;
}
