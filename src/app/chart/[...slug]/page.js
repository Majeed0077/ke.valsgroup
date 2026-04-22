import FeatureLandingPage from "@/components/FeatureLandingPage";

function toTitleSlug(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts.join(" - ");
}

export default async function ChartModulePage({ params }) {
  const { slug } = await params;
  return <FeatureLandingPage section="Chart" slug={toTitleSlug(slug)} menuKey={`chart.${slug.join(".")}`} />;
}
