import dynamic from "next/dynamic";

const DetailActivityReportPage = dynamic(() => import("@/features/reports/pages/DetailActivityReportPage"));

export default function DetailActivityReportRoute() {
  return <DetailActivityReportPage menuKey="report.activity.detail-activity-report" />;
}
