import FeatureLandingPage from "@/components/FeatureLandingPage";

function toTitleSlug(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts.join(" - ");
}

export default async function ComplaintModulePage({ params }) {
  const { slug } = await params;
  return <FeatureLandingPage section="Complaint" slug={toTitleSlug(slug)} menuKey={`complain.${slug.join(".")}`} />;
}
