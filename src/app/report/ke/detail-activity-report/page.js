import dynamic from "next/dynamic";

const KeDetailActivityReportPage = dynamic(() => import("@/features/reports/pages/KeDetailActivityReportPage"));

export default function KeDetailActivityReportRoute() {
  return (
    <KeDetailActivityReportPage
      menuKey="report.ke.detail-activity-report"
      accessMenuKey="report.activity.detail-activity-report"
    />
  );
}
