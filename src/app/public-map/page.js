import PublicVehicleMap from "@/components/public/PublicVehicleMap";

export const metadata = {
  title: "Public Vehicle Map",
  description: "Single vehicle location view",
};

export default async function PublicMapPage({ searchParams }) {
  const params = await searchParams;
  return <PublicVehicleMap params={params || {}} />;
}
