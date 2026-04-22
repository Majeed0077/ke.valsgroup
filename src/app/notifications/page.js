import { Suspense } from "react";
import NotificationsInboxPage from "@/components/NotificationsInboxPage";

export const metadata = {
  title: "Notifications | KE Fleet",
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsInboxPage />
    </Suspense>
  );
}
