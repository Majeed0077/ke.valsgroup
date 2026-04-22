import L from "leaflet";
import { getVehicleStatusKey } from "@/lib/vehicleStatus";

export const buildClusterStatusSummary = (vehicles) => {
  const summary = { running: 0, stopped: 0, idle: 0, inactive: 0, nodata: 0 };
  (vehicles || []).forEach((vehicle) => {
    const key = getVehicleStatusKey(vehicle);
    if (summary[key] !== undefined) summary[key] += 1;
  });
  return summary;
};

const CLUSTER_STATUS_PALETTE = {
  running: "#55b54a",
  stopped: "#f2574a",
  idle: "#e2ad29",
  inactive: "#3c78eb",
  nodata: "#7f8799",
};

const getClusterDominantStatus = (summary, activeStatusFilter = "all") => {
  const normalizedFilter = String(activeStatusFilter || "all").trim().toLowerCase();
  const resolvedFilter = normalizedFilter === "total" ? "all" : normalizedFilter;
  if (resolvedFilter !== "all" && CLUSTER_STATUS_PALETTE[resolvedFilter]) {
    return resolvedFilter;
  }

  const ordered = ["running", "stopped", "idle", "inactive", "nodata"];
  let winner = "inactive";
  let winnerCount = -1;

  ordered.forEach((key) => {
    const count = Number(summary?.[key] || 0);
    if (count > winnerCount) {
      winner = key;
      winnerCount = count;
    }
  });

  return winner;
};

export const buildClusterRingGradient = (summary) => {
  const ordered = ["running", "stopped", "idle", "inactive", "nodata"];
  const total = ordered.reduce((acc, key) => acc + Number(summary?.[key] || 0), 0);
  if (!total) {
    return "conic-gradient(from -30deg, #3c78eb 0 28%, #e2ad29 28% 52%, #55b54a 52% 76%, #f2574a 76% 100%)";
  }

  let start = 0;
  const segments = [];
  ordered.forEach((key) => {
    const value = Number(summary?.[key] || 0);
    if (!value) return;
    const share = (value / total) * 100;
    const end = Math.min(100, start + share);
    segments.push(`${CLUSTER_STATUS_PALETTE[key]} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
    start = end;
  });

  if (!segments.length) return `conic-gradient(${CLUSTER_STATUS_PALETTE.nodata} 0 100%)`;
  if (start < 100) {
    segments.push(`${CLUSTER_STATUS_PALETTE.nodata} ${start.toFixed(2)}% 100%`);
  }
  return `conic-gradient(from -30deg, ${segments.join(", ")})`;
};

export const createClusterIcon = (count, statusSummary, activeStatusFilter = "all") => {
  const sizeClass =
    count >= 100 ? "vtp-cluster-xl" : count >= 20 ? "vtp-cluster-lg" : count >= 10 ? "vtp-cluster-md" : "vtp-cluster-sm";
  const toneClass =
    count >= 100
      ? "vtp-cluster-tone-strong"
      : count >= 20
        ? "vtp-cluster-tone-medium"
        : "vtp-cluster-tone-soft";
  const displayCount = count > 9999 ? "9999+" : String(count);
  const sizePx = count >= 100 ? 60 : count >= 20 ? 54 : count >= 10 ? 48 : 44;
  const ringSizePx = count >= 100 ? 12 : count >= 20 ? 11 : count >= 10 ? 10 : 9;
  const ringWidthPx = count >= 100 ? 6 : count >= 20 ? 5 : 4;
  const normalizedFilter = String(activeStatusFilter || "all").trim().toLowerCase();
  const resolvedFilter = normalizedFilter === "total" ? "all" : normalizedFilter;
  const dominantStatus = getClusterDominantStatus(statusSummary, resolvedFilter);
  const accentColor = CLUSTER_STATUS_PALETTE[dominantStatus] || CLUSTER_STATUS_PALETTE.inactive;
  const ringGradient =
    resolvedFilter !== "all" && CLUSTER_STATUS_PALETTE[resolvedFilter]
      ? `conic-gradient(from -30deg, ${CLUSTER_STATUS_PALETTE[resolvedFilter]} 0 100%)`
      : buildClusterRingGradient(statusSummary);
  const anchor = Math.round(sizePx / 2);

  return L.divIcon({
    html: `
      <div
        class="vtp-cluster-shell ${sizeClass} ${toneClass}"
        style="--vtp-ring-size:${ringSizePx}px;--vtp-ring-width:${ringWidthPx}px;--vtp-ring-gradient:${ringGradient};--vtp-cluster-tint:${accentColor};"
      >
        <span class="vtp-cluster-core">
          <span class="vtp-cluster-count">${displayCount}</span>
        </span>
      </div>
    `,
    className: "vtp-cluster-wrap",
    iconSize: [sizePx, sizePx],
    iconAnchor: [anchor, anchor],
  });
};
