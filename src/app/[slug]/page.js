import { notFound } from "next/navigation";
import CustomerModulePage from "@/components/CustomerModulePage";
import { getCustomerSettingsModuleBySlug } from "@/lib/customerSettingsModules";

export default function CustomerSettingsModulePage({ params }) {
  const moduleConfig = getCustomerSettingsModuleBySlug(params?.slug);

  if (!moduleConfig) {
    notFound();
  }

  return (
    <CustomerModulePage
      title={moduleConfig.label}
      description={moduleConfig.description}
    />
  );
}
