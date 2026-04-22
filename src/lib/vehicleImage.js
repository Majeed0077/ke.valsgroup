const normalizeVehicleType = (vehicleType = "") => String(vehicleType).trim().toLowerCase();

export function getVehicleImageSrc(vehicleType) {
  const type = normalizeVehicleType(vehicleType);

  if (type.includes("ambulance")) return "/icons/ambulance.png";
  if (type.includes("hot air ballon") || type.includes("hotairballon") || type.includes("hotairballoon")) {
    return "/icons/hotairballoon.png";
  }
  if (type.includes("rickshaw")) return "/icons/rickshaw.png";
  if (
    type.includes("truck") ||
    type.includes("mixer") ||
    type.includes("handler") ||
    type.includes("dumper") ||
    type.includes("trailer") ||
    type.includes("ecomet")
  ) {
    return "/icons/truck.png";
  }
  if (type.includes("bus")) return "/icons/bus.png";
  if (type.includes("van") || type.includes("tempo") || type.includes("campervan")) return "/icons/van.png";
  if (type.includes("bike") || type.includes("motorcycle")) return "/icons/bike.png";
  return "/icons/blue-car.svg";
}

export function getVehicleIconKey(vehicleType) {
  const src = getVehicleImageSrc(vehicleType);
  return src.slice("/icons/".length, src.lastIndexOf("."));
}
