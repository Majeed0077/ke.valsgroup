"use client";

import Image from "next/image";
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
import { useMenuAccess } from "@/lib/useRbacAccess";
import styles from "./TravelSummaryReportPage.module.css";
import keLogo from "../../../../public/icons/KE.webp";

const REPORT_REFERENCE_MONTH = "2026-04";
const DAY_COLUMNS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
const OPERATOR_OPTIONS = ["Greater Than", "Less Than", "Equal To"];
const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const TIME_PERIOD_OPTIONS = ["AM", "PM"];

const DAYWISE_SOURCE_ROWS = [
  {
    company: "Valsgroup",
    branch: "FCL",
    object: "AAAR-477",
    group: "Fleet",
    vehicleType: "Truck",
    brand: "AMW",
    model: "1618 TP",
    dayValues: {
      "01": 0,
      "02": 0,
      "03": 0,
      "04": 0,
      "05": 0,
      "06": 0,
      "07": 0,
      "08": 30.16,
      "09": 542.65,
      "10": 580.29,
      "11": 230.63,
      "12": 855.97,
      "13": 207.15,
      "14": 261.14,
      "15": 619.53,
      "16": 257.59,
      "17": 0.16,
      "18": 0.23,
      "19": 0.35,
      "20": 20.97,
      "21": 534.85,
      "22": 429.17,
      "23": 0,
      "24": 0,
      "25": 0,
      "26": 0,
      "27": 0,
      "28": 0,
      "29": 0,
      "30": 0,
      "31": 0,
    },
  },
  {
    company: "Valsgroup",
    branch: "FCL",
    object: "AAAR-548",
    group: "Fleet",
    vehicleType: "Truck",
    brand: "AMW",
    model: "1618 TP",
    dayValues: {
      "01": 118.2,
      "02": 142.5,
      "03": 133.8,
      "04": 0,
      "05": 91.44,
      "06": 104.21,
      "07": 96.1,
      "08": 88.35,
      "09": 166.73,
      "10": 172.89,
      "11": 184.53,
      "12": 190.44,
      "13": 0,
      "14": 126.66,
      "15": 140.82,
      "16": 152.7,
      "17": 149.93,
      "18": 137.12,
      "19": 128.55,
      "20": 133.4,
      "21": 144.91,
      "22": 160.18,
      "23": 0,
      "24": 111.42,
      "25": 108.3,
      "26": 119.74,
      "27": 131.2,
      "28": 139.85,
      "29": 0,
      "30": 122.67,
      "31": 118.96,
    },
  },
  {
    company: "Valsgroup",
    branch: "Fuel Sensors",
    object: "JV-0427",
    group: "Sensors",
    vehicleType: "Pickup",
    brand: "Toyota",
    model: "Hilux",
    dayValues: {
      "01": 42.11,
      "02": 39.7,
      "03": 44.2,
      "04": 51.32,
      "05": 0,
      "06": 66.15,
      "07": 72.4,
      "08": 68.21,
      "09": 70.18,
      "10": 74.83,
      "11": 69.12,
      "12": 0,
      "13": 64.51,
      "14": 77.03,
      "15": 82.6,
      "16": 79.41,
      "17": 75.14,
      "18": 71.08,
      "19": 0,
      "20": 58.64,
      "21": 61.77,
      "22": 63.12,
      "23": 59.48,
      "24": 0,
      "25": 54.07,
      "26": 52.33,
      "27": 57.9,
      "28": 60.21,
      "29": 62.45,
      "30": 65.19,
      "31": 0,
    },
  },
];

const MAIN_COLUMN_WIDTHS = ["5.5%", "8%", "8%", "8%", "7.5%", ...DAY_COLUMNS.map(() => "2.55%")];

function pad(value) {
  return String(value).padStart(2, "0");
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

function compareValue(operator, source, target) {
  if (!Number.isFinite(target)) return true;
  if (operator === "Less Than") return source < target;
  if (operator === "Equal To") return source === target;
  return source > target;
}

function getMonthLabel(monthValue) {
  const [year, month] = String(monthValue || REPORT_REFERENCE_MONTH)
    .split("-")
    .map((value) => Number(value) || 0);
  const monthDate = new Date(year || 2026, Math.max(0, (month || 1) - 1), 1);
  return monthDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDistance(value, roundOff = false) {
  const numeric = Number(value) || 0;
  if (roundOff) {
    return Math.round(numeric).toLocaleString("en-US");
  }
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildPreparedRows() {
  return DAYWISE_SOURCE_ROWS.map((row) => {
    const totalDistance = DAY_COLUMNS.reduce((sum, day) => sum + (Number(row.dayValues?.[day]) || 0), 0);
    return {
      ...row,
      totalDistance,
      peakDistance: Math.max(...DAY_COLUMNS.map((day) => Number(row.dayValues?.[day]) || 0), 0),
    };
  });
}

function buildInitialFilters(rows) {
  return {
    company: "All",
    month: REPORT_REFERENCE_MONTH,
    includeDays: true,
    timeRangeEnabled: false,
    startTime: "12:00 AM",
    endTime: "11:59 PM",
    branch: "All",
    objectSearch: "",
    selectedObjects: rows.map((row) => row.object),
    vehicleGroup: "All",
    vehicleType: "All",
    vehicleBrand: "All",
    vehicleModel: "All",
    distanceOperator: "Greater Than",
    distanceValue: "",
    roundOff: false,
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

export default function DaywiseDistanceReportPage({
  menuKey = "",
  accessMenuKey = menuKey,
  mode = "activity",
}) {
  const preparedRows = useMemo(() => buildPreparedRows(), []);
  const initialFiltersRef = useRef(buildInitialFilters(preparedRows));
  const companyRef = useRef(null);
  const timeRangeRef = useRef(null);
  const isMobileView = useReportPageMobileView();
  const [filters, setFilters] = useState(initialFiltersRef.current);
  const [hasApplied, setHasApplied] = useState(false);
  const [appliedRows, setAppliedRows] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [reportQuickScope, setReportQuickScope] = useState("All");
  const [activeTimeField, setActiveTimeField] = useState("");
  const { ready, canView } = useMenuAccess(accessMenuKey);

  const isKeMode = mode === "ke";
  const companyOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.company)))],
    [preparedRows]
  );
  const branchOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.branch)))],
    [preparedRows]
  );
  const vehicleGroupOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.group)))],
    [preparedRows]
  );
  const vehicleTypeOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.vehicleType)))],
    [preparedRows]
  );
  const vehicleBrandOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.brand)))],
    [preparedRows]
  );
  const vehicleModelOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.model)))],
    [preparedRows]
  );

  const objectSearchQuery = String(filters.objectSearch || "")
    .trim()
    .toLowerCase();

  const branchVehicleMap = useMemo(() => {
    const grouped = new Map();
    preparedRows.forEach((row) => {
      const current = grouped.get(row.branch) || [];
      current.push(row.object);
      grouped.set(row.branch, current);
    });
    return grouped;
  }, [preparedRows]);

  const visibleBranchGroups = useMemo(() => {
    return Array.from(branchVehicleMap.entries())
      .map(([branch, objects]) => ({
        branch,
        objects: objects.filter((object) => object.toLowerCase().includes(objectSearchQuery)),
      }))
      .filter((entry) => entry.objects.length > 0);
  }, [branchVehicleMap, objectSearchQuery]);

  const visibleVehicles = useMemo(
    () => visibleBranchGroups.flatMap((entry) => entry.objects),
    [visibleBranchGroups]
  );

  const selectedObjects = filters.selectedObjects;
  const allVisibleSelected = visibleVehicles.length > 0 && visibleVehicles.every((object) => selectedObjects.includes(object));
  const someVisibleSelected = visibleVehicles.some((object) => selectedObjects.includes(object)) && !allVisibleSelected;
  const activeTimeValue = activeTimeField ? parseTimeValue(filters[activeTimeField]) : null;
  const rangeLabel = useMemo(() => {
    return `${getMonthLabel(filters.month)}${filters.includeDays ? " • Daywise view" : " • Total view"}`;
  }, [filters.includeDays, filters.month]);

  useEffect(() => {
    if (companyRef.current) {
      companyRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePointerDown = (event) => {
      if (!timeRangeRef.current?.contains(event.target)) {
        setActiveTimeField("");
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleObjectToggle = (object) => {
    setFilters((current) => {
      const exists = current.selectedObjects.includes(object);
      return {
        ...current,
        selectedObjects: exists
          ? current.selectedObjects.filter((item) => item !== object)
          : [...current.selectedObjects, object],
      };
    });
  };

  const toggleVisibleObjects = (checked) => {
    setFilters((current) => {
      const base = new Set(current.selectedObjects);
      visibleVehicles.forEach((object) => {
        if (checked) {
          base.add(object);
        } else {
          base.delete(object);
        }
      });
      return { ...current, selectedObjects: Array.from(base) };
    });
  };

  const toggleBranchObjects = (branch, checked) => {
    const branchObjects = branchVehicleMap.get(branch) || [];
    setFilters((current) => {
      const base = new Set(current.selectedObjects);
      branchObjects.forEach((object) => {
        if (checked) {
          base.add(object);
        } else {
          base.delete(object);
        }
      });
      return { ...current, selectedObjects: Array.from(base) };
    });
  };

  const applyFilters = (nextStatus = "") => {
    const distanceTarget = Number(filters.distanceValue);
    const selectedObjectSet = new Set(filters.selectedObjects);
    const nextRows = preparedRows.filter((row) => {
      if (filters.company !== "All" && row.company !== filters.company) return false;
      if (filters.branch !== "All" && row.branch !== filters.branch) return false;
      if (filters.vehicleGroup !== "All" && row.group !== filters.vehicleGroup) return false;
      if (filters.vehicleType !== "All" && row.vehicleType !== filters.vehicleType) return false;
      if (filters.vehicleBrand !== "All" && row.brand !== filters.vehicleBrand) return false;
      if (filters.vehicleModel !== "All" && row.model !== filters.vehicleModel) return false;
      if (!selectedObjectSet.has(row.object)) return false;
      if (!compareValue(filters.distanceOperator, row.totalDistance, distanceTarget)) return false;
      return true;
    });

    setAppliedRows(nextRows);
    setHasApplied(true);
    setStatusText(nextStatus || `${nextRows.length} record(s) loaded for ${getMonthLabel(filters.month)}.`);
  };

  const handleSaveFilter = () => {
    applyFilters("Filter saved for Daywise Distance.");
  };

  const handleDeleteFilter = () => {
    setFilters(buildInitialFilters(preparedRows));
    setAppliedRows([]);
    setHasApplied(false);
    setStatusText("Daywise Distance filters reset.");
  };

  const triggerUtilityAction = (label) => {
    setStatusText(`${label} is available in the Daywise Distance workspace.`);
  };

  const exportHeaders = useMemo(() => {
    const baseHeaders = ["Branch", "Object", "Object Brand", "Object Model", "Total Distance"];
    if (!filters.includeDays) return baseHeaders;
    return [...baseHeaders, ...DAY_COLUMNS];
  }, [filters.includeDays]);

  const exportRows = useMemo(() => {
    return appliedRows.map((row) => {
      const baseCells = [
        row.branch,
        row.object,
        row.brand,
        row.model,
        formatDistance(row.totalDistance, filters.roundOff),
      ];
      if (!filters.includeDays) return baseCells;
      return [
        ...baseCells,
        ...DAY_COLUMNS.map((day) => formatDistance(row.dayValues?.[day] || 0, filters.roundOff)),
      ];
    });
  }, [appliedRows, filters.includeDays, filters.roundOff]);

  const handleExport = (format) => {
    if (!appliedRows.length) {
      setStatusText("Apply filters first to export Daywise Distance.");
      return;
    }

    if (format === "CSV") {
      const content = [exportHeaders.join(","), ...exportRows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      downloadFile("daywise-distance-report.csv", content, "text/csv;charset=utf-8");
      return;
    }

    if (format === "XLS") {
      const content = [exportHeaders.join("\t"), ...exportRows.map((row) => row.join("\t"))].join("\n");
      downloadFile("daywise-distance-report.xls", content, "application/vnd.ms-excel");
      return;
    }

    const rowsHtml = exportRows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=1280,height=720");
    if (!printWindow) return;
    printWindow.document.write(
      `<html><head><title>Daywise Distance</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #8f9aa5;padding:4px 6px;text-align:left;vertical-align:top}th{background:#d4d9de}</style></head><body><h1>Daywise Distance</h1><p>${rangeLabel}</p><table><thead><tr>${exportHeaders
        .map((header) => `<th>${header}</th>`)
        .join("")}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const footerRecordText = `${appliedRows.length ? 1 : 0}-${appliedRows.length} (${appliedRows.length})`;

  if (!ready && accessMenuKey) {
    return (
      <>
        <ReportPageChrome isMobileView={isMobileView} />
        <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
          <AccessGuardState
            mode="loading"
            title="Daywise Distance access is loading"
            message="Checking your menu rights before opening this report."
          />
        </main>
      </>
    );
  }

  if (accessMenuKey && !canView) {
    return (
      <>
        <ReportPageChrome isMobileView={isMobileView} />
        <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
          <AccessGuardState
            title="Daywise Distance access denied"
            message={`You do not currently have view access for ${accessMenuKey}.`}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <ReportPageChrome isMobileView={isMobileView} />
      <main className={`${styles.page} ${isMobileView ? styles.pageMobile : ""}`}>
        <section className={styles.headerBar}>
          <div className={styles.headerLeft}>
            {isKeMode ? (
              <span className={styles.keBrandMark}>
                <Image src={keLogo} alt="KE logo" className={styles.keBrandMarkImage} />
              </span>
            ) : null}
            <div className={styles.titleRow}>
              <FaStar className={styles.titleIcon} />
              <h1>Daywise Distance</h1>
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
            {statusText ? <div className={styles.statusBar}>{statusText}</div> : null}
            <div
              className={`${styles.tableShell} ${hasApplied ? styles.tableShellResult : ""} ${
                hasApplied ? styles.daywiseTableShellResult : ""
              }`}
            >
              <div className={styles.tableScroller}>
                <table
                  className={`${styles.summaryTable} ${hasApplied ? styles.summaryTableResult : ""} ${styles.daywiseSummaryTable}`}
                >
                  <colgroup>
                    {MAIN_COLUMN_WIDTHS
                      .slice(0, filters.includeDays ? MAIN_COLUMN_WIDTHS.length : 5)
                      .map((width, index) => (
                        <col key={`daywise-col-${index}`} style={{ width }} />
                      ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <span className={styles.headerLabel}>
                          <span>Branch</span>
                        </span>
                      </th>
                      <th>
                        <span className={styles.headerLabel}>
                          <span>Object</span>
                        </span>
                      </th>
                      <th>
                        <span className={styles.headerLabel}>
                          <span>Object Brand</span>
                        </span>
                      </th>
                      <th>
                        <span className={styles.headerLabel}>
                          <span>Object Model</span>
                        </span>
                      </th>
                      <th className={styles.numericCell}>
                        <span className={styles.headerLabel}>
                          <span>Total Distance</span>
                        </span>
                      </th>
                      {filters.includeDays
                        ? DAY_COLUMNS.map((day) => (
                            <th key={day} className={styles.numericCell}>
                              <span className={styles.headerLabel}>
                                <span>{day}</span>
                              </span>
                            </th>
                          ))
                        : null}
                    </tr>
                  </thead>
                  <tbody>
                    {hasApplied && appliedRows.length ? (
                      appliedRows.map((row) => (
                        <tr key={row.object} className={styles.activeMainRow}>
                          <td>{row.branch}</td>
                          <td>{row.object}</td>
                          <td>{row.brand}</td>
                          <td>{row.model}</td>
                          <td className={styles.numericCell}>
                            {formatDistance(row.totalDistance, filters.roundOff)}
                          </td>
                          {filters.includeDays
                            ? DAY_COLUMNS.map((day) => {
                                const value = Number(row.dayValues?.[day]) || 0;
                                const cellClassName =
                                  value <= 0
                                    ? styles.daywiseCellZero
                                    : value === row.peakDistance
                                    ? styles.daywiseCellPeak
                                    : styles.daywiseCellActive;
                                return (
                                  <td key={`${row.object}-${day}`} className={`${styles.numericCell} ${cellClassName}`}>
                                    {formatDistance(value, filters.roundOff)}
                                  </td>
                                );
                              })
                            : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={filters.includeDays ? 5 + DAY_COLUMNS.length : 5}
                          className={`${styles.noDataRow} ${hasApplied ? styles.daywiseNoDataRow : ""}`}
                        >
                          {hasApplied
                            ? "No Daywise Distance rows match the current filters."
                            : "Apply filters to load Daywise Distance results."}
                        </td>
                      </tr>
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
                    onClick={() => applyFilters("Daywise Distance refreshed.")}
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
                      {companyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Branch :</label>
                    <select className={styles.filterControl} value={filters.branch} onChange={(event) => handleFilterChange("branch", event.target.value)}>
                      {branchOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Group :</label>
                    <select className={styles.filterControl} value={filters.vehicleGroup} onChange={(event) => handleFilterChange("vehicleGroup", event.target.value)}>
                      {vehicleGroupOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Type :</label>
                    <select className={styles.filterControl} value={filters.vehicleType} onChange={(event) => handleFilterChange("vehicleType", event.target.value)}>
                      {vehicleTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Brand :</label>
                    <select className={styles.filterControl} value={filters.vehicleBrand} onChange={(event) => handleFilterChange("vehicleBrand", event.target.value)}>
                      {vehicleBrandOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Vehicle Model :</label>
                    <select className={styles.filterControl} value={filters.vehicleModel} onChange={(event) => handleFilterChange("vehicleModel", event.target.value)}>
                      {vehicleModelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Distance :</label>
                    <select className={styles.filterControl} value={filters.distanceOperator} onChange={(event) => handleFilterChange("distanceOperator", event.target.value)}>
                      {OPERATOR_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.filterControl}
                      value={filters.distanceValue}
                      onChange={(event) => handleFilterChange("distanceValue", event.target.value)}
                      placeholder="Distance Value"
                    />
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.timeRangeRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(filters.roundOff)}
                        onChange={(event) => handleFilterChange("roundOff", event.target.checked)}
                      />
                      <span>Round Off</span>
                    </label>
                  </div>
                </div>

                <div className={styles.filterColumn}>
                  <div className={styles.filterBlock}>
                    <label className={styles.filterLabel}>Date Selection :</label>
                    <input
                      type="month"
                      className={styles.filterControl}
                      value={filters.month}
                      onChange={(event) => handleFilterChange("month", event.target.value)}
                    />
                  </div>

                  <div className={styles.filterBlock}>
                    <label className={styles.timeRangeRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(filters.includeDays)}
                        onChange={(event) => handleFilterChange("includeDays", event.target.checked)}
                      />
                      <span>Days</span>
                    </label>
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
                                      onClick={() =>
                                        setFilters((current) => ({
                                          ...current,
                                          [item.key]: buildTimeValue({ ...parseTimeValue(current[item.key]), hour }),
                                        }))
                                      }
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
                                      onClick={() =>
                                        setFilters((current) => ({
                                          ...current,
                                          [item.key]: buildTimeValue({ ...parseTimeValue(current[item.key]), minute }),
                                        }))
                                      }
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
                                      onClick={() =>
                                        setFilters((current) => ({
                                          ...current,
                                          [item.key]: buildTimeValue({ ...parseTimeValue(current[item.key]), period }),
                                        }))
                                      }
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
                        onClick={() => setStatusText("Object list refreshed.")}
                        aria-label="Reload objects"
                      >
                        <FaSyncAlt size={11} />
                      </button>
                    </div>

                    <div className={styles.treeBox}>
                      <label className={`${styles.checkRow} ${styles.treeLevel0}`}>
                        <input
                          ref={companyRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(event) => toggleVisibleObjects(event.target.checked)}
                        />
                        <span>{`${isKeMode ? "Valsgroup" : "Objects"} [ ${visibleVehicles.length} ]`}</span>
                        <span className={styles.treeCollapseMark}>-</span>
                      </label>
                      {visibleBranchGroups.map(({ branch, objects }) => {
                        const branchChecked = objects.length > 0 && objects.every((object) => filters.selectedObjects.includes(object));
                        return (
                          <React.Fragment key={branch}>
                            <label className={`${styles.checkRow} ${styles.treeLevel1}`}>
                              <input
                                type="checkbox"
                                checked={branchChecked}
                                onChange={(event) => toggleBranchObjects(branch, event.target.checked)}
                              />
                              <span>{branch}</span>
                            </label>
                            <div className={styles.treeChildren}>
                              {objects.map((object) => (
                                <label key={object} className={`${styles.checkRow} ${styles.treeLevel2}`}>
                                  <input
                                    type="checkbox"
                                    checked={filters.selectedObjects.includes(object)}
                                    onChange={() => handleObjectToggle(object)}
                                  />
                                  <span className={styles.treeItemText}>{object}</span>
                                </label>
                              ))}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={styles.filterActions}>
                  <div className={styles.buttonGrid}>
                    <button type="button" className={`${styles.footerButton} ${styles.secondaryActionButton}`} onClick={handleSaveFilter}>
                      Save Filter
                    </button>
                    <button type="button" className={`${styles.footerButton} ${styles.dangerActionButton}`} onClick={handleDeleteFilter}>
                      Delete Filter
                    </button>
                    <button type="button" className={`${styles.footerButton} ${styles.primaryActionButton}`} onClick={() => applyFilters()}>
                      Apply
                    </button>
                    <button type="button" className={`${styles.footerButton} ${styles.exportActionButton}`} onClick={() => handleExport("XLS")}>
                      XLS
                    </button>
                    <button type="button" className={`${styles.footerButton} ${styles.exportActionButton}`} onClick={() => handleExport("PDF")}>
                      PDF
                    </button>
                    <button type="button" className={`${styles.footerButton} ${styles.exportActionButton}`} onClick={() => handleExport("CSV")}>
                      CSV
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          ) : null}
        </section>
      </main>
    </>
  );
}
