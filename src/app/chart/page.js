import MobileFeatureMenuPage from "@/components/MobileFeatureMenuPage";
import { chartMenuItems, reportMenuItems } from "@/lib/customerMenus";

export default function ChartPage() {
  return (
    <MobileFeatureMenuPage
      title="Charts"
      primaryTabLabel="Charts"
      secondaryTabLabel="Reports"
      primaryItems={chartMenuItems}
      secondaryItems={reportMenuItems}
      desktopDescription="Access chart modules from one branded workspace."
    />
  );
}
