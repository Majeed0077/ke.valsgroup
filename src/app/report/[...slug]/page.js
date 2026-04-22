import FeatureLandingPage from "@/components/FeatureLandingPage";

function toTitleSlug(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts.join(" - ");
}

export default async function ReportModulePage({ params }) {
  const { slug } = await params;
  const routeKey = Array.isArray(slug) ? slug.join(".") : "";
  return <FeatureLandingPage section="Report" slug={toTitleSlug(slug)} menuKey={`report.${routeKey}`} />;
}
