import MobileFeatureMenuPage from "@/components/MobileFeatureMenuPage";
import { chartMenuItems, reportMenuItems } from "@/lib/customerMenus";

export default function ReportPage() {
  return (
    <MobileFeatureMenuPage
      title="Reports"
      primaryTabLabel="Reports"
      secondaryTabLabel="Charts"
      primaryItems={reportMenuItems}
      secondaryItems={chartMenuItems}
      primaryMode="sections"
      secondaryMode="sections"
      desktopDescription="Access report modules from one branded workspace."
    />
  );
}
