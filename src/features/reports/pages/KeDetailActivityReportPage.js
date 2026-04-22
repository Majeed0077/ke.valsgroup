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
import { normalizeReportObjectOptions, reconcileSelectedObject } from "@/lib/reportObjectOptions";
import styles from "./TravelSummaryReportPage.module.css";
import keLogo from "../../../../public/icons/KE.webp";

const STORAGE_KEY = "vtp_ke_detail_activity_report_saved_filter_v1";
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
const TIME_HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const TIME_PERIOD_OPTIONS = ["AM", "PM"];
const VEHICLES = [];

const DETAIL_DATA = {};

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
    branch: "All",
    objectSearch: "",
    selectedObject: "JU-3028",
    vehicleGroup: "All",
    vehicleType: "All",
    vehicleBrand: "All",
    vehicleModel: "All",
  };
}

export default function KeDetailActivityReportPage({ menuKey = "", accessMenuKey = menuKey }) {
  const initialFiltersRef = useRef(buildInitialFilters());
  const timeRangeRef = useRef(null);
  const isMobileView = useReportPageMobileView();
  const [filters, setFilters] = useState(initialFiltersRef.current);
  const [hasApplied, setHasApplied] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeTimeField, setActiveTimeField] = useState("");
  const [reportQuickScope, setReportQuickScope] = useState("All");
  const [availableVehicles, setAvailableVehicles] = useState(VEHICLES);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const { ready, canView } = useMenuAccess(accessMenuKey);

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
      setFilters((current) => ({ ...current, ...parsed, selectedObject: parsed?.selectedObject || current.selectedObject }));
      setStatusText("Saved filter loaded.");
    } catch {
      // Ignore invalid saved state.
    }
  }, []);

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

  useEffect(() => {
    if (!filters.timeRangeEnabled) setActiveTimeField("");
  }, [filters.timeRangeEnabled]);

  useEffect(() => {
    void loadAvailableVehicles();
  }, []);

  useEffect(() => {
    setFilters((current) => {
      const nextSelectedObject = reconcileSelectedObject(current.selectedObject, availableVehicles);
      if (nextSelectedObject === current.selectedObject) {
        return current;
      }
      return { ...current, selectedObject: nextSelectedObject };
    });
  }, [availableVehicles, filters.selectedObject]);

  const rangeLabel = useMemo(() => {
    const { start, end } = getPresetRange(filters.dateSelection, filters.customStart, filters.customEnd);
    return `[${formatDateTime(start)} - ${formatDateTime(end)}]`;
  }, [filters.customEnd, filters.customStart, filters.dateSelection]);

  const visibleVehicles = useMemo(() => {
    const query = String(filters.objectSearch || "").trim().toLowerCase();
    if (!query) return availableVehicles;
    return availableVehicles.filter((vehicle) => vehicle.toLowerCase().includes(query));
  }, [availableVehicles, filters.objectSearch]);

  const detailRows = useMemo(() => DETAIL_DATA[filters.selectedObject] || [], [filters.selectedObject]);

  const summary = useMemo(() => {
    if (!detailRows.length) return null;
    let avgSpeedSum = 0;
    let maxSpeed = 0;
    let runningSeconds = 0;
    let idleSeconds = 0;
    let stopSeconds = 0;
    let inactiveSeconds = 0;
    let totalDistance = 0;
    detailRows.forEach((row) => {
      const speed = Number(row.speed) || 0;
      avgSpeedSum += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      totalDistance = Math.max(totalDistance, Number(row.distance) || 0);
      if (row.status === "Running") runningSeconds += 300;
      if (row.status === "Idle") idleSeconds += 300;
      if (row.status === "Stop") stopSeconds += 300;
      if (row.status === "Inactive") inactiveSeconds += 300;
    });
    const formatDuration = (seconds) => `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
    return {
      vehicle: filters.selectedObject,
      avgSpeed: (avgSpeedSum / detailRows.length).toFixed(0),
      maxSpeed: String(maxSpeed),
      running: formatDuration(runningSeconds),
      idling: formatDuration(idleSeconds),
      stop: formatDuration(stopSeconds),
      inactive: formatDuration(inactiveSeconds),
      distance: totalDistance.toFixed(2),
    };
  }, [detailRows, filters.selectedObject]);

  const activeTimeValue = activeTimeField ? parseTimeValue(filters[activeTimeField]) : null;
  const handleFilterChange = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const updateTimeFieldPart = (fieldName, part, nextValue) => {
    setFilters((current) => {
      const parsed = parseTimeValue(current[fieldName]);
      return { ...current, [fieldName]: buildTimeValue({ ...parsed, [part]: nextValue }) };
    });
  };
  const applyFilters = (nextStatus = "") => {
    setHasApplied(true);
    setStatusText(nextStatus || "Detail activity loaded.");
  };
  const handleSaveFilter = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    applyFilters("Filter saved.");
  };
  const handleDeleteFilter = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setFilters(buildInitialFilters());
    setHasApplied(false);
    setStatusText("Saved filter cleared.");
  };
  const triggerUtilityAction = (label) => setStatusText(`${label} action is ready.`);

  const handleExport = (type) => {
    if (!detailRows.length) {
      setStatusText(`${type} export needs data. Click Apply first.`);
      return;
    }
    const headers = ["Date", "Time", "Status", "Address", "Lat", "Long", "Speed", "Distance", "Battery Voltage"];
    const rows = detailRows.map((row) => [row.date, row.time, row.status, row.address, row.lat, row.long, row.speed, row.distance, row.battery]);
    if (type === "CSV") {
      const content = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
      downloadFile("detail-activity-report.csv", content, "text/csv;charset=utf-8");
      setStatusText("CSV export started.");
      return;
    }
    if (type === "XLS") {
      const content = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
      downloadFile("detail-activity-report.xls", content, "application/vnd.ms-excel");
      setStatusText("XLS export started.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=1200,height=820");
    if (!printWindow) {
      setStatusText("PDF export window was blocked.");
      return;
    }
    const bodyRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
    printWindow.document.write(`<html><head><title>Detail Activity Report</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #8f9aa5;padding:4px 6px;text-align:left;vertical-align:top}th{background:#d4d9de}</style></head><body><h1>Detail Activity Report</h1><p>${rangeLabel}</p><table><thead><tr>${headers.map((header)=>`<th>${header}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setStatusText("PDF export opened.");
  };

  if (!ready && menuKey) {
    return (
      <main className={styles.page}>
        <AccessGuardState mode="loading" title="Detail Activity Report access is loading" message="Checking your menu rights before opening this module." />
      </main>
    );
  }

  if (menuKey && !canView) {
    return (
      <main className={styles.page}>
        <AccessGuardState title="Detail Activity Report access denied" message={`You do not currently have view access for ${menuKey}.`} />
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
              <span className={styles.keBrandMark}>
                <Image src={keLogo} alt="KE logo" className={styles.keBrandMarkImage} />
              </span>
              <h1>Detail Activity Report</h1>
            </div>
            <div className={styles.rangeText}>{rangeLabel}</div>
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
            {hasApplied ? (
              <>
                {summary ? (
                  <div className={styles.summaryPanel}>
                    <table className={styles.summaryPanelTable}>
                      <thead>
                        <tr>
                          <th>Vehicle Reg #</th>
                          <th>Avg Speed</th>
                          <th>Max Speed</th>
                          <th>Total Running Time</th>
                          <th>Total Idling Time</th>
                          <th>Total Stop Time</th>
                          <th>Total In Active Time</th>
                          <th>Total Distance Travelled</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{summary.vehicle}</td>
                          <td>{summary.avgSpeed}</td>
                          <td>{summary.maxSpeed}</td>
                          <td>{summary.running}</td>
                          <td>{summary.idling}</td>
                          <td>{summary.stop}</td>
                          <td>{summary.inactive}</td>
                          <td>{summary.distance}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className={`${styles.tableShell} ${styles.tableShellResult}`}>
                  <div className={styles.tableScroller}>
                    <table className={styles.activityTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Status</th>
                          <th>Address</th>
                          <th>Lat</th>
                          <th>Long</th>
                          <th>Speed</th>
                          <th>Distance</th>
                          <th>Battery Voltage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((row, index) => (
                          <tr key={`${row.date}-${row.time}-${index}`}>
                            <td>{row.date}</td>
                            <td>{row.time}</td>
                            <td className={`${styles.statusCell} ${styles[`status${row.status}`] || ""}`}>{row.status}</td>
                            <td>{row.address}</td>
                            <td className={styles.numericCell}>{row.lat}</td>
                            <td className={styles.numericCell}>{row.long}</td>
                            <td className={styles.numericCell}>{row.speed}</td>
                            <td className={styles.numericCell}>{row.distance}</td>
                            <td className={styles.numericCell}>{row.battery}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className={styles.reportFooter}>
                  <div className={styles.reportFooterLeft}>
                    <button type="button" className={styles.reportToolButton} onClick={() => applyFilters("Detail activity refreshed.")} aria-label="Refresh result"><FaSyncAlt size={14} /></button>
                    <button type="button" className={styles.reportToolLabelButton} onClick={() => handleExport("XLS")} aria-label="Export XLS"><FaSyncAlt size={12} /><span>XLS</span></button>
                    <button type="button" className={styles.reportToolLabelButton} onClick={() => handleExport("PDF")} aria-label="Export PDF"><FaPrint size={12} /><span>PDF</span></button>
                  </div>
                  <div className={styles.reportFooterCenter}>
                    <input type="text" className={styles.reportSearchInput} />
                    <select className={styles.reportScopeSelect} value={reportQuickScope} onChange={(event) => setReportQuickScope(event.target.value)}>
                      <option value="All">All</option>
                      <option value="Status">Status</option>
                      <option value="Address">Address</option>
                    </select>
                    <button type="button" className={styles.reportFooterSearchButton} aria-label="Search results" onClick={() => triggerUtilityAction("Result search")}><FaSearch size={16} /></button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.tableShell}>
                <div className={styles.tableScroller}>
                  <table className={styles.summaryTable}>
                    <thead>
                      <tr>
                        <th><span className={styles.headerLabel}><span>Date</span></span></th>
                        <th><span className={styles.headerLabel}><span>Time</span></span></th>
                        <th><span className={styles.headerLabel}><span>Status</span></span></th>
                        <th><span className={styles.headerLabel}><span>Address</span></span></th>
                        <th><span className={styles.headerLabel}><span>Lat</span></span></th>
                        <th><span className={styles.headerLabel}><span>Long</span></span></th>
                        <th><span className={styles.headerLabel}><span>Speed</span></span></th>
                        <th><span className={styles.headerLabel}><span>Distance</span></span></th>
                        <th><span className={styles.headerLabel}><span>Battery Voltage</span></span></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={9} className={styles.noDataRow}>No Records Found</td></tr>
                      <tr><td colSpan={9} className={styles.gridFillCell}><div className={styles.gridFillArea} /></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                    <select className={styles.filterControl} value={filters.branch} onChange={(event) => handleFilterChange("branch", event.target.value)}>
                      {BRANCH_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
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
                      <button type="button" className={styles.refreshTreeButton} onClick={() => void loadAvailableVehicles("Object list refreshed.")} aria-label="Reload objects" disabled={isLoadingObjects}>
                        <FaSyncAlt size={11} />
                      </button>
                    </div>
                    <div className={styles.treeBox}>
                      <div className={styles.singleTreeSection}>
                        <div className={styles.singleTreeHeader}>
                          <span>{`Valsgroup [ ${availableVehicles.length} ]`}</span>
                          <span className={styles.treeCollapseMark}>-</span>
                        </div>
                        <div className={styles.singleTreeSubHeader}>Fleet</div>
                        <div className={styles.singleTreeOptions}>
                          {visibleVehicles.map((vehicle) => (
                            <label key={vehicle} className={`${styles.radioRow} ${styles.treeLevel2}`}>
                              <input
                                type="radio"
                                name="detail-activity-object"
                                checked={filters.selectedObject === vehicle}
                                onChange={() => handleFilterChange("selectedObject", vehicle)}
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
                <div className={styles.filterActionBar}>
                  <div className={styles.buttonGrid}>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.secondaryActionButton}`}
                      onClick={handleSaveFilter}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.dangerActionButton}`}
                      onClick={handleDeleteFilter}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.primaryActionButton}`}
                      onClick={() => applyFilters()}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.exportActionButton}`}
                      onClick={() => handleExport("XLS")}
                    >
                      XLS
                    </button>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.exportActionButton}`}
                      onClick={() => handleExport("PDF")}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.exportActionButton}`}
                      onClick={() => handleExport("CSV")}
                    >
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

