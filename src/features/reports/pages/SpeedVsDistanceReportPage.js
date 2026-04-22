"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaCalendarAlt,
  FaChartBar,
  FaCog,
  FaFilter,
  FaPrint,
  FaQuestionCircle,
  FaSearch,
  FaStar,
  FaSyncAlt,
} from "react-icons/fa";
import AccessGuardState from "@/components/AccessGuardState";
import ReportPageChrome, { useReportPageMobileView } from "@/features/reports/shared/ReportPageChrome";
import { normalizeReportObjectOptions, reconcileSelectedObjects } from "@/lib/reportObjectOptions";
import { useMenuAccess } from "@/lib/useRbacAccess";
import styles from "./TravelSummaryReportPage.module.css";

const STORAGE_KEY = "vtp_speed_vs_distance_saved_filter_v1";
const REPORT_REFERENCE = new Date("2026-04-11T17:17:00");

const DATE_PRESET_OPTIONS = [
  "Today",
  "Yesterday",
  "This Week",
  "Last Week",
  "Last 7 Days",
  "This Month",
  "Last Month",
  "Custom Range",
];

const COMPANY_OPTIONS = ["All", "Valsgroup"];
const BRANCH_OPTIONS = ["All", "Fleet", "Fuel Sensors", "Testing Desk"];
const VEHICLE_GROUP_OPTIONS = ["All", "Fleet", "Long Route", "Testing Desk"];
const VEHICLE_TYPE_OPTIONS = ["All", "Default", "Truck"];
const VEHICLE_BRAND_OPTIONS = ["All", "Acura", "AMW", "General", "Hino"];
const VEHICLE_MODEL_OPTIONS = ["All", "1618 TP", "300", "General", "ILX"];
const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const TIME_PERIOD_OPTIONS = ["AM", "PM"];

const TREE_VEHICLES = [];

const DEFAULT_SPEED_RANGES = [
  { id: "range-1", enabled: true, min: "0", max: "20" },
  { id: "range-2", enabled: true, min: "21", max: "40" },
  { id: "range-3", enabled: true, min: "41", max: "60" },
  { id: "range-4", enabled: true, min: "61", max: "80" },
  { id: "range-5", enabled: true, min: "81", max: "100" },
  { id: "range-6", enabled: true, min: "101", max: "120" },
  { id: "range-7", enabled: true, min: "121", max: "140" },
  { id: "range-8", enabled: true, min: "141", max: "160" },
  { id: "range-9", enabled: true, min: "161", max: "180" },
  { id: "range-10", enabled: true, min: "181", max: "200" },
];

const FIXED_COLUMNS = [
  { key: "branch", label: "Branch", sort: true },
  { key: "object", label: "Object", sort: true },
  { key: "brand", label: "Object Brand" },
  { key: "model", label: "Object Model" },
  { key: "driver", label: "Driver" },
  { key: "distance", label: "Distance" },
];

const RAW_ROWS = [];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date) {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function formatTime(date) {
  const rawHours = date.getHours();
  const suffix = rawHours >= 12 ? "PM" : "AM";
  const hours = rawHours % 12 || 12;
  return `${pad(hours)}:${pad(date.getMinutes())} ${suffix}`;
}

function formatDateTime(date) {
  return `${formatDateOnly(date)} ${formatTime(date)}`;
}

function toDatetimeLocalValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getPresetRange(preset, customStart, customEnd) {
  const end = new Date(REPORT_REFERENCE);
  const startOfToday = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0);

  switch (preset) {
    case "Yesterday": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 1);
      const rangeEnd = new Date(start);
      rangeEnd.setHours(23, 59, 0, 0);
      return { start, end: rangeEnd };
    }
    case "This Week": {
      const start = new Date(startOfToday);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      return { start, end };
    }
    case "Last Week": {
      const currentWeekStart = new Date(startOfToday);
      const day = currentWeekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;
      currentWeekStart.setDate(currentWeekStart.getDate() - diff);
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - 7);
      const rangeEnd = new Date(currentWeekStart);
      rangeEnd.setMinutes(rangeEnd.getMinutes() - 1);
      return { start, end: rangeEnd };
    }
    case "Last 7 Days": {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }
    case "This Month":
      return { start: new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0), end };
    case "Last Month":
      return { start: new Date(end.getFullYear(), end.getMonth() - 1, 1, 0, 0, 0), end: new Date(end.getFullYear(), end.getMonth(), 0, 23, 59, 0) };
    case "Custom Range":
      return { start: customStart ? new Date(customStart) : new Date(startOfToday), end: customEnd ? new Date(customEnd) : new Date(end) };
    case "Today":
    default:
      return { start: startOfToday, end };
  }
}

function parseTimeValue(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: "12", minute: "00", period: "AM" };
  return { hour: String(match[1]).padStart(2, "0"), minute: String(match[2]).padStart(2, "0"), period: String(match[3]).toUpperCase() };
}

function buildTimeValue({ hour, minute, period }) {
  return `${String(hour || "12").padStart(2, "0")}:${String(minute || "00").padStart(2, "0")} ${String(period || "AM").toUpperCase()}`;
}

function formatHeaderLabel(label) {
  if (label.includes(" ")) {
    const parts = label.split(" ");
    const mid = Math.ceil(parts.length / 2);
    return (
      <>
        <span>{parts.slice(0, mid).join(" ")}</span>
        <span>{parts.slice(mid).join(" ")}</span>
      </>
    );
  }
  return <span>{label}</span>;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatNumber(value) {
  return (Number(value) || 0).toFixed(2);
}

function normalizeSpeedRanges(ranges, enabledOnly = false) {
  if (!Array.isArray(ranges)) return [];
  return ranges
    .map((range, index) => ({
      id: range?.id || `range-${index + 1}`,
      enabled: range?.enabled !== false,
      min: String(range?.min ?? "").trim(),
      max: String(range?.max ?? "").trim(),
    }))
    .map((range) => {
      const min = Number(range.min);
      const max = Number(range.max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
      if (enabledOnly && !range.enabled) return null;
      return { ...range, min, max, label: `${min}-${max}` };
    })
    .filter(Boolean);
}

function bucketDistance(segments, range) {
  return segments.reduce((total, segment) => (
    segment.speed >= range.min && segment.speed <= range.max ? total + segment.distance : total
  ), 0);
}

function buildRowMetrics(row, ranges) {
  const distance = row.segments.reduce((total, segment) => total + segment.distance, 0);
  const buckets = ranges.map((range) => bucketDistance(row.segments, range));
  return { ...row, distance, buckets };
}

function buildInitialFilters() {
  const start = new Date(REPORT_REFERENCE);
  start.setHours(0, 0, 0, 0);
  const end = new Date(REPORT_REFERENCE);
  return {
    company: "All",
    dateSelection: "Today",
    customStart: toDatetimeLocalValue(start),
    customEnd: toDatetimeLocalValue(end),
    branch: "All",
    timeRangeEnabled: false,
    startTime: "12:00 AM",
    endTime: "11:59 PM",
    vehicleGroup: "All",
    objectSearch: "",
    selectedObjects: [],
    vehicleType: "All",
    vehicleBrand: "All",
    vehicleModel: "All",
    changeSpeedRange: false,
    speedRanges: DEFAULT_SPEED_RANGES.map((range) => ({ ...range })),
  };
}

export default function SpeedVsDistanceReportPage({ menuKey = "" }) {
  const initialFiltersRef = useRef(buildInitialFilters());
  const companyRef = useRef(null);
  const fleetRef = useRef(null);
  const isMobileView = useReportPageMobileView();
  const [filters, setFilters] = useState(initialFiltersRef.current);
  const [hasApplied, setHasApplied] = useState(false);
  const [appliedRows, setAppliedRows] = useState([]);
  const [appliedRanges, setAppliedRanges] = useState(normalizeSpeedRanges(DEFAULT_SPEED_RANGES, true));
  const [statusText, setStatusText] = useState("");
  const [reportQuickScope, setReportQuickScope] = useState("All");
  const [availableVehicles, setAvailableVehicles] = useState(TREE_VEHICLES);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const { canView } = useMenuAccess(menuKey);

  const loadAvailableVehicles = async (nextStatus = "") => {
    setIsLoadingObjects(true);
    try {
      const response = await fetch("/api/live-view/filters/objects", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || "Unable to load objects."));
      }
      const nextVehicles = normalizeReportObjectOptions(payload);
      if (nextVehicles.length) {
        setAvailableVehicles(nextVehicles);
      }
      if (nextStatus) {
        setStatusText(nextStatus);
      }
    } catch (error) {
      setStatusText(String(error?.message || "Unable to load objects."));
    } finally {
      setIsLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setFilters((current) => ({
        ...current,
        ...parsed,
        selectedObjects: Array.isArray(parsed?.selectedObjects) ? parsed.selectedObjects : current.selectedObjects,
        speedRanges: Array.isArray(parsed?.speedRanges)
          ? parsed.speedRanges.map((range, index) => ({
              id: range?.id || `range-${index + 1}`,
              enabled: range?.enabled !== false,
              min: String(range?.min ?? ""),
              max: String(range?.max ?? ""),
            }))
          : current.speedRanges,
      }));
      setStatusText("Saved filter loaded.");
    } catch {
      // Ignore invalid saved state.
    }
  }, []);

  useEffect(() => {
    void loadAvailableVehicles();
  }, []);

  useEffect(() => {
    setFilters((current) => {
      const nextSelectedObjects = reconcileSelectedObjects(current.selectedObjects, availableVehicles);
      if (
        nextSelectedObjects.length === current.selectedObjects.length &&
        nextSelectedObjects.every((value, index) => value === current.selectedObjects[index])
      ) {
        return current;
      }
      return { ...current, selectedObjects: nextSelectedObjects };
    });
  }, [availableVehicles, filters.selectedObjects]);

  const rangeLabel = useMemo(() => {
    const { start, end } = getPresetRange(filters.dateSelection, filters.customStart, filters.customEnd);
    return `[${formatDateTime(start)} - ${formatDateTime(end)}]`;
  }, [filters.customEnd, filters.customStart, filters.dateSelection]);

  const visibleVehicles = useMemo(() => {
    const query = String(filters.objectSearch || "").trim().toLowerCase();
    if (!query) return availableVehicles;
    return availableVehicles.filter((vehicle) => vehicle.toLowerCase().includes(query));
  }, [availableVehicles, filters.objectSearch]);

  const selectedVehicleCount = filters.selectedObjects.length;
  const allVehiclesSelected = availableVehicles.length > 0 && selectedVehicleCount === availableVehicles.length;
  const someVehiclesSelected = selectedVehicleCount > 0 && !allVehiclesSelected;

  useEffect(() => {
    if (companyRef.current) companyRef.current.indeterminate = someVehiclesSelected;
    if (fleetRef.current) fleetRef.current.indeterminate = someVehiclesSelected;
  }, [someVehiclesSelected]);

  const summaryRow = useMemo(() => {
    if (!appliedRows.length) return null;
    return {
      totalDistance: appliedRows.reduce((total, row) => total + row.distance, 0),
      bucketTotals: appliedRanges.map((_, index) => appliedRows.reduce((total, row) => total + (row.buckets[index] || 0), 0)),
    };
  }, [appliedRanges, appliedRows]);

  const footerRecordText = `${appliedRows.length ? 1 : 0}-${appliedRows.length} (${appliedRows.length})`;

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const updateTimeFieldPart = (fieldName, part, nextValue) => {
    setFilters((current) => {
      const parsed = parseTimeValue(current[fieldName]);
      return { ...current, [fieldName]: buildTimeValue({ ...parsed, [part]: nextValue }) };
    });
  };

  const updateSpeedRange = (index, key, value) => {
    setFilters((current) => ({
      ...current,
      speedRanges: current.speedRanges.map((range, rangeIndex) => (
        rangeIndex === index
          ? { ...range, [key]: key === "enabled" ? Boolean(value) : String(value).replace(/[^\d]/g, "") }
          : range
      )),
    }));
  };

  const toggleWholeTree = (checked) => {
    handleFilterChange("selectedObjects", checked ? [...availableVehicles] : []);
  };

  const handleObjectToggle = (vehicle) => {
    setFilters((current) => {
      const nextSet = new Set(current.selectedObjects);
      if (nextSet.has(vehicle)) nextSet.delete(vehicle);
      else nextSet.add(vehicle);
      return { ...current, selectedObjects: Array.from(nextSet) };
    });
  };

  const applyFilters = (nextStatus = "") => {
    const selectedObjects = filters.selectedObjects.length ? new Set(filters.selectedObjects) : null;
    const nextBaseRows = RAW_ROWS.filter((row) => {
      if (filters.company !== "All" && row.company !== filters.company) return false;
      if (filters.branch !== "All" && row.branch !== filters.branch) return false;
      if (selectedObjects && !selectedObjects.has(row.object)) return false;
      if (filters.vehicleGroup !== "All" && row.group !== filters.vehicleGroup) return false;
      if (filters.vehicleType !== "All" && row.vehicleType !== filters.vehicleType) return false;
      if (filters.vehicleBrand !== "All" && row.brand !== filters.vehicleBrand) return false;
      if (filters.vehicleModel !== "All" && row.model !== filters.vehicleModel) return false;
      return true;
    });

    const nextRanges = filters.changeSpeedRange
      ? normalizeSpeedRanges(filters.speedRanges, true)
      : normalizeSpeedRanges(DEFAULT_SPEED_RANGES, true);
    const nextRows = nextBaseRows.map((row) => buildRowMetrics(row, nextRanges));

    setAppliedRanges(nextRanges);
    setAppliedRows(nextRows);
    setHasApplied(true);
    setStatusText(nextStatus || `${nextRows.length} record(s) loaded.`);
  };

  const handleSaveFilter = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    applyFilters("Filter saved.");
  };

  const handleDeleteFilter = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setFilters(buildInitialFilters());
    setAppliedRows([]);
    setAppliedRanges(normalizeSpeedRanges(DEFAULT_SPEED_RANGES, true));
    setHasApplied(false);
    setStatusText("Saved filter cleared.");
  };

  const triggerUtilityAction = (label) => {
    setStatusText(`${label} action is ready.`);
  };

  const handleExport = (type) => {
    if (!appliedRows.length) {
      setStatusText(`${type} export needs data. Click Apply first.`);
      return;
    }

    const headers = [...FIXED_COLUMNS.map((column) => column.label), ...appliedRanges.map((range) => range.label)];
    const rows = [
      ["TOTAL", "", "", "", "", formatNumber(summaryRow?.totalDistance), ...(summaryRow?.bucketTotals || []).map((value) => formatNumber(value))],
      ...appliedRows.map((row) => [
        row.branch,
        row.object,
        row.brand,
        row.model,
        row.driver,
        formatNumber(row.distance),
        ...row.buckets.map((value) => formatNumber(value)),
      ]),
    ];

    if (type === "CSV") {
      const content = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      downloadFile("speed-vs-distance.csv", content, "text/csv;charset=utf-8");
      setStatusText("CSV export started.");
      return;
    }

    if (type === "XLS") {
      const content = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
      downloadFile("speed-vs-distance.xls", content, "application/vnd.ms-excel");
      setStatusText("XLS export started.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1180,height=820");
    if (!printWindow) {
      setStatusText("PDF export window was blocked.");
      return;
    }

    const bodyRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
    printWindow.document.write(`<html><head><title>Speed vs Distance</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #8f9aa5;padding:4px 6px;text-align:left;vertical-align:top}th{background:#d4d9de}</style></head><body><h1>Speed vs Distance</h1><p>${rangeLabel}</p><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setStatusText("PDF export started.");
  };

  if (menuKey && !canView) {
    return (
      <main className={styles.page}>
        <AccessGuardState title="Speed vs Distance access denied" message={`You do not currently have view access for ${menuKey}.`} />
      </main>
    );
  }

  return (
    <>
      <ReportPageChrome isMobileView={isMobileView} />
      <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
        <section className={styles.headerBar}>
          <div className={styles.headerLeft}>
            <div className={styles.titleRow}>
              <FaStar className={styles.titleIcon} />
              <h1>Speed vs Distance</h1>
            </div>
            {hasApplied ? <div className={styles.rangeText}>{rangeLabel}</div> : null}
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Search")} aria-label="Search"><FaSearch /></button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Favorite")} aria-label="Favorite"><FaStar /></button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Filter")} aria-label="Filter"><FaFilter /></button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Calendar")} aria-label="Calendar"><FaCalendarAlt /></button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Settings")} aria-label="Settings"><FaCog /></button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Chart")} aria-label="Chart"><FaChartBar /></button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Help")} aria-label="Help"><FaQuestionCircle /></button>
          </div>
        </section>

        <section className={`${styles.layout} ${hasApplied ? styles.layoutResult : ""}`}>
          <div className={`${styles.resultsArea} ${hasApplied ? styles.resultsAreaResult : ""}`}>
            {!hasApplied && statusText ? <div className={styles.statusBar}>{statusText}</div> : null}
            <div className={`${styles.tableShell} ${hasApplied ? styles.tableShellResult : ""}`}>
              <div className={styles.tableScroller}>
                <table className={`${styles.summaryTable} ${hasApplied ? styles.summaryTableResult : ""}`}>
                  <thead>
                    {hasApplied && appliedRanges.length ? (
                      <tr>
                        <th colSpan={FIXED_COLUMNS.length} className={styles.speedRangeNoteSpacer} />
                        <th colSpan={appliedRanges.length} className={styles.speedRangeNoteHeader}>Travelled distance in below speed range</th>
                      </tr>
                    ) : null}
                    <tr>
                      {FIXED_COLUMNS.map((column) => (
                        <th key={column.key}>
                          <span className={styles.headerLabel}>{formatHeaderLabel(column.label)}</span>
                          {column.sort ? <span className={styles.sortArrow}>^</span> : null}
                        </th>
                      ))}
                      {hasApplied ? appliedRanges.map((range) => (
                        <th key={range.id} className={styles.numericCell}>
                          <span className={styles.headerLabel}><span>{range.label}</span></span>
                        </th>
                      )) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {hasApplied && appliedRows.length ? (
                      <>
                        {summaryRow ? (
                          <tr className={styles.summaryAggregateRow}>
                            <td><strong>TOTAL</strong></td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td className={styles.numericCell}><strong>{formatNumber(summaryRow.totalDistance)}</strong></td>
                            {summaryRow.bucketTotals.map((value, index) => (
                              <td key={`total-${appliedRanges[index]?.id || index}`} className={styles.numericCell}>
                                <strong>{formatNumber(value)}</strong>
                              </td>
                            ))}
                          </tr>
                        ) : null}
                        {appliedRows.map((row) => (
                          <tr key={row.id} className={row.object === "JV-7938" ? styles.activeMainRow : ""}>
                            <td>{row.branch}</td>
                            <td>{row.object}</td>
                            <td>{row.brand}</td>
                            <td>{row.model}</td>
                            <td>{row.driver}</td>
                            <td className={styles.numericCell}>{formatNumber(row.distance)}</td>
                            {row.buckets.map((value, index) => (
                              <td key={`${row.id}-${appliedRanges[index]?.id || index}`} className={styles.numericCell}>{formatNumber(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ) : (
                      <>
                        <tr>
                          <td colSpan={FIXED_COLUMNS.length} className={styles.noDataRow}>No Records Found</td>
                        </tr>
                        <tr>
                          <td colSpan={FIXED_COLUMNS.length} className={styles.gridFillCell}>
                            <div className={styles.gridFillArea} />
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {hasApplied ? (
              <div className={styles.reportFooter}>
                <div className={styles.reportFooterLeft}>
                  <button type="button" className={styles.reportToolLabelButton} onClick={() => handleExport("XLS")} aria-label="Export XLS">
                    <FaSyncAlt size={12} />
                    <span>XLS</span>
                  </button>
                  <button type="button" className={styles.reportToolLabelButton} onClick={() => handleExport("PDF")} aria-label="Export PDF">
                    <FaPrint size={12} />
                    <span>PDF</span>
                  </button>
                </div>
                <div className={styles.reportFooterCenter}>
                  <input type="text" className={styles.reportSearchInput} />
                  <select className={styles.reportScopeSelect} value={reportQuickScope} onChange={(event) => setReportQuickScope(event.target.value)}>
                    <option value="All">All</option>
                    <option value="Object">Object</option>
                    <option value="Branch">Branch</option>
                  </select>
                  <button type="button" className={styles.reportFooterSearchButton} aria-label="Search results" onClick={() => triggerUtilityAction("Result search")}>
                    <FaSearch size={16} />
                  </button>
                </div>
                <div className={styles.reportFooterRight}>
                  <select className={styles.reportMiniSelect} defaultValue="20">
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <div className={styles.reportPager}>
                    <button type="button" className={styles.reportPagerButton} aria-label="Previous page">{"<"}</button>
                    <span className={styles.reportPagerCurrent}>1</span>
                    <button type="button" className={styles.reportPagerButton} aria-label="Next page">{">"}</button>
                  </div>
                  <div className={styles.reportCount}>{footerRecordText}</div>
                </div>
              </div>
            ) : null}
          </div>
          {!hasApplied ? (
            <aside className={styles.filterPanel}>
              <div className={styles.filterGrid}>
                <div className={styles.filterColumn}>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Company :</label>
                    <select className={styles.filterControl} value={filters.company} onChange={(event) => handleFilterChange("company", event.target.value)}>
                      {COMPANY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Branch :</label>
                    <select className={styles.filterControl} value={filters.branch} onChange={(event) => handleFilterChange("branch", event.target.value)}>
                      {BRANCH_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Group :</label>
                    <select className={styles.filterControl} value={filters.vehicleGroup} onChange={(event) => handleFilterChange("vehicleGroup", event.target.value)}>
                      {VEHICLE_GROUP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Type :</label>
                    <select className={styles.filterControl} value={filters.vehicleType} onChange={(event) => handleFilterChange("vehicleType", event.target.value)}>
                      {VEHICLE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Brand :</label>
                    <select className={styles.filterControl} value={filters.vehicleBrand} onChange={(event) => handleFilterChange("vehicleBrand", event.target.value)}>
                      {VEHICLE_BRAND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Model :</label>
                    <select className={styles.filterControl} value={filters.vehicleModel} onChange={(event) => handleFilterChange("vehicleModel", event.target.value)}>
                      {VEHICLE_MODEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Change Speed Range :</label>
                    <label className={styles.timeRangeRow}>
                      <input type="checkbox" checked={Boolean(filters.changeSpeedRange)} onChange={(event) => handleFilterChange("changeSpeedRange", event.target.checked)} />
                      <span />
                    </label>
                    {filters.changeSpeedRange ? (
                      <div className={styles.speedRangeStack}>
                        {filters.speedRanges.map((range, index) => (
                          <div key={range.id} className={styles.speedRangeRow}>
                            <input type="checkbox" checked={Boolean(range.enabled)} onChange={(event) => updateSpeedRange(index, "enabled", event.target.checked)} />
                            <input type="text" inputMode="numeric" className={styles.speedRangeInput} value={range.min} onChange={(event) => updateSpeedRange(index, "min", event.target.value)} />
                            <span className={styles.speedRangeDash}>-</span>
                            <input type="text" inputMode="numeric" className={styles.speedRangeInput} value={range.max} onChange={(event) => updateSpeedRange(index, "max", event.target.value)} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.filterColumn}>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Date Selection :</label>
                    <div className={styles.dateControlWrap}>
                      <FaCalendarAlt className={styles.dateControlIcon} />
                      <select className={`${styles.filterControl} ${styles.dateControl}`} value={filters.dateSelection} onChange={(event) => handleFilterChange("dateSelection", event.target.value)}>
                        {DATE_PRESET_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    {filters.dateSelection === "Custom Range" ? (
                      <div className={styles.customRangeGrid}>
                        <input type="datetime-local" className={styles.filterControl} value={filters.customStart} onChange={(event) => handleFilterChange("customStart", event.target.value)} />
                        <input type="datetime-local" className={styles.filterControl} value={filters.customEnd} onChange={(event) => handleFilterChange("customEnd", event.target.value)} />
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.timeRangeRow}>
                      <input type="checkbox" checked={Boolean(filters.timeRangeEnabled)} onChange={(event) => handleFilterChange("timeRangeEnabled", event.target.checked)} />
                      <span>Time Range</span>
                    </label>
                    {filters.timeRangeEnabled ? (
                      <div className={styles.timeSelectStack}>
                        {[
                          { key: "startTime", value: filters.startTime, label: "Start Time" },
                          { key: "endTime", value: filters.endTime, label: "End Time" },
                        ].map((item) => {
                          const parsed = parseTimeValue(item.value);
                          return (
                            <div key={item.key} className={styles.timeSelectRow}>
                              <span className={styles.timeSelectLabel}>{item.label}</span>
                              <div className={styles.timeSelectGroup}>
                                <select className={styles.timeSelect} value={parsed.hour} onChange={(event) => updateTimeFieldPart(item.key, "hour", event.target.value)}>
                                  {TIME_HOUR_OPTIONS.map((hour) => <option key={`${item.key}-hour-${hour}`} value={hour}>{hour}</option>)}
                                </select>
                                <select className={styles.timeSelect} value={parsed.minute} onChange={(event) => updateTimeFieldPart(item.key, "minute", event.target.value)}>
                                  {TIME_MINUTE_OPTIONS.map((minute) => <option key={`${item.key}-minute-${minute}`} value={minute}>{minute}</option>)}
                                </select>
                                <select className={styles.timeSelect} value={parsed.period} onChange={(event) => updateTimeFieldPart(item.key, "period", event.target.value)}>
                                  {TIME_PERIOD_OPTIONS.map((period) => <option key={`${item.key}-period-${period}`} value={period}>{period}</option>)}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div className={`${styles.filterBlock} ${styles.objectSelectionBlock}`}>
                    <label className={styles.filterLabel}>Object Selection :</label>
                    <div className={styles.searchRow}>
                      <div className={styles.searchWrap}>
                        <FaSearch className={styles.searchIcon} />
                        <input type="text" value={filters.objectSearch} onChange={(event) => handleFilterChange("objectSearch", event.target.value)} className={styles.searchInput} placeholder="Search" />
                      </div>
                      <button
                        type="button"
                        className={styles.refreshTreeButton}
                        onClick={() => {
                          void loadAvailableVehicles("Object list refreshed.");
                        }}
                        aria-label="Reload objects"
                        disabled={isLoadingObjects}
                      >
                        <FaSyncAlt size={11} />
                      </button>
                    </div>
                    <div className={styles.treeBox}>
                      <label className={`${styles.checkRow} ${styles.treeLevel0}`}>
                        <input type="checkbox" checked={allVehiclesSelected} onChange={(event) => toggleWholeTree(event.target.checked)} />
                        <span>All</span>
                      </label>
                      <label className={`${styles.checkRow} ${styles.treeLevel0}`}>
                        <input ref={companyRef} type="checkbox" checked={allVehiclesSelected} onChange={(event) => toggleWholeTree(event.target.checked)} />
                        <span>{`Valsgroup [ ${availableVehicles.length} ]`}</span>
                        <span className={styles.treeCollapseMark}>-</span>
                      </label>
                      <label className={`${styles.checkRow} ${styles.treeLevel1}`}>
                        <input ref={fleetRef} type="checkbox" checked={allVehiclesSelected} onChange={(event) => toggleWholeTree(event.target.checked)} />
                        <span>Fleet</span>
                      </label>
                      <div className={styles.treeChildren}>
                        {visibleVehicles.map((vehicle) => (
                          <label key={vehicle} className={`${styles.checkRow} ${styles.treeLevel2}`}>
                            <input type="checkbox" checked={filters.selectedObjects.includes(vehicle)} onChange={() => handleObjectToggle(vehicle)} />
                            <span className={styles.treeItemText}>
                              <span>{vehicle}</span>
                              <span>{vehicle}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.filterActions}>
                <div className={styles.buttonGrid}>
                  <button type="button" className={styles.footerButton} onClick={handleSaveFilter}>Save Filter</button>
                  <button type="button" className={styles.footerButton} onClick={handleDeleteFilter}>Delete Filter</button>
                  <button type="button" className={styles.footerButton} onClick={() => applyFilters()}>Apply</button>
                  <button type="button" className={styles.footerButton} onClick={() => handleExport("XLS")}>XLS</button>
                  <button type="button" className={styles.footerButton} onClick={() => handleExport("PDF")}>PDF</button>
                  <button type="button" className={styles.footerButton} onClick={() => handleExport("CSV")}>CSV</button>
                </div>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
    </>
  );
}



