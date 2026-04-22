"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaCalendarAlt,
  FaChartBar,
  FaCog,
  FaFilter,
  FaFlag,
  FaMapMarkerAlt,
  FaMinus,
  FaPlay,
  FaPlus,
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

const STORAGE_KEY = "vtp_stoppage_summary_saved_filter_v1";
const REPORT_REFERENCE = new Date("2026-04-11T01:26:00");

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
const CALCULATION_OPTIONS = ["Ignition", "Trip Count", "Distance"];
const OPERATOR_OPTIONS = ["Greater Than", "Less Than", "Equal To"];
const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const TIME_PERIOD_OPTIONS = ["AM", "PM"];

const TREE_VEHICLES = [];

const MAIN_RESULT_COLUMN_WIDTHS = [
  "2%",
  "6%",
  "9%",
  "6%",
  "6%",
  "10%",
  "12%",
  "4.5%",
  "5%",
  "5%",
  "5%",
  "6%",
  "4%",
  "3%",
  "3%",
  "6%",
  "4%",
  "3.5%",
];

const DETAIL_COLUMN_WIDTHS = [
  "3%",
  "7%",
  "15%",
  "4%",
  "5%",
  "5%",
  "5%",
  "4%",
  "5%",
  "5%",
  "5%",
  "3%",
  "3%",
  "3%",
  "3%",
  "3%",
  "3%",
  "8%",
  "4%",
  "3%",
  "4%",
];

const MOCK_ROWS = [];

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
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function parseDurationToMinutes(value) {
  const parts = String(value || "0:0:0")
    .split(":")
    .map((part) => Number(part) || 0);
  const [hours = 0, minutes = 0, seconds = 0] = parts;
  return hours * 60 + minutes + seconds / 60;
}

function parseDurationToSeconds(value) {
  const parts = String(value || "0:0:0")
    .split(":")
    .map((part) => Number(part) || 0);
  const [hours = 0, minutes = 0, seconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatSecondsAsDuration(totalSeconds) {
  const safeTotal = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safeTotal / 3600);
  const minutes = Math.floor((safeTotal % 3600) / 60);
  const seconds = Math.floor(safeTotal % 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? "");
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
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
      return {
        start: new Date(end.getFullYear(), end.getMonth() - 1, 1, 0, 0, 0),
        end: new Date(end.getFullYear(), end.getMonth(), 0, 23, 59, 0),
      };
    case "Custom Range":
      return {
        start: customStart ? new Date(customStart) : new Date(startOfToday),
        end: customEnd ? new Date(customEnd) : new Date(end),
      };
    case "Today":
    default:
      return { start: startOfToday, end };
  }
}

function compareValue(operator, source, target) {
  if (!Number.isFinite(target)) return true;
  if (operator === "Less Than") return source < target;
  if (operator === "Equal To") return source === target;
  return source > target;
}

function parseTimeValue(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return { hour: "12", minute: "00", period: "AM" };
  }

  return {
    hour: String(match[1]).padStart(2, "0"),
    minute: String(match[2]).padStart(2, "0"),
    period: String(match[3]).toUpperCase(),
  };
}

function buildTimeValue({ hour, minute, period }) {
  return `${String(hour || "12").padStart(2, "0")}:${String(minute || "00").padStart(2, "0")} ${String(period || "AM").toUpperCase()}`;
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
    timeRangeEnabled: true,
    startTime: "12:00 AM",
    endTime: "11:59 PM",
    branches: ["All"],
    objectSearch: "",
    selectedObjects: [],
    vehicleGroup: "All",
    vehicleType: "All",
    vehicleBrand: "All",
    vehicleModel: "All",
    calculationFor: "Ignition",
    durationOperator: "Greater Than",
    durationValue: "",
  };
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

function renderRunningStopBar(ratio) {
  return (
    <span className={styles.progressBar} aria-hidden="true">
      <span className={styles.progressRun} style={{ width: `${ratio}%` }} />
      <span className={styles.progressStop} style={{ width: `${100 - ratio}%` }} />
    </span>
  );
}

function Metric({ tone = "default", children, bold = false }) {
  return (
    <span className={`${styles.metric} ${styles[`metric${tone}`]} ${bold ? styles.metricBold : ""}`}>{children}</span>
  );
}

function StopMarker({ marker }) {
  if (marker === "start") {
    return (
      <span className={styles.stopMarkerStart}>
        <FaFlag size={10} />
      </span>
    );
  }
  return <span className={styles.stopMarkerIndex}>{marker}</span>;
}

export default function StoppageSummaryReportPage({ menuKey = "" }) {
  const initialFiltersRef = useRef(buildInitialFilters());
  const companyRef = useRef(null);
  const fleetRef = useRef(null);
  const branchMenuRef = useRef(null);
  const timeRangeRef = useRef(null);
  const isMobileView = useReportPageMobileView();
  const [filters, setFilters] = useState(initialFiltersRef.current);
  const [hasApplied, setHasApplied] = useState(false);
  const [appliedRows, setAppliedRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState("");
  const [statusText, setStatusText] = useState("");
  const [reportQuickScope, setReportQuickScope] = useState("All");
  const [availableVehicles, setAvailableVehicles] = useState(TREE_VEHICLES);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const { ready, canView } = useMenuAccess(menuKey);

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
        branches: Array.isArray(parsed?.branches) && parsed.branches.length ? parsed.branches : current.branches,
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
    const query = String(filters.objectSearch || "")
      .trim()
      .toLowerCase();
    if (!query) return availableVehicles;
    return availableVehicles.filter((vehicle) => vehicle.toLowerCase().includes(query));
  }, [availableVehicles, filters.objectSearch]);

  const selectedVehicleCount = filters.selectedObjects.length;
  const allVehiclesSelected = availableVehicles.length > 0 && selectedVehicleCount === availableVehicles.length;
  const someVehiclesSelected = selectedVehicleCount > 0 && !allVehiclesSelected;
  const activeTimeValue = activeTimeField ? parseTimeValue(filters[activeTimeField]) : null;

  const summaryRow = useMemo(() => {
    if (!appliedRows.length) return null;

    const totals = appliedRows.reduce(
      (accumulator, row) => {
        accumulator.distance += Number(row.distance) || 0;
        accumulator.running += parseDurationToSeconds(row.running);
        accumulator.idle += parseDurationToSeconds(row.idle);
        accumulator.stop += parseDurationToSeconds(row.stop);
        accumulator.maxStoppage = Math.max(accumulator.maxStoppage, parseDurationToSeconds(row.maxStoppage));
        accumulator.noOfStop += Number(row.noOfStop) || 0;
        accumulator.speedAvg += Number(row.speedAvg) || 0;
        accumulator.speedMax = Math.max(accumulator.speedMax, Number(row.speedMax) || 0);
        accumulator.overstay += Number(row.overstay) || 0;
        accumulator.alerts += Number(row.alerts) || 0;
        return accumulator;
      },
      {
        distance: 0,
        running: 0,
        idle: 0,
        stop: 0,
        maxStoppage: 0,
        noOfStop: 0,
        speedAvg: 0,
        speedMax: 0,
        overstay: 0,
        alerts: 0,
      }
    );

    return {
      distance: formatNumber(totals.distance),
      running: formatSecondsAsDuration(totals.running),
      idle: formatSecondsAsDuration(totals.idle),
      stop: formatSecondsAsDuration(totals.stop),
      maxStoppage: formatSecondsAsDuration(totals.maxStoppage),
      noOfStop: totals.noOfStop,
      speedAvg: formatNumber(totals.speedAvg / appliedRows.length),
      speedMax: formatNumber(totals.speedMax),
      overstay: totals.overstay,
      alerts: totals.alerts,
    };
  }, [appliedRows]);

  useEffect(() => {
    if (companyRef.current) companyRef.current.indeterminate = someVehiclesSelected;
    if (fleetRef.current) fleetRef.current.indeterminate = someVehiclesSelected;
  }, [someVehiclesSelected]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePointerDown = (event) => {
      if (!branchMenuRef.current?.contains(event.target)) {
        setBranchMenuOpen(false);
      }
      if (!timeRangeRef.current?.contains(event.target)) {
        setActiveTimeField("");
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!filters.timeRangeEnabled) {
      setActiveTimeField("");
    }
  }, [filters.timeRangeEnabled]);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleBranchToggle = (branch) => {
    setFilters((current) => {
      if (branch === "All") {
        return { ...current, branches: ["All"] };
      }
      const withoutAll = current.branches.filter((item) => item !== "All");
      const exists = withoutAll.includes(branch);
      const nextBranches = exists ? withoutAll.filter((item) => item !== branch) : [...withoutAll, branch];
      return { ...current, branches: nextBranches.length ? nextBranches : ["All"] };
    });
  };

  const updateTimeFieldPart = (fieldName, part, nextValue) => {
    setFilters((current) => {
      const parsed = parseTimeValue(current[fieldName]);
      const nextParsed = { ...parsed, [part]: nextValue };
      return { ...current, [fieldName]: buildTimeValue(nextParsed) };
    });
  };

  const handleObjectToggle = (vehicle) => {
    setFilters((current) => {
      const exists = current.selectedObjects.includes(vehicle);
      const nextSelectedObjects = exists
        ? current.selectedObjects.filter((item) => item !== vehicle)
        : [...current.selectedObjects, vehicle];
      return { ...current, selectedObjects: nextSelectedObjects };
    });
  };

  const toggleWholeTree = (checked) => {
    setFilters((current) => ({
      ...current,
      selectedObjects: checked ? [...availableVehicles] : [],
    }));
  };

  const applyFilters = (nextStatus = "") => {
    const durationTarget = Number(filters.durationValue);
    const selectedBranches =
      filters.branches.includes("All") || !filters.branches.length ? null : new Set(filters.branches);
    const selectedObjects =
      filters.selectedObjects.length === availableVehicles.length ? null : new Set(filters.selectedObjects);

    const nextRows = MOCK_ROWS.filter((row) => {
      if (filters.company !== "All" && row.company !== filters.company) return false;
      if (selectedBranches && !selectedBranches.has(row.branch)) return false;
      if (selectedObjects && !selectedObjects.has(row.object)) return false;
      if (filters.vehicleGroup !== "All" && row.group !== filters.vehicleGroup) return false;
      if (filters.vehicleType !== "All" && row.vehicleType !== filters.vehicleType) return false;
      if (filters.vehicleBrand !== "All" && row.brand !== filters.vehicleBrand) return false;
      if (filters.vehicleModel !== "All" && row.model !== filters.vehicleModel) return false;
      if (filters.calculationFor !== "Ignition" && row.calculationFor !== filters.calculationFor) return false;
      if (!compareValue(filters.durationOperator, parseDurationToMinutes(row.stop), durationTarget)) return false;
      return true;
    });

    setAppliedRows(nextRows);
    setExpandedRows([]);
    setHasApplied(true);
    setStatusText(nextStatus || `${nextRows.length} record(s) loaded.`);
  };

  const handleSaveFilter = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    applyFilters("Filter saved.");
  };

  const handleDeleteFilter = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setFilters(buildInitialFilters());
    setAppliedRows([]);
    setExpandedRows([]);
    setHasApplied(false);
    setStatusText("Saved filter cleared.");
  };

  const toggleExpand = (rowId) => {
    setExpandedRows((current) => (current.includes(rowId) ? current.filter((item) => item !== rowId) : [...current, rowId]));
  };

  const triggerUtilityAction = (label) => {
    setStatusText(`${label} action is ready.`);
  };

  const handleExport = (type) => {
    if (!appliedRows.length) {
      setStatusText(`${type} export needs data. Click Apply first.`);
      return;
    }

    const headers = [
      "Branch",
      "Object",
      "Object Brand",
      "Object Model",
      "Driver",
      "IMEI No",
      "Distance",
      "Running",
      "Idle",
      "Stop",
      "Max Stoppage",
      "No of Stop",
      "Speed AVG",
      "Speed MAX",
      "Overstay",
      "Alert(s)",
    ];
    const rows = appliedRows.map((row) => [
      row.branch,
      row.object,
      row.brand,
      row.model,
      row.driver,
      row.imei,
      row.distance,
      row.running,
      row.idle,
      row.stop,
      row.maxStoppage,
      row.noOfStop,
      row.speedAvg,
      row.speedMax,
      row.overstay,
      row.alerts,
    ]);

    if (type === "CSV") {
      const content = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      downloadFile("stoppage-summary.csv", content, "text/csv;charset=utf-8");
      setStatusText("CSV export started.");
      return;
    }

    if (type === "XLS") {
      const content = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
      downloadFile("stoppage-summary.xls", content, "application/vnd.ms-excel");
      setStatusText("XLS export started.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=820");
    if (!printWindow) {
      setStatusText("PDF export window was blocked.");
      return;
    }

    const bodyRows = appliedRows
      .map(
        (row) => `
          <tr>
            <td>${row.branch}</td>
            <td>${row.object}</td>
            <td>${row.brand}</td>
            <td>${row.model}</td>
            <td>${row.driver}</td>
            <td>${row.imei}</td>
            <td>${row.distance}</td>
            <td>${row.running}</td>
            <td>${row.idle}</td>
            <td>${row.stop}</td>
            <td>${row.maxStoppage}</td>
            <td>${row.noOfStop}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Stoppage Summary</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 18px; }
            p { margin: 0 0 14px; color: #555; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #8f9aa5; padding: 4px 6px; text-align: left; vertical-align: top; }
            th { background: #d4d9de; }
          </style>
        </head>
        <body>
          <h1>Stoppage Summary</h1>
          <p>${rangeLabel}</p>
          <table>
            <thead>
              <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setStatusText("PDF export opened.");
  };

  const footerRecordText = useMemo(() => {
    if (!appliedRows.length) return "0-0 (0)";
    return `1-${Math.min(20, appliedRows.length)} (${appliedRows.length})`;
  }, [appliedRows.length]);

  if (!ready && menuKey) {
    return (
      <main className={styles.page}>
        <AccessGuardState
          mode="loading"
          title="Stoppage Summary access is loading"
          message="Checking your menu rights before opening this module."
        />
      </main>
    );
  }

  if (menuKey && !canView) {
    return (
      <main className={styles.page}>
        <AccessGuardState title="Stoppage Summary access denied" message={`You do not currently have view access for ${menuKey}.`} />
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
              <h1>Stoppage Summary</h1>
            </div>
            <div className={styles.rangeText}>{rangeLabel}</div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Search")} aria-label="Search">
              <FaSearch />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Favorite")} aria-label="Favorite">
              <FaStar />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Filter")} aria-label="Filter">
              <FaFilter />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Calendar")} aria-label="Calendar">
              <FaCalendarAlt />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Settings")} aria-label="Settings">
              <FaCog />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Chart")} aria-label="Chart">
              <FaChartBar />
            </button>
            <button type="button" className={styles.iconButton} onClick={() => triggerUtilityAction("Help")} aria-label="Help">
              <FaQuestionCircle />
            </button>
          </div>
        </section>

        <section className={`${styles.layout} ${hasApplied ? styles.layoutResult : ""}`}>
          <div className={`${styles.resultsArea} ${hasApplied ? styles.resultsAreaResult : ""}`}>
            {!hasApplied && statusText ? <div className={styles.statusBar}>{statusText}</div> : null}
            <div className={`${styles.tableShell} ${hasApplied ? styles.tableShellResult : ""}`}>
              <div className={styles.tableScroller}>
                <table className={`${styles.summaryTable} ${hasApplied ? styles.summaryTableResult : ""}`}>
                  {hasApplied ? (
                    <colgroup>
                      {MAIN_RESULT_COLUMN_WIDTHS.map((width, index) => (
                        <col key={`stoppage-main-col-${index}`} style={{ width }} />
                      ))}
                    </colgroup>
                  ) : null}
                  <thead>
                    <tr>
                      <th className={styles.expandCol} />
                      <th><span className={styles.headerLabel}><span>Branch</span></span></th>
                      <th><span className={styles.headerLabel}><span>Object</span></span></th>
                      <th><span className={styles.headerLabel}><span>Object Brand</span></span></th>
                      <th><span className={styles.headerLabel}><span>Object Model</span></span></th>
                      <th><span className={styles.headerLabel}><span>Driver</span></span></th>
                      <th><span className={styles.headerLabel}><span>IMEI No</span></span></th>
                      <th><span className={styles.headerLabel}><span>Distance</span></span></th>
                      <th><span className={styles.headerLabel}><span>Running</span><span>(HH:MM:SS)</span></span></th>
                      <th><span className={styles.headerLabel}><span>Idle</span><span>(HH:MM:SS)</span></span></th>
                      <th><span className={styles.headerLabel}><span>Stop</span><span>(HH:MM:SS)</span></span></th>
                      <th><span className={styles.headerLabel}><span>Max Stoppage</span><span>(HH:MM:SS)</span></span></th>
                      <th><span className={styles.headerLabel}><span>No of Stop</span></span></th>
                      <th><span className={styles.headerLabel}><span>Speed AVG</span></span></th>
                      <th><span className={styles.headerLabel}><span>Speed MAX</span></span></th>
                      <th><span className={styles.headerLabel}><span>Overstay</span></span></th>
                      <th><span className={styles.headerLabel}><span>Alert(s)</span></span></th>
                      <th><span className={styles.headerLabel}><span>Playback</span></span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasApplied && appliedRows.length ? (
                      <>
                        {summaryRow ? (
                          <tr className={styles.summaryAggregateRow}>
                            <td className={styles.expandCell} />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td className={styles.numericCell}><Metric bold>{summaryRow.distance}</Metric></td>
                            <td className={styles.numericCell}><Metric tone="green" bold>{summaryRow.running}</Metric></td>
                            <td className={styles.numericCell}><Metric tone="orange" bold>{summaryRow.idle}</Metric></td>
                            <td className={styles.numericCell}><Metric tone="red" bold>{summaryRow.stop}</Metric></td>
                            <td className={styles.numericCell}><Metric bold>{summaryRow.maxStoppage}</Metric></td>
                            <td className={styles.numericCell}><Metric bold>{summaryRow.noOfStop}</Metric></td>
                            <td className={styles.numericCell}><Metric tone="blue" bold>{summaryRow.speedAvg}</Metric></td>
                            <td className={styles.numericCell}><Metric tone="red" bold>{summaryRow.speedMax}</Metric></td>
                            <td className={styles.numericCell}><Metric bold>{summaryRow.overstay}</Metric></td>
                            <td className={styles.numericCell}><Metric tone="red" bold>{summaryRow.alerts}</Metric></td>
                            <td className={styles.iconCell}>--</td>
                          </tr>
                        ) : null}
                        {appliedRows.map((row) => {
                          const expanded = expandedRows.includes(row.id);
                          return (
                            <React.Fragment key={row.id}>
                              <tr className={expanded ? styles.activeMainRow : ""}>
                                <td className={styles.expandCell}>
                                  <button type="button" className={styles.expandButton} onClick={() => toggleExpand(row.id)}>
                                    {expanded ? <FaMinus size={9} /> : <FaPlus size={9} />}
                                  </button>
                                </td>
                                <td>{row.branch}</td>
                                <td><Metric bold>{row.object}</Metric></td>
                                <td>{row.brand}</td>
                                <td>{row.model}</td>
                                <td>{row.driver}</td>
                                <td className={styles.numericCell}>{row.imei}</td>
                                <td className={styles.numericCell}><Metric tone="green" bold>{formatNumber(row.distance)}</Metric></td>
                                <td className={styles.numericCell}><Metric tone="green">{row.running}</Metric></td>
                                <td className={styles.numericCell}><Metric tone="orange">{row.idle}</Metric></td>
                                <td className={styles.numericCell}><Metric tone="red">{row.stop}</Metric></td>
                                <td className={styles.numericCell}><Metric bold>{row.maxStoppage}</Metric></td>
                                <td className={styles.numericCell}><Metric bold>{row.noOfStop}</Metric></td>
                                <td className={styles.numericCell}><Metric tone="blue" bold>{row.speedAvg}</Metric></td>
                                <td className={styles.numericCell}><Metric tone="red" bold>{row.speedMax}</Metric></td>
                                <td className={styles.numericCell}><Metric bold>{row.overstay}</Metric></td>
                                <td className={styles.numericCell}><Metric tone="red" bold>{row.alerts}</Metric></td>
                                <td className={styles.iconCell}>
                                  <button
                                    type="button"
                                    className={styles.playbackButton}
                                    aria-label={`Playback ${row.object}`}
                                    onClick={() => setStatusText(`Playback opened for ${row.object}.`)}
                                  >
                                    <FaPlay size={8} />
                                  </button>
                                </td>
                              </tr>
                              {expanded ? (
                                <tr className={styles.detailOuterRow}>
                                  <td colSpan={18} className={styles.detailCell}>
                                    <div className={styles.detailWrap}>
                                      <table className={styles.detailTable}>
                                        <colgroup>
                                          {DETAIL_COLUMN_WIDTHS.map((width, index) => (
                                            <col key={`${row.id}-stop-detail-col-${index}`} style={{ width }} />
                                          ))}
                                        </colgroup>
                                        <thead>
                                          <tr>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Stop No</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Arrival</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Location</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Last Distance</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Last Running</span><span>(HH:MM:SS)</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Last Idle</span><span>(HH:MM:SS)</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Last Stop</span><span>(HH:MM:SS)</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Distance</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Running</span><span>(HH:MM:SS)</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Idle</span><span>(HH:MM:SS)</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Stop</span><span>(HH:MM:SS)</span></span></th>
                                            <th colSpan={2} className={styles.groupHeader}><span className={styles.headerLabel}><span>Speed</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Fuel</span></span></th>
                                            <th colSpan={3} className={styles.groupHeader}><span className={styles.headerLabel}><span>Temperature</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Departure</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Overstay</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Alert(s)</span></span></th>
                                            <th rowSpan={2}><span className={styles.headerLabel}><span>Map</span></span></th>
                                          </tr>
                                          <tr>
                                            <th className={styles.subHeader}><span className={styles.headerLabel}><span>AVG</span></span></th>
                                            <th className={styles.subHeader}><span className={styles.headerLabel}><span>MAX</span></span></th>
                                            <th className={styles.subHeader}><span className={styles.headerLabel}><span>Min</span></span></th>
                                            <th className={styles.subHeader}><span className={styles.headerLabel}><span>Max</span></span></th>
                                            <th className={styles.subHeader}><span className={styles.headerLabel}><span>AVG</span></span></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {row.detailStops.map((stop) => (
                                            <tr key={`${row.id}-${stop.stopNo}`}>
                                              <td className={styles.stopMarkerCell}><StopMarker marker={stop.marker} /></td>
                                              <td>{stop.arrival}</td>
                                              <td>{stop.location}</td>
                                              <td className={styles.numericCell}>{stop.lastDistance}</td>
                                              <td className={styles.numericCell}>{stop.lastRunning}</td>
                                              <td className={styles.numericCell}>{stop.lastIdle}</td>
                                              <td className={styles.numericCell}>{stop.lastStop}</td>
                                              <td className={styles.numericCell}>{stop.distance}</td>
                                              <td className={styles.numericCell}>{stop.running}</td>
                                              <td className={styles.numericCell}>{stop.idle}</td>
                                              <td className={styles.numericCell}>{stop.stop}</td>
                                              <td className={styles.numericCell}>{stop.speedAvg}</td>
                                              <td className={styles.numericCell}>{stop.speedMax}</td>
                                              <td className={styles.numericCell}>{stop.fuel}</td>
                                              <td className={styles.numericCell}>{stop.temperatureMin}</td>
                                              <td className={styles.numericCell}>{stop.temperatureMax}</td>
                                              <td className={styles.numericCell}>{stop.temperatureAvg}</td>
                                              <td>{stop.departure}</td>
                                              <td className={styles.numericCell}><Metric tone="red" bold>{stop.overstay}</Metric></td>
                                              <td className={styles.numericCell}>{stop.alerts}</td>
                                              <td className={styles.iconCell}>
                                                <button
                                                  type="button"
                                                  className={styles.mapPinButton}
                                                  onClick={() => setStatusText(`Map opened for ${row.object} stop ${stop.stopNo}.`)}
                                                  aria-label={`Map ${stop.stopNo}`}
                                                >
                                                  <FaMapMarkerAlt size={13} />
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        <tr>
                          <td colSpan={18} className={styles.noDataRow}>
                            No Records Found
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={18} className={styles.gridFillCell}>
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
                  <button
                    type="button"
                    className={styles.reportToolButton}
                    onClick={() => applyFilters("Stoppage Summary refreshed.")}
                    aria-label="Refresh result"
                  >
                    <FaSyncAlt size={14} />
                  </button>
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
                  <select
                    className={styles.reportScopeSelect}
                    value={reportQuickScope}
                    onChange={(event) => setReportQuickScope(event.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Object">Object</option>
                    <option value="Branch">Branch</option>
                  </select>
                  <button
                    type="button"
                    className={styles.reportFooterSearchButton}
                    aria-label="Search results"
                    onClick={() => triggerUtilityAction("Result search")}
                  >
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
                    <button type="button" className={styles.reportPagerButton} aria-label="Previous page">
                      {"<"}
                    </button>
                    <span className={styles.reportPagerCurrent}>1</span>
                    <button type="button" className={styles.reportPagerButton} aria-label="Next page">
                      {">"}
                    </button>
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
                      {COMPANY_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Branch :</label>
                    <div className={styles.branchMenuWrap} ref={branchMenuRef}>
                      <button
                        type="button"
                        className={styles.filterSelectButton}
                        onClick={() => setBranchMenuOpen((current) => !current)}
                        aria-expanded={branchMenuOpen}
                      >
                        <span className={styles.filterSelectValue}>
                          {filters.branches.includes("All") ? "All" : filters.branches.join(", ")}
                        </span>
                        <span className={styles.filterSelectArrow}>v</span>
                      </button>
                      {branchMenuOpen ? (
                        <div className={styles.branchCheckList}>
                          {BRANCH_OPTIONS.map((option) => (
                            <label key={option} className={styles.checkRow}>
                              <input type="checkbox" checked={filters.branches.includes(option)} onChange={() => handleBranchToggle(option)} />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Group :</label>
                    <select className={styles.filterControl} value={filters.vehicleGroup} onChange={(event) => handleFilterChange("vehicleGroup", event.target.value)}>
                      {VEHICLE_GROUP_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Type :</label>
                    <select className={styles.filterControl} value={filters.vehicleType} onChange={(event) => handleFilterChange("vehicleType", event.target.value)}>
                      {VEHICLE_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Brand :</label>
                    <select className={styles.filterControl} value={filters.vehicleBrand} onChange={(event) => handleFilterChange("vehicleBrand", event.target.value)}>
                      {VEHICLE_BRAND_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Model :</label>
                    <select className={styles.filterControl} value={filters.vehicleModel} onChange={(event) => handleFilterChange("vehicleModel", event.target.value)}>
                      {VEHICLE_MODEL_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Calculation for :</label>
                    <select className={styles.filterControl} value={filters.calculationFor} onChange={(event) => handleFilterChange("calculationFor", event.target.value)}>
                      {CALCULATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Duration :</label>
                    <select className={styles.filterControl} value={filters.durationOperator} onChange={(event) => handleFilterChange("durationOperator", event.target.value)}>
                      {OPERATOR_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.filterControl}
                      value={filters.durationValue}
                      onChange={(event) => handleFilterChange("durationValue", event.target.value)}
                      placeholder="Duration Value In Minutes"
                    />
                  </div>
                </div>
                <div className={styles.filterColumn}>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Date Selection :</label>
                    <select
                      className={styles.filterControl}
                      value={filters.dateSelection}
                      onChange={(event) => handleFilterChange("dateSelection", event.target.value)}
                    >
                      {DATE_PRESET_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    {filters.dateSelection === "Custom Range" ? (
                      <div className={styles.customRangeGrid}>
                        <input
                          type="datetime-local"
                          className={styles.filterControl}
                          value={filters.customStart}
                          onChange={(event) => handleFilterChange("customStart", event.target.value)}
                        />
                        <input
                          type="datetime-local"
                          className={styles.filterControl}
                          value={filters.customEnd}
                          onChange={(event) => handleFilterChange("customEnd", event.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.filterBlock}>
                    <label className={styles.timeRangeRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(filters.timeRangeEnabled)}
                        onChange={(event) => handleFilterChange("timeRangeEnabled", event.target.checked)}
                      />
                      <span>Time Range</span>
                    </label>
                    {filters.timeRangeEnabled ? (
                      <div className={styles.timeRangeInputs} ref={timeRangeRef}>
                        {[
                          { key: "startTime", value: filters.startTime, label: "Start time" },
                          { key: "endTime", value: filters.endTime, label: "End time" },
                        ].map((item) => (
                          <div key={item.key} className={styles.timeFieldWrap}>
                            <button
                              type="button"
                              className={styles.timeFieldButton}
                              aria-label={item.label}
                              onClick={() => setActiveTimeField((current) => (current === item.key ? "" : item.key))}
                            >
                              <span>{item.value}</span>
                            </button>
                            {activeTimeField === item.key && activeTimeValue ? (
                              <div className={styles.timePickerPanel}>
                                <div className={styles.timePickerColumn}>
                                  {TIME_HOUR_OPTIONS.map((hour) => (
                                    <button
                                      key={`${item.key}-hour-${hour}`}
                                      type="button"
                                      className={`${styles.timePickerOption} ${activeTimeValue.hour === hour ? styles.timePickerOptionActive : ""}`}
                                      onClick={() => updateTimeFieldPart(item.key, "hour", hour)}
                                    >
                                      {hour}
                                    </button>
                                  ))}
                                </div>
                                <div className={styles.timePickerColumn}>
                                  {TIME_MINUTE_OPTIONS.map((minute) => (
                                    <button
                                      key={`${item.key}-minute-${minute}`}
                                      type="button"
                                      className={`${styles.timePickerOption} ${activeTimeValue.minute === minute ? styles.timePickerOptionActive : ""}`}
                                      onClick={() => updateTimeFieldPart(item.key, "minute", minute)}
                                    >
                                      {minute}
                                    </button>
                                  ))}
                                </div>
                                <div className={styles.timePickerColumn}>
                                  {TIME_PERIOD_OPTIONS.map((period) => (
                                    <button
                                      key={`${item.key}-period-${period}`}
                                      type="button"
                                      className={`${styles.timePickerOption} ${activeTimeValue.period === period ? styles.timePickerOptionActive : ""}`}
                                      onClick={() => updateTimeFieldPart(item.key, "period", period)}
                                    >
                                      {period}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className={`${styles.filterBlock} ${styles.objectSelectionBlock}`}>
                    <label className={styles.filterLabel}>Object Selection :</label>
                    <div className={styles.searchRow}>
                      <div className={styles.searchWrap}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                          type="text"
                          value={filters.objectSearch}
                          onChange={(event) => handleFilterChange("objectSearch", event.target.value)}
                          className={styles.searchInput}
                          placeholder="Search"
                        />
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
                        <input
                          ref={companyRef}
                          type="checkbox"
                          checked={allVehiclesSelected}
                          onChange={(event) => toggleWholeTree(event.target.checked)}
                        />
                        <span>{`Valsgroup [ ${availableVehicles.length} ]`}</span>
                        <span className={styles.treeCollapseMark}>-</span>
                      </label>
                      <label className={`${styles.checkRow} ${styles.treeLevel1}`}>
                        <input
                          ref={fleetRef}
                          type="checkbox"
                          checked={allVehiclesSelected}
                          onChange={(event) => toggleWholeTree(event.target.checked)}
                        />
                        <span>Fleet</span>
                      </label>
                      <div className={styles.treeChildren}>
                        {visibleVehicles.map((vehicle) => (
                          <label key={vehicle} className={`${styles.checkRow} ${styles.treeLevel2}`}>
                            <input
                              type="checkbox"
                              checked={filters.selectedObjects.includes(vehicle)}
                              onChange={() => handleObjectToggle(vehicle)}
                            />
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



