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
import { DAYWISE_MIS_SOURCE_ROWS } from "./daywiseDistanceMisDummyData";

const DEFAULT_DISPLAY_DAY_COUNT = 6;
const OPERATOR_OPTIONS = ["Greater Than", "Less Than", "Equal To"];
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];
const MIS_SUB_COLUMNS = [
  { key: "peak", label: "KM's Driven Peak" },
  { key: "offPeak", label: "KM's Driven Off Peak" },
  { key: "total", label: "Total KM's In a Day" },
];
const LEAD_COLUMNS = [
  { key: "serial", label: "S.No", width: "70px" },
  { key: "object", label: "Vehicle No.", width: "110px" },
  { key: "ownership", label: "Hired / Own", width: "96px" },
  { key: "vendor", label: "Vendor", width: "88px" },
  { key: "trackerCompany", label: "Tracker Company", width: "120px" },
  { key: "vehicleType", label: "Category", width: "88px" },
  { key: "group", label: "Group", width: "110px" },
  { key: "branch", label: "BU / Function", width: "116px" },
  { key: "department", label: "IBC / VIBC / Department", width: "156px" },
  { key: "subDepartment", label: "Sub Department", width: "200px" },
  { key: "shiftHours", label: "Shift (Hrs)", width: "86px" },
  { key: "shiftTiming", label: "Shift Timing", width: "150px" },
  { key: "roadStatus", label: "On / Off Road", width: "98px" },
];
const SUMMARY_COLUMNS = [
  { key: "accumulatedPeak", label: "Accumulated KM's in Peak Hours", width: "120px" },
  { key: "accumulatedOffPeak", label: "Accumulated KM's in Off Hours", width: "120px" },
  { key: "accumulatedTotal", label: "Accumulated KM's Total", width: "120px" },
  { key: "excessIdling", label: "Excess Idling", width: "92px" },
  { key: "harshBraking", label: "Harsh Braking", width: "92px" },
  { key: "speedViolation", label: "Speed Violation", width: "94px" },
  { key: "travelTime", label: "Travel Time", width: "102px" },
  { key: "stopTime", label: "Stop Time", width: "102px" },
  { key: "remarks", label: "Remarks", width: "220px" },
];

function toNumericMetric(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getCurrentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${padDatePart(today.getMonth() + 1)}`;
}

function parseMonthValue(monthValue) {
  const [year, month] = String(monthValue || getCurrentMonthValue())
    .split("-")
    .map((value) => Number(value) || 0);
  return {
    year: year || new Date().getFullYear(),
    month: month || 1,
  };
}

function formatMisDateLabel(date) {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
}

function buildMisDateGroups(monthValue, dayCount = DEFAULT_DISPLAY_DAY_COUNT) {
  const { year, month } = parseMonthValue(monthValue);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(year, Math.max(0, month - 1), index + 1);
    return {
      key: `${year}-${padDatePart(month)}-${padDatePart(index + 1)}`,
      label: formatMisDateLabel(date),
    };
  });
}

function getMonthLabel(monthValue) {
  const { year, month } = parseMonthValue(monthValue);
  const monthDate = new Date(year, Math.max(0, month - 1), 1);
  return monthDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function compareValue(operator, source, target) {
  if (!Number.isFinite(target)) return true;
  if (operator === "Less Than") return source < target;
  if (operator === "Equal To") return source === target;
  return source > target;
}

function formatDistanceMetric(value, roundOff = false) {
  if (value === null || value === undefined) return "-";
  const trimmedValue = typeof value === "string" ? value.trim() : value;
  const numeric = Number(trimmedValue);
  if (!Number.isFinite(numeric)) return "-";
  if (roundOff) return Math.round(numeric).toLocaleString("en-US");
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDistanceOrStatus(value, roundOff = false) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "-";
    const numeric = Number(trimmedValue);
    if (!Number.isFinite(numeric)) return trimmedValue;
  }
  return formatDistanceMetric(value, roundOff);
}

function normalizeTrackerCompany(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.toLowerCase() === "tracking world") return "Vals Tracking";
  return normalized;
}

function formatCountMetric(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDurationMetric(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "00h 00m";
  const totalMinutes = Math.round(numeric * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function getMetricCellKind(value, subKey = "") {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      if (numeric <= 0) return "zero";
      if (subKey === "total") return "total";
      return "active";
    }
    if (normalized === "parked") return "status";
    if (normalized === "um") return "maintenance";
    if (normalized === "tni" || normalized === "tr" || normalized === "tnr") return "maintenance";
    return "status";
  }
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "zero";
  if (subKey === "total") return "total";
  return "active";
}

function buildPreparedRows() {
  return DAYWISE_MIS_SOURCE_ROWS.map((row) => {
    const dayMetrics = row.dayMetrics || {};
    const dayMetricList = Object.values(dayMetrics);
    return {
      company: String(row.company || "KE"),
      serial: String(row.serial || ""),
      object: String(row.object || ""),
      ownership: String(row.ownership || ""),
      vendor: String(row.model || row.vendor || ""),
      trackerCompany: normalizeTrackerCompany(row.brand || row.trackerCompany || ""),
      vehicleType: String(row.vehicleType || row.category || ""),
      group: String(row.group || ""),
      branch: String(row.branch || ""),
      department: String(row.department || ""),
      subDepartment: String(row.subDepartment || ""),
      shiftHours: String(row.shiftHours || ""),
      shiftTiming: String(row.shiftTiming || ""),
      roadStatus: String(row.roadStatus || ""),
      dayMetricList,
      accumulatedPeak: row.accumulatedPeak,
      accumulatedOffPeak: row.accumulatedOffPeak,
      accumulatedTotal: row.accumulatedTotal,
      excessIdling: row.excessIdling,
      harshBraking: row.harshBraking,
      speedViolation: row.speedViolation,
      travelTime: row.travelTime,
      stopTime: row.stopTime,
      remarks: String(row.remarks || ""),
      sortableAccumulatedTotal: toNumericMetric(row.accumulatedTotal),
    };
  });
}

function buildInitialFilters(rows) {
  return {
    company: "All",
    month: getCurrentMonthValue(),
    includeDays: true,
    timeRangeEnabled: false,
    startTime: "07:00 AM",
    endTime: "07:00 PM",
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
  const isMobileView = useReportPageMobileView();
  const [filters, setFilters] = useState(initialFiltersRef.current);
  const [hasApplied, setHasApplied] = useState(false);
  const [appliedRows, setAppliedRows] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [reportQuickScope, setReportQuickScope] = useState("All");
  const [reportPageSize, setReportPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const { ready, canView } = useMenuAccess(accessMenuKey);
  const misDateGroups = useMemo(
    () => buildMisDateGroups(filters.month, DEFAULT_DISPLAY_DAY_COUNT),
    [filters.month]
  );
  const rangeLabel = useMemo(() => {
    if (!misDateGroups.length) return `${getMonthLabel(filters.month)} MIS`;
    return `${misDateGroups[0].label} to ${
      misDateGroups[misDateGroups.length - 1].label
    } • ${getMonthLabel(filters.month)} MIS`;
  }, [filters.month, misDateGroups]);

  const displayRangeLabel = useMemo(
    () => rangeLabel.replace(/â€¢|•/g, "|"),
    [rangeLabel]
  );

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
  const trackerCompanyOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.trackerCompany)))],
    [preparedRows]
  );
  const vendorOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.vendor)))],
    [preparedRows]
  );

  const objectSearchQuery = String(filters.objectSearch || "").trim().toLowerCase();

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
  const allVisibleSelected =
    visibleVehicles.length > 0 &&
    visibleVehicles.every((object) => selectedObjects.includes(object));
  const someVisibleSelected =
    visibleVehicles.some((object) => selectedObjects.includes(object)) && !allVisibleSelected;

  useEffect(() => {
    if (companyRef.current) {
      companyRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

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
        if (checked) base.add(object);
        else base.delete(object);
      });
      return { ...current, selectedObjects: Array.from(base) };
    });
  };

  const toggleBranchObjects = (branch, checked) => {
    const branchObjects = branchVehicleMap.get(branch) || [];
    setFilters((current) => {
      const base = new Set(current.selectedObjects);
      branchObjects.forEach((object) => {
        if (checked) base.add(object);
        else base.delete(object);
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
      if (filters.vehicleBrand !== "All" && row.trackerCompany !== filters.vehicleBrand) return false;
      if (filters.vehicleModel !== "All" && row.vendor !== filters.vehicleModel) return false;
      if (!selectedObjectSet.has(row.object)) return false;
      if (
        !compareValue(
          filters.distanceOperator,
          row.sortableAccumulatedTotal,
          distanceTarget
        )
      ) {
        return false;
      }
      return true;
    });

    setAppliedRows(nextRows);
    setCurrentPage(1);
    setHasApplied(true);
    setStatusText(
      nextStatus ||
        `${nextRows.length} record(s) loaded for ${getMonthLabel(filters.month)} in sheet-style Daywise MIS format.`
    );
  };

  const handleSaveFilter = () => {
    applyFilters("Daywise Distance filters applied to the full sheet dummy dataset.");
  };

  const handleDeleteFilter = () => {
    setFilters(buildInitialFilters(preparedRows));
    setAppliedRows([]);
    setCurrentPage(1);
    setHasApplied(false);
    setStatusText("");
  };

  const triggerUtilityAction = (label) => {
    if (!hasApplied) return;
    setStatusText(`${label} is available in the Daywise Distance MIS workspace.`);
  };


  const exportHeaders = useMemo(() => {
    const leadHeaders = LEAD_COLUMNS.map((column) => column.label);
    const dateHeaders = misDateGroups.flatMap((group) =>
      MIS_SUB_COLUMNS.map((metric) => `${group.label} - ${metric.label}`)
    );
    const tailHeaders = SUMMARY_COLUMNS.map((column) => column.label);
    return [...leadHeaders, ...dateHeaders, ...tailHeaders];
  }, [misDateGroups]);

  const exportRows = useMemo(() => {
    return appliedRows.map((row) => [
      row.serial,
      row.object,
      row.ownership,
      row.vendor,
      row.trackerCompany,
      row.vehicleType,
      row.group,
      row.branch,
      row.department,
      row.subDepartment,
      row.shiftHours,
      row.shiftTiming,
      row.roadStatus,
      ...misDateGroups.flatMap((group, groupIndex) => {
        const metrics = row.dayMetricList[groupIndex] || {};
        return [
          formatDistanceOrStatus(metrics.peak, filters.roundOff),
          formatDistanceOrStatus(metrics.offPeak, filters.roundOff),
          formatDistanceOrStatus(metrics.total, filters.roundOff),
        ];
      }),
      formatDistanceMetric(row.accumulatedPeak, filters.roundOff),
      formatDistanceMetric(row.accumulatedOffPeak, filters.roundOff),
      formatDistanceMetric(row.accumulatedTotal, filters.roundOff),
      formatCountMetric(row.excessIdling),
      formatCountMetric(row.harshBraking),
      formatCountMetric(row.speedViolation),
      formatDurationMetric(row.travelTime),
      formatDurationMetric(row.stopTime),
      row.remarks,
    ]);
  }, [appliedRows, filters.roundOff, misDateGroups]);

  const handleExport = (format) => {
    if (!appliedRows.length) {
      setStatusText("No Daywise Distance MIS rows are available for export.");
      return;
    }

    if (format === "CSV") {
      const content = [
        exportHeaders.join(","),
        ...exportRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");
      downloadFile("daywise-distance-mis.csv", content, "text/csv;charset=utf-8");
      return;
    }

    if (format === "XLS") {
      const content = [exportHeaders.join("\t"), ...exportRows.map((row) => row.join("\t"))].join(
        "\n"
      );
      downloadFile("daywise-distance-mis.xls", content, "application/vnd.ms-excel");
      return;
    }

    const rowsHtml = exportRows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=1440,height=900");
    if (!printWindow) return;
    printWindow.document.write(
      `<html><head><title>Daywise Distance MIS</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #8f9aa5;padding:4px 6px;text-align:left;vertical-align:top}th{background:#d4d9de}h1{margin-bottom:6px}p{margin:4px 0 14px}</style></head><body><h1>Daywise Distance MIS</h1><p>${displayRangeLabel}</p><table><thead><tr>${exportHeaders
        .map((header) => `<th>${header}</th>`)
        .join("")}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const totalPages = Math.max(1, Math.ceil(appliedRows.length / reportPageSize));

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * reportPageSize;
    return appliedRows.slice(startIndex, startIndex + reportPageSize);
  }, [appliedRows, currentPage, reportPageSize]);

  const footerRecordText = useMemo(() => {
    if (!appliedRows.length) return "0-0 (0)";
    const startIndex = (currentPage - 1) * reportPageSize;
    const endIndex = Math.min(startIndex + reportPageSize, appliedRows.length);
    return `${startIndex + 1}-${endIndex} (${appliedRows.length})`;
  }, [appliedRows, currentPage, reportPageSize]);

  const handlePageSizeChange = (value) => {
    const nextSize = Number(value);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;
    setReportPageSize(nextSize);
    setCurrentPage(1);
  };

  const jumpToPage = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextPage = Math.max(1, Math.min(totalPages, Math.trunc(numeric)));
    setCurrentPage(nextPage);
  };

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
            <div className={styles.rangeText}>{displayRangeLabel}</div>
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
          {hasApplied ? (
            <div className={`${styles.resultsArea} ${styles.resultsAreaResult}`}>
              {statusText ? <div className={styles.statusBar}>{statusText}</div> : null}

              <div
                className={`${styles.tableShell} ${styles.tableShellResult} ${styles.daywiseTableShellResult}`}
              >
                <div className={styles.tableScroller}>
                  <table
                    className={`${styles.summaryTable} ${styles.summaryTableResult} ${styles.daywiseSummaryTable} ${styles.daywiseMisTable}`}
                  >
                    <colgroup>
                      {LEAD_COLUMNS.map((column) => (
                        <col key={column.key} style={{ width: column.width }} />
                      ))}
                      {misDateGroups.flatMap((group) =>
                        MIS_SUB_COLUMNS.map((metric) => (
                          <col
                            key={`${group.key}-${metric.key}`}
                            style={{ width: metric.key === "total" ? "108px" : "102px" }}
                          />
                        ))
                      )}
                      {SUMMARY_COLUMNS.map((column) => (
                        <col key={column.key} style={{ width: column.width }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {LEAD_COLUMNS.map((column) => (
                          <th
                            key={column.key}
                            rowSpan={2}
                            className={`${styles.daywiseStickyHeader} ${styles.daywiseLeadHeader}`}
                          >
                            {column.label}
                          </th>
                        ))}
                        {misDateGroups.map((group, index) => (
                          <th
                            key={group.key}
                            colSpan={MIS_SUB_COLUMNS.length}
                            className={`${styles.daywiseStickyHeader} ${
                              index === 0 ? styles.daywiseDateHeaderAccent : styles.daywiseDateHeader
                            }`}
                          >
                            {group.label}
                          </th>
                        ))}
                        {SUMMARY_COLUMNS.map((column, index) => (
                          <th
                            key={column.key}
                            rowSpan={2}
                            className={`${styles.daywiseStickyHeader} ${
                              index < 3 ? styles.daywiseSummaryHeader : styles.daywiseMetricHeader
                            }`}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {misDateGroups.flatMap((group, groupIndex) =>
                          MIS_SUB_COLUMNS.map((metric) => (
                            <th
                              key={`${group.key}-${metric.key}`}
                              className={`${styles.daywiseStickyHeader} ${
                                groupIndex === 0
                                  ? styles.daywiseDateSubHeaderAccent
                                  : styles.daywiseDateSubHeader
                              }`}
                            >
                              {metric.label}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.length ? (
                        pagedRows.map((row) => (
                          <tr key={`${row.serial}-${row.object}`} className={styles.activeMainRow}>
                            {LEAD_COLUMNS.map((column) => (
                              <td
                                key={`${row.object}-${column.key}`}
                                className={column.key === "serial" ? styles.numericCell : ""}
                              >
                                {row[column.key]}
                              </td>
                            ))}
                            {misDateGroups.flatMap((group, groupIndex) =>
                              MIS_SUB_COLUMNS.map((metric) => {
                                const value = row.dayMetricList[groupIndex]?.[metric.key];
                                const kind = getMetricCellKind(value, metric.key);
                                const cellClassName =
                                  kind === "maintenance"
                                    ? styles.daywiseCellMaintenance
                                    : kind === "status"
                                    ? styles.daywiseCellStatus
                                    : kind === "total"
                                    ? styles.daywiseCellPeak
                                    : kind === "active"
                                    ? styles.daywiseCellActive
                                    : styles.daywiseCellZero;
                                return (
                                  <td
                                    key={`${row.object}-${group.key}-${metric.key}`}
                                    className={`${styles.numericCell} ${cellClassName}`}
                                  >
                                    {formatDistanceOrStatus(value, filters.roundOff)}
                                  </td>
                                );
                              })
                            )}
                            <td className={`${styles.numericCell} ${styles.daywiseSummaryCell}`}>
                              {formatDistanceMetric(row.accumulatedPeak, filters.roundOff)}
                            </td>
                            <td className={`${styles.numericCell} ${styles.daywiseSummaryCell}`}>
                              {formatDistanceMetric(row.accumulatedOffPeak, filters.roundOff)}
                            </td>
                            <td className={`${styles.numericCell} ${styles.daywiseSummaryCell}`}>
                              {formatDistanceMetric(row.accumulatedTotal, filters.roundOff)}
                            </td>
                            <td className={styles.numericCell}>{formatCountMetric(row.excessIdling)}</td>
                            <td className={styles.numericCell}>{formatCountMetric(row.harshBraking)}</td>
                            <td className={styles.numericCell}>{formatCountMetric(row.speedViolation)}</td>
                            <td className={styles.numericCell}>{formatDurationMetric(row.travelTime)}</td>
                            <td className={styles.numericCell}>{formatDurationMetric(row.stopTime)}</td>
                            <td className={styles.daywiseRemarksCell}>{row.remarks}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={
                              LEAD_COLUMNS.length +
                              misDateGroups.length * MIS_SUB_COLUMNS.length +
                              SUMMARY_COLUMNS.length
                            }
                            className={`${styles.noDataRow} ${styles.daywiseNoDataRow}`}
                          >
                            No Daywise Distance rows match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={styles.reportFooter}>
                <div className={styles.reportFooterLeft}>
                  <button
                    type="button"
                    className={styles.reportToolButton}
                    onClick={() => applyFilters("Daywise Distance MIS refreshed.")}
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
                    <option value="Vehicle">Vehicle</option>
                    <option value="BU">BU / Function</option>
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
                  <select
                    className={styles.reportMiniSelect}
                    value={String(reportPageSize)}
                    onChange={(event) => handlePageSizeChange(event.target.value)}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <div className={styles.reportPager}>
                    <button
                      type="button"
                      className={styles.reportPagerButton}
                      aria-label="Previous page"
                      onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage <= 1}
                    >
                      {"<"}
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      className={styles.reportPagerCurrent}
                      value={currentPage}
                      onChange={(event) => jumpToPage(event.target.value)}
                      aria-label="Current page"
                    />
                    <button
                      type="button"
                      className={styles.reportPagerButton}
                      aria-label="Next page"
                      onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      {">"}
                    </button>
                  </div>
                  <div className={styles.reportCount}>{footerRecordText}</div>
                </div>
              </div>
            </div>
          ) : null}

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
                  <label className={styles.filterLabel}>BU / Function :</label>
                  <select className={styles.filterControl} value={filters.branch} onChange={(event) => handleFilterChange("branch", event.target.value)}>
                    {branchOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Group :</label>
                  <select className={styles.filterControl} value={filters.vehicleGroup} onChange={(event) => handleFilterChange("vehicleGroup", event.target.value)}>
                    {vehicleGroupOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Category :</label>
                  <select className={styles.filterControl} value={filters.vehicleType} onChange={(event) => handleFilterChange("vehicleType", event.target.value)}>
                    {vehicleTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Tracker Company :</label>
                  <select className={styles.filterControl} value={filters.vehicleBrand} onChange={(event) => handleFilterChange("vehicleBrand", event.target.value)}>
                    {trackerCompanyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Vendor :</label>
                  <select className={styles.filterControl} value={filters.vehicleModel} onChange={(event) => handleFilterChange("vehicleModel", event.target.value)}>
                    {vendorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Accumulated Distance :</label>
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
                    <div className={styles.timeRangeInputs}>
                      <input
                        type="text"
                        className={styles.filterControl}
                        value={filters.startTime}
                        onChange={(event) => handleFilterChange("startTime", event.target.value)}
                        placeholder="Start time"
                      />
                      <input
                        type="text"
                        className={styles.filterControl}
                        value={filters.endTime}
                        onChange={(event) => handleFilterChange("endTime", event.target.value)}
                        placeholder="End time"
                      />
                    </div>
                  ) : null}
                </div>

                <div className={`${styles.filterBlock} ${styles.objectSelectionBlock}`}>
                  <label className={styles.filterLabel}>Vehicle Selection :</label>
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
                      onClick={() => setStatusText(hasApplied ? "Vehicle tree refreshed." : "")}
                      aria-label="Reload vehicles"
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
                      <span>{`KE Vehicles [ ${visibleVehicles.length} ]`}</span>
                      <span className={styles.treeCollapseMark}>-</span>
                    </label>
                    {visibleBranchGroups.map(({ branch, objects }) => {
                      const branchChecked =
                        objects.length > 0 &&
                        objects.every((object) => filters.selectedObjects.includes(object));
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
                              <label key={`${branch}-${object}`} className={`${styles.checkRow} ${styles.treeLevel2}`}>
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
