import L from "leaflet";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";
import { getVehicleImageSrc } from "@/lib/vehicleImage";

const createVehicleIcon = (iconUrl, size = [30, 30], anchor = [size[0] / 2, size[1] / 2]) => {
  if (!iconUrl) return new L.Icon.Default();
  return L.icon({ iconUrl, iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1]] });
};

export const iconRegistry = {
  carRunning: createVehicleIcon("/icons/green-car.svg", [36, 36]),
  carIdle: createVehicleIcon("/icons/yellow-car.svg", [36, 36]),
  carStopped: createVehicleIcon("/icons/red-car.svg", [36, 36]),
  carInactive: createVehicleIcon("/icons/blue-car.svg", [36, 36]),
  carNoData: createVehicleIcon("/icons/grey-car.svg", [36, 36]),
  bike: createVehicleIcon("/icons/bike.png", [32, 32]),
  truck: createVehicleIcon("/icons/truck.png", [40, 40]),
  van: createVehicleIcon("/icons/van.png", [36, 36]),
  bus: createVehicleIcon("/icons/bus.png", [40, 40]),
  ambulance: createVehicleIcon("/icons/ambulance.png", [36, 36]),
  rickshaw: createVehicleIcon("/icons/rickshaw.png", [32, 32]),
  hotairballoon: createVehicleIcon("/icons/hotairballoon.png", [36, 36]),
  default: createVehicleIcon(getVehicleImageSrc("default"), [36, 36]),
  placeholder: createVehicleIcon(getVehicleImageSrc("placeholder"), [36, 36]),
  safeDefault: new L.Icon.Default(),
};

const getCarIconForStatus = (vehicle) => {
  const statusKey = getVehicleStatusKey(vehicle);
  if (statusKey === "running") return iconRegistry.carRunning;
  if (statusKey === "idle") return iconRegistry.carIdle;
  if (statusKey === "stopped") return iconRegistry.carStopped;
  if (statusKey === "inactive") return iconRegistry.carInactive;
  return iconRegistry.carNoData;
};

export const getIconForVehicle = (vehicle) => {
  if (!vehicle || !vehicle.vehicle_type) return getCarIconForStatus(vehicle);
  const type = String(vehicle.vehicle_type).toLowerCase();
  if (type.includes("ambulance")) return iconRegistry.ambulance;
  if (type.includes("hot air ballon") || type.includes("hotairballon")) return iconRegistry.hotairballoon;
  if (type.includes("rickshaw")) return iconRegistry.rickshaw;
  if (type.includes("truck") || type.includes("mixer") || type.includes("handler") || type.includes("dumper") || type.includes("trailer") || type.includes("ecomet")) return iconRegistry.truck;
  if (type.includes("bus")) return iconRegistry.bus;
  if (type.includes("van") || type.includes("tempo") || type.includes("campervan")) return iconRegistry.van;
  if (type.includes("bike") || type.includes("motorcycle")) return iconRegistry.bike;
  if (type.includes("car") || type.includes("suv") || type.includes("muv") || type.includes("hatchback") || type === "mercedes") {
    return getCarIconForStatus(vehicle);
  }
  if (type.includes("default")) return getCarIconForStatus(vehicle);
  return iconRegistry.placeholder;
};
