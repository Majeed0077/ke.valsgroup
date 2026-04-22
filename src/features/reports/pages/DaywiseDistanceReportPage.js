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

const REPORT_REFERENCE_MONTH = "2016-09";
const REPORT_PERIOD_LABEL = "01-Sep-2016 to 06-Sep-2016";
const REPORTING_DATE_LABEL = "06-Sep-2016";
const OPERATOR_OPTIONS = ["Greater Than", "Less Than", "Equal To"];
const MIS_DATE_GROUPS = [
  { key: "2016-09-01", label: "01-Sep-2016" },
  { key: "2016-09-02", label: "02-Sep-2016" },
  { key: "2016-09-03", label: "03-Sep-2016" },
  { key: "2016-09-04", label: "04-Sep-2016" },
  { key: "2016-09-05", label: "05-Sep-2016" },
  { key: "2016-09-06", label: "06-Sep-2016" },
];
const MIS_SUB_COLUMNS = [
  { key: "peak", label: "KM's Driven Peak" },
  { key: "offPeak", label: "KM's Driven Off Peak" },
  { key: "total", label: "Total KM's In a Day" },
];
const SHEET_NOTES = [
  '"Parked" in case of vehicle available at centre and shows zero running.',
  '"UM" for Under Maintenance.',
  '"TNI" for Tracker Not Installed.',
  '"TR" for Tracker Removed.',
  '"TNR" for tracker not reporting.',
];

const MIS_SOURCE_ROWS = [
  {
    company: "KE",
    serial: 1,
    object: "Z-6659",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Car",
    group: "Distribution",
    branch: "Region-II",
    department: "IBC-SADDAR",
    subDepartment: "Saddar-Revenue Protection & Recovery",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: 20.094, offPeak: 11.008, total: 31.102 },
      "2016-09-02": { peak: 20.094, offPeak: 11.008, total: 31.102 },
      "2016-09-03": { peak: 60.193, offPeak: "Parked", total: 60.193 },
      "2016-09-04": { peak: 35.923, offPeak: "Parked", total: 35.923 },
      "2016-09-05": { peak: 47.032, offPeak: 13.701, total: 60.733 },
      "2016-09-06": { peak: 31.119, offPeak: 19.992, total: 51.111 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0.07708333333333334,
    stopTime: 0.9229166666666666,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 2,
    object: "CR-9847",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Van",
    group: "Distribution",
    branch: "Region-II",
    department: "IBC-DEFENCE",
    subDepartment: "Defence-Maintenance & Complaint",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-02": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-03": { peak: 6.655, offPeak: "Parked", total: 6.655 },
      "2016-09-04": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-05": { peak: 7.905, offPeak: "Parked", total: 7.905 },
      "2016-09-06": { peak: 7.328, offPeak: 6.564, total: 13.892 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 2,
    travelTime: 0.02152777777777778,
    stopTime: 0.9784722222222222,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 3,
    object: "CN-8411",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Pickup",
    group: "Distribution",
    branch: "Region-I",
    department: "IBC-SITE",
    subDepartment: "SITE-Revenue Protection & Recovery",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-02": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-03": { peak: 19.154, offPeak: 11.483, total: 30.637 },
      "2016-09-04": { peak: 17.972, offPeak: "Parked", total: 17.972 },
      "2016-09-05": { peak: 9.994, offPeak: 2.925, total: 12.919 },
      "2016-09-06": { peak: 14.911, offPeak: "Parked", total: 14.911 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 4,
    travelTime: 0.018055555555555557,
    stopTime: 0.9819444444444444,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 4,
    object: "CN-2604",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Pickup",
    group: "Distribution",
    branch: "Region-III",
    department: "IBC-BIN QASIM",
    subDepartment: "BIN QASIM-Customer Accounts",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: 26.999, offPeak: "Parked", total: 26.999 },
      "2016-09-02": { peak: 26.999, offPeak: "Parked", total: 26.999 },
      "2016-09-03": { peak: 28.364, offPeak: "Parked", total: 28.364 },
      "2016-09-04": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-05": { peak: 2.655, offPeak: "Parked", total: 2.655 },
      "2016-09-06": { peak: 12.054, offPeak: "Parked", total: 12.054 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0.011805555555555555,
    stopTime: 0.9881944444444445,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 5,
    object: "CN-7875",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Pickup",
    group: "Distribution",
    branch: "Region-IV",
    department: "Region-IV",
    subDepartment: "Region-IV",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-02": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-03": { peak: 37.981, offPeak: "Parked", total: 37.981 },
      "2016-09-04": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-05": { peak: "Parked", offPeak: "Parked", total: "Parked" },
      "2016-09-06": { peak: "Parked", offPeak: "Parked", total: "Parked" },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0,
    stopTime: 1,
    remarks: "Parked",
  },
  {
    company: "KE",
    serial: 6,
    object: "CR-3328",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Pickup",
    group: "Distribution",
    branch: "Region-IV",
    department: "Region-IV",
    subDepartment: "Region-IV",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: "UM", offPeak: "UM", total: "UM" },
      "2016-09-02": { peak: "UM", offPeak: "UM", total: "UM" },
      "2016-09-03": { peak: "UM", offPeak: "UM", total: "UM" },
      "2016-09-04": { peak: "UM", offPeak: "UM", total: "UM" },
      "2016-09-05": { peak: "UM", offPeak: "UM", total: "UM" },
      "2016-09-06": { peak: "UM", offPeak: "UM", total: "UM" },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0,
    stopTime: 1,
    remarks: "Under Maintenance",
  },
  {
    company: "KE",
    serial: 7,
    object: "CN-2754",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Pickup",
    group: "Distribution",
    branch: "Region-I",
    department: "IBC-SITE",
    subDepartment: "IBC-SITE",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: 24.866, offPeak: "Parked", total: 24.866 },
      "2016-09-02": { peak: 24.866, offPeak: "Parked", total: 24.866 },
      "2016-09-03": { peak: 31.114, offPeak: "Parked", total: 31.114 },
      "2016-09-04": { peak: 1.238, offPeak: "Parked", total: 1.238 },
      "2016-09-05": { peak: 73.735, offPeak: 3.275, total: 77.01 },
      "2016-09-06": { peak: 14.369, offPeak: "Parked", total: 14.369 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0.024305555555555556,
    stopTime: 0.9756944444444444,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 8,
    object: "CJ-9403",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Van",
    group: "Supply Chain",
    branch: "Supply Chain",
    department: "Supply Chain",
    subDepartment: "Fleet Management",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: 33.825, offPeak: "Parked", total: 33.825 },
      "2016-09-02": { peak: 33.825, offPeak: "Parked", total: 33.825 },
      "2016-09-03": { peak: 37.973, offPeak: 10.114, total: 48.087 },
      "2016-09-04": { peak: "Parked", offPeak: 1.09, total: 1.09 },
      "2016-09-05": { peak: 75.606, offPeak: 3.44, total: 79.046 },
      "2016-09-06": { peak: 30.833, offPeak: 9.818, total: 40.651 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0.05902777777777778,
    stopTime: 0.9409722222222222,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 9,
    object: "CN-2368",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Pickup",
    group: "Distribution",
    branch: "Region-I",
    department: "IBC-ORANGI-II",
    subDepartment: "Orangi-II Revenue Protection & Recovery",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: 68.587, offPeak: 16.068, total: 84.655 },
      "2016-09-02": { peak: 68.587, offPeak: 16.068, total: 84.655 },
      "2016-09-03": { peak: 55.824, offPeak: 35.436, total: 91.26 },
      "2016-09-04": { peak: 5.156, offPeak: 17.728, total: 22.884 },
      "2016-09-05": { peak: 27.897, offPeak: 6.496, total: 34.393 },
      "2016-09-06": { peak: 39.606, offPeak: 21.533, total: 61.139 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0.08888888888888889,
    stopTime: 0.9111111111111111,
    remarks: "Reporting",
  },
  {
    company: "KE",
    serial: 10,
    object: "CJ-0573",
    ownership: "Own",
    vendor: "KE",
    trackerCompany: "Tracking World",
    vehicleType: "Van",
    group: "Distribution",
    branch: "Region-II",
    department: "IBC-HT-NW-R2",
    subDepartment: "VIBC-HT-NW-Operation-R2",
    shiftHours: 24,
    shiftTiming: "07:00 AM to 07:00 AM",
    roadStatus: "On Road",
    dayMetrics: {
      "2016-09-01": { peak: 31.686, offPeak: 10.297, total: 41.983 },
      "2016-09-02": { peak: 31.686, offPeak: 10.297, total: 41.983 },
      "2016-09-03": { peak: 28.431, offPeak: 10.519, total: 38.95 },
      "2016-09-04": { peak: 1.51, offPeak: 5.015, total: 6.525 },
      "2016-09-05": { peak: 49.617, offPeak: 1.138, total: 50.755 },
      "2016-09-06": { peak: 7.766, offPeak: 2.003, total: 9.769 },
    },
    excessIdling: 0,
    harshBraking: 0,
    speedViolation: 0,
    travelTime: 0.011805555555555555,
    stopTime: 0.9881944444444445,
    remarks: "Reporting",
  },
];

const LEAD_COLUMNS = [
  { key: "serial", label: "S.No", width: "70px" },
  { key: "object", label: "Vehicle No.", width: "110px" },
  { key: "ownership", label: "Hired / Own", width: "96px" },
  { key: "model", label: "Vendor", width: "88px" },
  { key: "brand", label: "Tracker Company", width: "120px" },
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

function getMonthLabel(monthValue) {
  const [year, month] = String(monthValue || REPORT_REFERENCE_MONTH)
    .split("-")
    .map((value) => Number(value) || 0);
  const monthDate = new Date(year || 2016, Math.max(0, (month || 1) - 1), 1);
  return monthDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function toNumericMetric(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function compareValue(operator, source, target) {
  if (!Number.isFinite(target)) return true;
  if (operator === "Less Than") return source < target;
  if (operator === "Equal To") return source === target;
  return source > target;
}

function formatDistanceMetric(value, roundOff = false) {
  if (typeof value === "string" && value.trim()) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (roundOff) return Math.round(numeric).toLocaleString("en-US");
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
    if (normalized === "parked") return "status";
    if (normalized === "um") return "maintenance";
    return "status";
  }
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return "zero";
  if (subKey === "total") return "total";
  return "active";
}

function buildPreparedRows() {
  return MIS_SOURCE_ROWS.map((row) => {
    const dayMetrics = { ...row.dayMetrics };
    const accumulatedPeak = MIS_DATE_GROUPS.reduce(
      (sum, group) => sum + toNumericMetric(dayMetrics[group.key]?.peak),
      0
    );
    const accumulatedOffPeak = MIS_DATE_GROUPS.reduce(
      (sum, group) => sum + toNumericMetric(dayMetrics[group.key]?.offPeak),
      0
    );
    const accumulatedTotal = MIS_DATE_GROUPS.reduce(
      (sum, group) => sum + toNumericMetric(dayMetrics[group.key]?.total),
      0
    );

    return {
      company: row.company,
      serial: row.serial,
      object: row.object,
      ownership: row.ownership,
      model: row.vendor,
      brand: row.trackerCompany,
      vehicleType: row.vehicleType,
      group: row.group,
      branch: row.branch,
      department: row.department,
      subDepartment: row.subDepartment,
      shiftHours: row.shiftHours,
      shiftTiming: row.shiftTiming,
      roadStatus: row.roadStatus,
      dayMetrics,
      accumulatedPeak,
      accumulatedOffPeak,
      accumulatedTotal,
      excessIdling: row.excessIdling,
      harshBraking: row.harshBraking,
      speedViolation: row.speedViolation,
      travelTime: row.travelTime,
      stopTime: row.stopTime,
      remarks: row.remarks,
    };
  });
}

function buildInitialFilters(rows) {
  return {
    company: "All",
    month: REPORT_REFERENCE_MONTH,
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
  const [appliedRows, setAppliedRows] = useState(preparedRows);
  const [statusText, setStatusText] = useState(
    "Loaded dummy Daywise Distance MIS data modeled from the shared Excel sheet."
  );
  const [reportQuickScope, setReportQuickScope] = useState("All");
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
  const trackerCompanyOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.brand)))],
    [preparedRows]
  );
  const vendorOptions = useMemo(
    () => ["All", ...Array.from(new Set(preparedRows.map((row) => row.model)))],
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
      if (!compareValue(filters.distanceOperator, row.accumulatedTotal, distanceTarget)) return false;
      return true;
    });

    setAppliedRows(nextRows);
    setStatusText(
      nextStatus ||
        `${nextRows.length} record(s) loaded for ${getMonthLabel(filters.month)} in sheet-style Daywise MIS format.`
    );
  };

  const handleSaveFilter = () => {
    applyFilters("Daywise Distance filters applied to the MIS dummy dataset.");
  };

  const handleDeleteFilter = () => {
    const nextFilters = buildInitialFilters(preparedRows);
    setFilters(nextFilters);
    setAppliedRows(preparedRows);
    setStatusText("Daywise Distance filters reset to the default MIS dummy view.");
  };

  const triggerUtilityAction = (label) => {
    setStatusText(`${label} is available in the Daywise Distance MIS workspace.`);
  };

  const rangeLabel = `${REPORT_PERIOD_LABEL} • ${getMonthLabel(filters.month)} MIS`;

  const exportHeaders = useMemo(() => {
    const leadHeaders = LEAD_COLUMNS.map((column) => column.label);
    const dateHeaders = MIS_DATE_GROUPS.flatMap((group) =>
      MIS_SUB_COLUMNS.map((metric) => `${group.label} - ${metric.label}`)
    );
    const tailHeaders = [
      "Accumulated KM's in Peak Hours",
      "Accumulated KM's in Off Hours",
      "Accumulated KM's Total",
      "Excess Idling",
      "Harsh Braking",
      "Speed Violation",
      "Travel Time",
      "Stop Time",
      "Remarks",
    ];
    return [...leadHeaders, ...dateHeaders, ...tailHeaders];
  }, []);

  const exportRows = useMemo(() => {
    return appliedRows.map((row) => [
      row.serial,
      row.object,
      row.ownership,
      row.model,
      row.brand,
      row.vehicleType,
      row.group,
      row.branch,
      row.department,
      row.subDepartment,
      row.shiftHours,
      row.shiftTiming,
      row.roadStatus,
      ...MIS_DATE_GROUPS.flatMap((group) => {
        const metrics = row.dayMetrics[group.key] || {};
        return [
          formatDistanceMetric(metrics.peak, filters.roundOff),
          formatDistanceMetric(metrics.offPeak, filters.roundOff),
          formatDistanceMetric(metrics.total, filters.roundOff),
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
  }, [appliedRows, filters.roundOff]);

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
      const content = [exportHeaders.join("\t"), ...exportRows.map((row) => row.join("\t"))].join("\n");
      downloadFile("daywise-distance-mis.xls", content, "application/vnd.ms-excel");
      return;
    }

    const rowsHtml = exportRows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=1440,height=900");
    if (!printWindow) return;
    printWindow.document.write(
      `<html><head><title>Daywise Distance MIS</title><style>body{font-family:Arial,sans-serif;padding:18px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #8f9aa5;padding:4px 6px;text-align:left;vertical-align:top}th{background:#d4d9de}h1{margin-bottom:6px}p{margin:4px 0 14px}</style></head><body><h1>Daywise Distance MIS</h1><p>${rangeLabel}</p><table><thead><tr>${exportHeaders
        .map((header) => `<th>${header}</th>`)
        .join("")}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const footerRecordText = appliedRows.length ? `1-${appliedRows.length} (${appliedRows.length})` : "0-0 (0)";

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
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Search")}
              aria-label="Search"
            >
              <FaSearch />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Favorite")}
              aria-label="Favorite"
            >
              <FaStar />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Filter")}
              aria-label="Filter"
            >
              <FaFilter />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Calendar")}
              aria-label="Calendar"
            >
              <FaCalendarAlt />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Settings")}
              aria-label="Settings"
            >
              <FaCog />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Chart")}
              aria-label="Chart"
            >
              <FaChartBar />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => triggerUtilityAction("Help")}
              aria-label="Help"
            >
              <FaQuestionCircle />
            </button>
          </div>
        </section>

        <section className={`${styles.layout} ${styles.layoutResult}`}>
          <div className={`${styles.resultsArea} ${styles.resultsAreaResult}`}>
            <div className={styles.daywiseIntroCard}>
              <div className={styles.daywiseIntroMeta}>
                <span>
                  <strong>CLIENT:</strong> KE
                </span>
                <span>
                  <strong>REPORT PERIOD:</strong> {REPORT_PERIOD_LABEL}
                </span>
                <span>
                  <strong>REPORTING DATE:</strong> {REPORTING_DATE_LABEL}
                </span>
              </div>
              <div className={styles.daywiseIntroNotes}>
                {SHEET_NOTES.map((note) => (
                  <span key={note} className={styles.daywiseNoteChip}>
                    {note}
                  </span>
                ))}
              </div>
            </div>

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
                    {MIS_DATE_GROUPS.flatMap((group) =>
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
                      {MIS_DATE_GROUPS.map((group, index) => (
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
                      {MIS_DATE_GROUPS.flatMap((group, groupIndex) =>
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
                    {appliedRows.length ? (
                      appliedRows.map((row) => (
                        <tr key={row.object} className={styles.activeMainRow}>
                          {LEAD_COLUMNS.map((column) => (
                            <td
                              key={`${row.object}-${column.key}`}
                              className={column.key === "serial" ? styles.numericCell : ""}
                            >
                              {row[column.key]}
                            </td>
                          ))}
                          {MIS_DATE_GROUPS.flatMap((group) =>
                            MIS_SUB_COLUMNS.map((metric) => {
                              const value = row.dayMetrics[group.key]?.[metric.key];
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
                                  {formatDistanceMetric(value, filters.roundOff)}
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
                            MIS_DATE_GROUPS.length * MIS_SUB_COLUMNS.length +
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
                <button
                  type="button"
                  className={styles.reportToolLabelButton}
                  onClick={() => handleExport("XLS")}
                  aria-label="Export XLS"
                >
                  <FaSyncAlt size={12} />
                  <span>XLS</span>
                </button>
                <button
                  type="button"
                  className={styles.reportToolLabelButton}
                  onClick={() => handleExport("PDF")}
                  aria-label="Export PDF"
                >
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
                <select className={styles.reportMiniSelect} defaultValue="20">
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <div className={styles.reportPager}>
                  <button
                    type="button"
                    className={styles.reportPagerButton}
                    aria-label="Previous page"
                  >
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
          </div>

          <aside className={styles.filterPanel}>
            <div className={styles.filterGrid}>
              <div className={styles.filterColumn}>
                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Company :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.company}
                    onChange={(event) => handleFilterChange("company", event.target.value)}
                  >
                    {companyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>BU / Function :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.branch}
                    onChange={(event) => handleFilterChange("branch", event.target.value)}
                  >
                    {branchOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Group :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.vehicleGroup}
                    onChange={(event) => handleFilterChange("vehicleGroup", event.target.value)}
                  >
                    {vehicleGroupOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Category :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.vehicleType}
                    onChange={(event) => handleFilterChange("vehicleType", event.target.value)}
                  >
                    {vehicleTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Tracker Company :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.vehicleBrand}
                    onChange={(event) => handleFilterChange("vehicleBrand", event.target.value)}
                  >
                    {trackerCompanyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Vendor :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.vehicleModel}
                    onChange={(event) => handleFilterChange("vehicleModel", event.target.value)}
                  >
                    {vendorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterBlock}>
                  <label className={styles.filterLabel}>Accumulated Distance :</label>
                  <select
                    className={styles.filterControl}
                    value={filters.distanceOperator}
                    onChange={(event) =>
                      handleFilterChange("distanceOperator", event.target.value)
                    }
                  >
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
                      onChange={(event) =>
                        handleFilterChange("roundOff", event.target.checked)
                      }
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
                      onChange={(event) =>
                        handleFilterChange("timeRangeEnabled", event.target.checked)
                      }
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
                        onChange={(event) =>
                          handleFilterChange("objectSearch", event.target.value)
                        }
                        className={styles.searchInput}
                        placeholder="Search"
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.refreshTreeButton}
                      onClick={() => setStatusText("Vehicle tree refreshed.")}
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
                              onChange={(event) =>
                                toggleBranchObjects(branch, event.target.checked)
                              }
                            />
                            <span>{branch}</span>
                          </label>
                          <div className={styles.treeChildren}>
                            {objects.map((object) => (
                              <label
                                key={object}
                                className={`${styles.checkRow} ${styles.treeLevel2}`}
                              >
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
                  <button
                    type="button"
                    className={`${styles.footerButton} ${styles.secondaryActionButton}`}
                    onClick={handleSaveFilter}
                  >
                    Save Filter
                  </button>
                  <button
                    type="button"
                    className={`${styles.footerButton} ${styles.dangerActionButton}`}
                    onClick={handleDeleteFilter}
                  >
                    Delete Filter
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
        </section>
      </main>
    </>
  );
}
