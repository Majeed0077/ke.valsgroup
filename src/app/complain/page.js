import MobileFeatureMenuPage from "@/components/MobileFeatureMenuPage";
import { complaintMenuItems } from "@/lib/customerMenus";

export default function ComplaintPage() {
  return (
    <MobileFeatureMenuPage
      title="Complaint"
      primaryTabLabel="Complaint"
      primaryItems={complaintMenuItems}
      primaryMode="sections"
      secondaryItems={[]}
      desktopDescription="Access complaint workflows from one branded workspace."
    />
  );
}
