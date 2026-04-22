"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FaBell,
  FaCar,  
  FaCommentDots,
  FaChevronRight,
  FaClipboardList,
  FaDollarSign,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaGasPump,
  FaListAlt,
  FaMapMarkerAlt,
  FaRegDotCircle,
  FaRegClock,
  FaRoad,
  FaSatellite,
  FaShoppingBag,
  FaThermometerHalf,
  FaTachometerAlt,
  FaTools,
  FaLock,
} from "react-icons/fa";
import styles from "./Sidebar.module.css";
import { navigateWithTransition } from "@/lib/navigation";
import { useNavigationProgress } from "@/components/NavigationProgress";
import { useMapData } from "@/app/fleet-dashboard/useMapData";
import { hasAnyMenuAction } from "@/lib/rbacAccess";
import { useRbacSession } from "@/lib/useRbacAccess";
import {
  buildDirectAccessMenu,
  buildLegacyChartMenu,
  buildLegacyComplaintMenu,
  buildLegacyReportMenu,
  buildLegacySettingMenu,
  buildNestedAccessMenu,
  hasActionableItems,
  inferGroup,
  normalizeMenuAccessItems,
} from "@/lib/sidebarConfig";
import { customerSettingsModuleItems } from "@/lib/customerSettingsModules";

import logo from "../../public/icons/KE.webp";
import dashboard from "../../public/icons/Group-3.png";
import tracking from "../../public/icons/Group-2.png";
import report from "../../public/icons/Vector-1.png";
import chart from "../../public/icons/Group.png";
import complain from "../../public/icons/complain.png";
import setting from "../../public/icons/Group-1.png";
import toggleIcon from "../../public/icons/Vector.png";

const loadPanelsModule = () => import("./Panels");

function DashboardPanelLoadingState({ message = "Loading panel data..." }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        borderRadius: "8px 8px 0 0",
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "16px",
        color: "#1f2937",
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      <span className={styles.navInlineLoader} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

const Panels = dynamic(loadPanelsModule, {
  ssr: false,
  loading: () => <DashboardPanelLoadingState message="Opening panel..." />,
});

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: dashboard },
  { id: "tracking", label: "Tracking", icon: tracking },
  { id: "report", label: "Report", icon: report },
  { id: "chart", label: "Chart", icon: chart },
  { id: "complain", label: "Complaint", icon: complain },
  { id: "setting", label: "Setting", icon: setting },
];

const routeMap = {
  dashboard: "/dashboard",
  tracking: "/tracking",
  report: "#",
  chart: "#",
  setting: "#",
  complain: "#",
};

const pathToItem = {
  "/": "tracking",
  "/dashboard": "dashboard",
  "/tracking": "tracking",
  "/settings": "setting",
  "/client-management": "setting",
  "/report": "report",
  "/chart": "chart",
  "/setting": "setting",
  "/complain": "complain",
};

customerSettingsModuleItems.forEach((item) => {
  pathToItem[item.href] = "setting";
});

const reportMenuItems = [
  { type: "section", sectionLabel: "Reports" },
  {
    key: "activity",
    label: "Activity",
    Icon: FaRegDotCircle,
    href: "/report/activity",
    subItems: [
      { label: "Detail Activity Report", href: "/report/activity/detail-activity-report" },
      { label: "Travel", href: "/report/activity/travel" },
      { label: "Trip", href: "/report/activity/trip" },
      { label: "Stoppage", href: "/report/activity/stoppage" },
      { label: "Over Speed Summary", href: "/report/activity/over-speed-summary" },
      { label: "Idle", href: "/report/activity/idle" },
      { label: "Inactive", href: "/report/activity/inactive" },
      { label: "Speed vs Distance", href: "/report/activity/speed-vs-distance" },
      { label: "Object Status", href: "/report/activity/object-status" },
      { label: "Over Speeding Report", href: "/report/activity/over-speeding-report" },
      { label: "Daywise Distance", href: "/report/activity/daywise-distance" },
      { label: "Daywise Work Hour", href: "/report/activity/daywise-work-hour" },
    ],
  },
  {
    key: "geofence-address",
    label: "Geofence-Address",
    Icon: FaMapMarkerAlt,
    href: "/report/geofence-address",
    subItems: [
      { label: "Address", href: "/report/geofence-address/address" },
      { label: "Fence Inside Travel Report", href: "/report/geofence-address/fence-inside-travel-report" },
      { label: "Fence Outside Travel Report", href: "/report/geofence-address/fence-outside-travel-report" },
      { label: "Geofence To Geofence Trip", href: "/report/geofence-address/geofence-to-geofence-trip" },
      { label: "Geofence Visited Summary", href: "/report/geofence-address/geofence-visited-summary" },
      { label: "Geofence Address", href: "/report/geofence-address/geofence-address" },
      { label: "Address Wise", href: "/report/geofence-address/address-wise" },
    ],
  },
  {
    key: "sensor",
    label: "Sensor",
    Icon: FaSatellite,
    href: "/report/sensor",
    subItems: [
      { label: "Ignition", href: "/report/sensor/ignition" },
      { label: "Air Conditioner", href: "/report/sensor/air-conditioner" },
      { label: "Air Conditioner Misused", href: "/report/sensor/air-conditioner-misused" },
      { label: "Analog Data", href: "/report/sensor/analog-data" },
      { label: "RFID Data", href: "/report/sensor/rfid-data" },
      { label: "Digital Ports", href: "/report/sensor/digital-ports" },
    ],
  },
  {
    key: "alert",
    label: "Alert",
    Icon: FaExclamationTriangle,
    href: "/report/alert",
    subItems: [
      { label: "Object Alert", href: "/report/alert/object-alert" },
      { label: "Driver Alert", href: "/report/alert/driver-alert" },
      { label: "SMS - Email Status", href: "/report/alert/sms-email-status" },
      { label: "Alert Status", href: "/report/alert/alert-status" },
    ],
  },
  {
    key: "reminder",
    label: "Reminder",
    Icon: FaBell,
    href: "/report/reminder",
    subItems: [
      { label: "Reminder Status", href: "/report/reminder/reminder-status" },
      { label: "Acknowledgment History", href: "/report/reminder/acknowledgment-history" },
    ],
  },
  {
    key: "expense",
    label: "Expense",
    Icon: FaDollarSign,
    href: "/report/expense",
    subItems: [
      { label: "Expense", href: "/report/expense/expense" },
      { label: "Object Course", href: "/report/expense/object-course" },
      { label: "Maintenance History", href: "/report/expense/maintenance-history" },
      { label: "Category Wise Expense", href: "/report/expense/category-wise-expense" },
    ],
  },
  {
    key: "fuel",
    label: "Fuel",
    Icon: FaGasPump,
    href: "/report/fuel",
    subItems: [
      { label: "Fill - Drain", href: "/report/fuel/fill-drain" },
      { label: "Fuel Economy", href: "/report/fuel/fuel-economy" },
      { label: "Fuel Trip Cost", href: "/report/fuel/fuel-trip-cost" },
      { label: "AC Fuel Usage Summary", href: "/report/fuel/ac-fuel-usage-summary" },
      { label: "AC Fuel Summary", href: "/report/fuel/ac-fuel-summary" },
    ],
  },
  {
    key: "rpm",
    label: "RPM",
    Icon: FaTachometerAlt,
    href: "/report/rpm",
    subItems: [
      { label: "RPM Status", href: "/report/rpm/rpm-status" },
      { label: "RPM Summary", href: "/report/rpm/rpm-summary" },
    ],
  },
  {
    key: "temperature",
    label: "Temperature",
    Icon: FaThermometerHalf,
    href: "/report/temperature",
    subItems: [
      { label: "Temperature Status", href: "/report/temperature/temperature-status" },
      { label: "Temperature Summary", href: "/report/temperature/temperature-summary" },
      { label: "Temperature Daily Summary", href: "/report/temperature/temperature-daily-summary" },
    ],
  },
  {
    key: "job",
    label: "Job",
    Icon: FaShoppingBag,
    href: "/report/job",
    subItems: [
      { label: "Today's Job Status", href: "/report/job/todays-job-status" },
      { label: "Job Summary", href: "/report/job/job-summary" },
      { label: "Object Job Summary", href: "/report/job/object-job-summary" },
      { label: "Driver Job Summary", href: "/report/job/driver-job-summary" },
      { label: "Job Fuel Summary", href: "/report/job/job-fuel-summary" },
    ],
  },
  {
    key: "e-lock",
    label: "E-lock",
    Icon: FaLock,
    href: "/report/e-lock",
    subItems: [
      { label: "Relock Status", href: "/report/e-lock/relock-status" },
      { label: "Violation Summary", href: "/report/e-lock/violation-summary" },
      { label: "Lock Unlock Summary", href: "/report/e-lock/lock-unlock-summary" },
    ],
  },
  {
    key: "tire",
    label: "Tire",
    Icon: FaRegDotCircle,
    href: "/report/tire",
    subItems: [
      { label: "Tire Status", href: "/report/tire/tire-status" },
      { label: "Tire Event Summary", href: "/report/tire/tire-event-summary" },
      { label: "Object Tire", href: "/report/tire/object-tire" },
      { label: "Tire Pressure Report", href: "/report/tire/tire-pressure-report" },
    ],
  },
  {
    key: "driver-behavior",
    label: "Driver Behavior",
    Icon: FaRoad,
    href: "/report/driver-behavior",
    subItems: [
      { label: "Driver Performance", href: "/report/driver-behavior/driver-performance" },
    ],
  },
  {
    key: "obd",
    label: "OBD",
    Icon: FaCar,
    href: "/report/obd",
    subItems: [
      { label: "Health Status", href: "/report/obd/health-status" },
      { label: "Engine Temperature", href: "/report/obd/engine-temperature" },
    ],
  },
  {
    key: "trip-classification",
    label: "Trip Classification",
    Icon: FaListAlt,
    href: "/report/trip-classification",
    subItems: [
      { label: "Trip Classification", href: "/report/trip-classification/trip-classification" },
    ],
  },
  {
    key: "billing",
    label: "Billing",
    Icon: FaFileInvoiceDollar,
    href: "/report/billing",
    subItems: [
      { label: "Payment Details", href: "/report/billing/payment-details" },
      { label: "Postpaid Billing History", href: "/report/billing/postpaid-billing-history" },
      { label: "Object Expiry Log", href: "/report/billing/object-expiry-log" },
      { label: "Admin Wise Object", href: "/report/billing/admin-wise-object" },
    ],
  },
  {
    key: "logs",
    label: "Logs",
    Icon: FaClipboardList,
    href: "/report/logs",
    subItems: [
      { label: "User Access", href: "/report/logs/user-access" },
      { label: "User Email Status", href: "/report/logs/user-email-status" },
      { label: "User Detail", href: "/report/logs/user-detail" },
      { label: "System Log", href: "/report/logs/system-log" },
      { label: "Device Log", href: "/report/logs/device-log" },
      { label: "Announcement", href: "/report/logs/announcement" },
    ],
  },
];

const chartMenuItems = [
  { type: "section", sectionLabel: "Charts" },
  {
    key: "activity",
    label: "Activity",
    Icon: FaRegDotCircle,
    href: "/chart/activity",
    subItems: [
      { label: "Distance", href: "/chart/activity/distance" },
      { label: "Duration", href: "/chart/activity/duration" },
      { label: "Speed Vs Time", href: "/chart/activity/speed-vs-time" },
      { label: "Battery Voltage", href: "/chart/activity/battery-voltage" },
    ],
  },
  {
    key: "alert",
    label: "Alert",
    Icon: FaExclamationTriangle,
    href: "/chart/alert",
    subItems: [{ label: "Alert", href: "/chart/alert/alert" }],
  },
  {
    key: "fuel",
    label: "Fuel",
    Icon: FaGasPump,
    href: "/chart/fuel",
    subItems: [
      { label: "Fill - Drain", href: "/chart/fuel/fill-drain" },
      { label: "Fuel Economy", href: "/chart/fuel/fuel-economy" },
    ],
  },
  {
    key: "expense",
    label: "Expense",
    Icon: FaDollarSign,
    href: "/chart/expense",
    subItems: [
      { label: "Cost Distribution", href: "/chart/expense/cost-distribution" },
      { label: "Cost By Time", href: "/chart/expense/cost-by-time" },
    ],
  },
  {
    key: "tire",
    label: "Tire",
    Icon: FaRegDotCircle,
    href: "/chart/tire",
    subItems: [
      { label: "Tire Fitment", href: "/chart/tire/tire-fitment" },
      { label: "Brand Wise Tire Fitment", href: "/chart/tire/brand-wise-tire-fitment" },
      { label: "Tire Inspection", href: "/chart/tire/tire-inspection" },
      { label: "Brand Wise Distance / MM", href: "/chart/tire/brand-wise-distance-mm" },
      { label: "Brand Wise Project Management", href: "/chart/tire/brand-wise-project-management" },
    ],
  },
  {
    key: "temperature",
    label: "Temperature",
    Icon: FaThermometerHalf,
    href: "/chart/temperature",
    subItems: [{ label: "Temperature", href: "/chart/temperature/temperature" }],
  },
];

const settingMenuItems = [
  {
    type: "section",
    sectionLabel: "General",
  },
  {
    key: "general",
    label: "General",
    description: "Application-level preferences",
    Icon: FaTools,
    href: "/settings",
  },
  {
    type: "section",
    sectionLabel: "Master Data",
  },
  {
    key: "organization",
    label: "Organization",
    description: "Manage organization-level structure",
    Icon: FaRegDotCircle,
    href: "/organization",
  },
  {
    key: "company",
    label: "Company",
    description: "Manage company-level setup",
    Icon: FaRegDotCircle,
    href: "/company",
  },
  {
    key: "branch",
    label: "Branch",
    description: "Manage branch-level setup",
    Icon: FaRegDotCircle,
    href: "/branch",
  },
  {
    key: "vehicle",
    label: "Vehicle",
    description: "Manage vehicle records",
    Icon: FaCar,
    href: "/vehicle",
  },
  {
    key: "vehiclegroup",
    label: "Vehicle Group",
    description: "Group vehicles by operation",
    Icon: FaListAlt,
    href: "/vehiclegroup",
  },
];

const complaintMenuItems = [
  { type: "section", sectionLabel: "Complaint" },
  {
    key: "new-complaint",
    label: "New Complaint",
    Icon: FaCommentDots,
    href: "/complain/new-complaint",
    subItems: [
      { label: "Create Ticket", href: "/complain/new-complaint/create-ticket" },
      { label: "Assign Priority", href: "/complain/new-complaint/assign-priority" },
      { label: "Attach Evidence", href: "/complain/new-complaint/attach-evidence" },
      { label: "Complaint Category", href: "/complain/new-complaint/complaint-category" },
    ],
  },
  {
    key: "open-tickets",
    label: "Open Tickets",
    Icon: FaRegClock,
    href: "/complain/open-tickets",
    subItems: [
      { label: "All Open", href: "/complain/open-tickets/all-open" },
      { label: "SLA Due Today", href: "/complain/open-tickets/sla-due-today" },
      { label: "Unassigned", href: "/complain/open-tickets/unassigned" },
      { label: "Waiting Customer", href: "/complain/open-tickets/waiting-customer" },
    ],
  },
  {
    key: "in-progress",
    label: "In Progress",
    Icon: FaTools,
    href: "/complain/in-progress",
    subItems: [
      { label: "Assigned to Me", href: "/complain/in-progress/assigned-to-me" },
      { label: "Team Queue", href: "/complain/in-progress/team-queue" },
      { label: "Follow-up Due", href: "/complain/in-progress/follow-up-due" },
      { label: "Pending Parts", href: "/complain/in-progress/pending-parts" },
    ],
  },
  {
    key: "resolved",
    label: "Resolved",
    Icon: FaRegDotCircle,
    href: "/complain/resolved",
    subItems: [
      { label: "Closed Today", href: "/complain/resolved/closed-today" },
      { label: "Closed This Week", href: "/complain/resolved/closed-this-week" },
      { label: "Customer Confirmed", href: "/complain/resolved/customer-confirmed" },
      { label: "Reopened Cases", href: "/complain/resolved/reopened-cases" },
    ],
  },
  {
    key: "escalated",
    label: "Escalated",
    Icon: FaExclamationTriangle,
    href: "/complain/escalated",
    subItems: [
      { label: "Level 1", href: "/complain/escalated/level-1" },
      { label: "Level 2", href: "/complain/escalated/level-2" },
      { label: "Critical Escalations", href: "/complain/escalated/critical-escalations" },
      { label: "Escalation History", href: "/complain/escalated/escalation-history" },
    ],
  },
  {
    key: "complaint-logs",
    label: "Complaint Logs",
    Icon: FaClipboardList,
    href: "/complain/complaint-logs",
    subItems: [
      { label: "Agent Activity Log", href: "/complain/complaint-logs/agent-activity-log" },
      { label: "Status Change Log", href: "/complain/complaint-logs/status-change-log" },
      { label: "SLA Breach Log", href: "/complain/complaint-logs/sla-breach-log" },
      { label: "Notification Log", href: "/complain/complaint-logs/notification-log" },
    ],
  },
];

const SidebarNavButton = React.memo(
  React.forwardRef(({ item, isActive, isLoading, isSubmenuTrigger, onClick, onHover }, ref) => {
    const isLink = !isSubmenuTrigger && routeMap[item.id] && routeMap[item.id] !== "#";

    const content = (
      <>
        <Image src={item.icon} alt={`${item.label} Icon`} width={24} height={24} />
        <span>{item.label}</span>
        {isLoading ? <span className={styles.navInlineLoader} aria-hidden="true" /> : null}
      </>
    );

    if (isLink) {
      return (
        <Link
          href={routeMap[item.id]}
          className={`${styles.menuLink} ${styles.menuButton} ${isActive ? styles.active : ""}`}
          onClick={(e) => onClick(item.id, e)}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        className={`${styles.menuLink} ${styles.menuButton} ${isActive ? styles.active : ""}`}
        onClick={(e) => onClick(item.id, e)}
        onPointerEnter={onHover ? () => onHover(item.id) : undefined}
      >
        {content}
      </button>
    );
  })
);
SidebarNavButton.displayName = "SidebarNavButton";

const pathnameMatchesHref = (pathname, href) => {
  if (!pathname || !href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
};

const Sidebar = ({
  isOpen = true,
  toggleSidebar = () => {},
  activeItem = null,
  setActiveItem = () => {},
  suppressActiveState = false,
  hideDashboardToggle = false,
  vehicles = null,
  isVehiclesLoading = null,
  isVehiclesRefreshing = null,
  vehiclesError = null,
  onRefreshVehicles = null,
  onMobileStatusFilterChange = null,
}) => {
  const SIDEBAR_WIDTH = 88;
  const router = useRouter();
  const pathname = usePathname();
  const { isNavigating } = useNavigationProgress();
  const { session, ready: accessReady, hasAssignedRoles } = useRbacSession();
  const routeActiveItem =
    pathToItem[pathname] ||
    (pathname.startsWith("/report/")
      ? "report"
      : pathname.startsWith("/chart/")
      ? "chart"
      : pathname.startsWith("/complain/")
      ? "complain"
      : pathname.startsWith("/client-management/")
      ? "setting"
      : "dashboard");
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [pendingSidebarHref, setPendingSidebarHref] = useState("");
  const [isDashboardPanelMounted, setIsDashboardPanelMounted] = useState(false);
  const [dashboardPanelWidth, setDashboardPanelWidth] = useState(500);
  const [submenuType, setSubmenuType] = useState(null);
  const [submenuTop, setSubmenuTop] = useState(240);
  const [submenuTrail, setSubmenuTrail] = useState([]);
  const reportTriggerRef = useRef(null);
  const chartTriggerRef = useRef(null);
  const complaintTriggerRef = useRef(null);
  const settingTriggerRef = useRef(null);
  const submenuPanelRef = useRef(null);
  const childPanelRefs = useRef([]);
  const submenuListRef = useRef(null);
  const instantNavLockRef = useRef(false);
  const sidebarWidth = isOpen ? SIDEBAR_WIDTH : 0;
  const panelWidth = dashboardPanelWidth;
  const panelTop = 8;
  const panelToggleTop = 84;
  const panelLeft = sidebarWidth;
  const toggleLeft = dashboardVisible ? panelLeft + panelWidth + 1 : sidebarWidth;
  const resolvedActiveItem = suppressActiveState
    ? null
    : submenuType || routeActiveItem || activeItem || null;
  const submenuLeft = useMemo(() => sidebarWidth - 8, [sidebarWidth]);
  const submenuWidth =
    submenuType === "chart"
      ? 250
      : submenuType === "setting"
      ? 260
      : submenuType === "complain"
      ? 260
      : 280;
  const childPanelWidth = submenuType === "setting" ? 260 : 270;
  const {
    allVehicles: internalPanelVehicles,
    isLoading: internalPanelVehiclesLoading,
    isRefreshing: internalPanelVehiclesRefreshing,
    error: internalPanelVehiclesError,
    fetchCompanyMapData: internalRefreshPanelVehicles,
  } = useMapData();
  const hasExternalVehicleSource = Array.isArray(vehicles);
  const panelVehicles = hasExternalVehicleSource ? vehicles : internalPanelVehicles;
  const isPanelVehiclesLoading =
    typeof isVehiclesLoading === "boolean" ? isVehiclesLoading : internalPanelVehiclesLoading;
  const isPanelVehiclesRefreshing =
    typeof isVehiclesRefreshing === "boolean"
      ? isVehiclesRefreshing
      : internalPanelVehiclesRefreshing;
  const panelVehiclesError = vehiclesError ?? internalPanelVehiclesError;
  const refreshPanelVehicles = onRefreshVehicles || internalRefreshPanelVehicles;
  const [preparedPanelVehicles, setPreparedPanelVehicles] = useState(() =>
    Array.isArray(panelVehicles) && panelVehicles.length > 0 ? [...panelVehicles] : []
  );
  const [preparedPanelVehiclesError, setPreparedPanelVehiclesError] = useState(panelVehiclesError ?? null);
  const [isPreparedPanelSnapshotStale, setIsPreparedPanelSnapshotStale] = useState(false);
  const [isInitialPanelSnapshotReady, setIsInitialPanelSnapshotReady] = useState(
    () =>
      !isPanelVehiclesLoading &&
      (((Array.isArray(panelVehicles) && panelVehicles.length > 0) || !!panelVehiclesError))
  );
  const [, startPanelSnapshotTransition] = useTransition();
  const normalizedMenuAccess = useMemo(
    () => normalizeMenuAccessItems(session?.menuAccess),
    [session?.menuAccess]
  );
  const useDynamicMenus = accessReady && normalizedMenuAccess.length > 0 && hasAssignedRoles;
  const accessGroups = useMemo(() => {
    return normalizedMenuAccess.reduce(
      (acc, item) => {
        const group = inferGroup(item);
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
      },
      { main: [], report: [], chart: [], complain: [], settings: [], "client-management": [] }
    );
  }, [normalizedMenuAccess]);
  const dynamicSettingMenuItems = useMemo(() => {
    const sections = buildLegacySettingMenu();
    if (accessGroups["client-management"].length) {
      sections.push(
        ...buildDirectAccessMenu(
          accessGroups["client-management"],
          "Client Management",
          "client-management"
        )
      );
    }
    return sections;
  }, [accessGroups]);
  const reportSubmenuItems = useMemo(
    () =>
      useDynamicMenus
        ? buildNestedAccessMenu(accessGroups.report, "Reports", "report")
        : buildLegacyReportMenu(),
    [accessGroups.report, useDynamicMenus]
  );
  const chartSubmenuItems = useMemo(
    () =>
      useDynamicMenus
        ? buildNestedAccessMenu(accessGroups.chart, "Charts", "chart")
        : buildLegacyChartMenu(),
    [accessGroups.chart, useDynamicMenus]
  );
  const complaintSubmenuItems = useMemo(
    () =>
      useDynamicMenus
        ? buildNestedAccessMenu(accessGroups.complain, "Complaint", "complain")
        : buildLegacyComplaintMenu(),
    [accessGroups.complain, useDynamicMenus]
  );
  const settingSubmenuItems = useMemo(
    () => (useDynamicMenus ? dynamicSettingMenuItems : buildLegacySettingMenu()),
    [dynamicSettingMenuItems, useDynamicMenus]
  );
  const activeSubmenuItems =
    submenuType === "chart"
      ? chartSubmenuItems
      : submenuType === "complain"
      ? complaintSubmenuItems
      : submenuType === "setting"
      ? settingSubmenuItems
      : reportSubmenuItems;

  useEffect(() => {
    if (isPanelVehiclesLoading) {
      if (preparedPanelVehicles.length === 0 && !preparedPanelVehiclesError) {
        setIsInitialPanelSnapshotReady(false);
      }
      return;
    }

    const nextVehicles = Array.isArray(panelVehicles) ? [...panelVehicles] : [];
    const nextError = panelVehiclesError ?? null;
    const shouldRetainLastGoodPanelSnapshot =
      preparedPanelVehicles.length > 0 && nextVehicles.length === 0;

    startPanelSnapshotTransition(() => {
      if (shouldRetainLastGoodPanelSnapshot) {
        setPreparedPanelVehiclesError(nextError);
        setIsPreparedPanelSnapshotStale(true);
        setIsInitialPanelSnapshotReady(true);
        return;
      }

      setPreparedPanelVehicles(nextVehicles);
      setPreparedPanelVehiclesError(nextError);
      setIsPreparedPanelSnapshotStale(false);
      setIsInitialPanelSnapshotReady(true);
    });
  }, [
    isPanelVehiclesLoading,
    panelVehicles,
    panelVehiclesError,
    preparedPanelVehicles.length,
    preparedPanelVehiclesError,
    startPanelSnapshotTransition,
  ]);
  const visibleNavItems = useMemo(() => {
    if (!useDynamicMenus) return navItems;
    return navItems.filter((item) => {
      if (item.id === "dashboard") return hasAnyMenuAction(session, ["dashboard"], "view");
      if (item.id === "tracking") return hasAnyMenuAction(session, ["tracking"], "view");
      if (item.id === "report") return hasActionableItems(reportSubmenuItems);
      if (item.id === "chart") return hasActionableItems(chartSubmenuItems);
      if (item.id === "complain") return hasActionableItems(complaintSubmenuItems);
      if (item.id === "setting") return hasActionableItems(settingSubmenuItems);
      return true;
    });
  }, [
    chartSubmenuItems,
    complaintSubmenuItems,
    reportSubmenuItems,
    session,
    settingSubmenuItems,
    useDynamicMenus,
  ]);

  useEffect(() => {
    if (!dashboardVisible) return undefined;
    if (hasExternalVehicleSource) return undefined;

    refreshPanelVehicles();
    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      refreshPanelVehicles();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [dashboardVisible, hasExternalVehicleSource, refreshPanelVehicles]);

  useEffect(() => {
    if (hideDashboardToggle || isDashboardPanelMounted || typeof window === "undefined") {
      return undefined;
    }

    let timeoutId = 0;
    let idleId = 0;
    const preloadPanels = () => {
      loadPanelsModule().catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(preloadPanels, { timeout: 1800 });
      return () => {
        if (idleId) window.cancelIdleCallback(idleId);
      };
    }

    timeoutId = window.setTimeout(preloadPanels, 900);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [hideDashboardToggle, isDashboardPanelMounted]);

  const updateSubmenuPosition = useCallback((type) => {
    const targetRef =
      type === "chart"
        ? chartTriggerRef.current
        : type === "complain"
        ? complaintTriggerRef.current
        : type === "setting"
        ? settingTriggerRef.current
        : reportTriggerRef.current;
    if (!targetRef) return;
    const rect = targetRef.getBoundingClientRect();
    const minTop = 80;
    const preferredTop = rect.top - (type === "setting" ? 32 : 8);
    if (typeof window === "undefined") {
      setSubmenuTop(Math.max(minTop, preferredTop));
      return;
    }

    const estimatedPanelHeight =
      type === "report" || type === "setting"
        ? Math.min(560, window.innerHeight - 96)
        : Math.min(420, window.innerHeight - 96);
    const maxTop = Math.max(minTop, window.innerHeight - estimatedPanelHeight - 12);
    const clampedTop = Math.min(Math.max(minTop, preferredTop), maxTop);
    setSubmenuTop(clampedTop);
  }, []);

  const handlePrimaryNavClick = useCallback(
    (itemId, event) => {
      if (submenuType) setSubmenuType(null);
      if (submenuTrail.length) setSubmenuTrail([]);

      const targetRoute = routeMap[itemId];
      if (!targetRoute || targetRoute === "#") {
        setActiveItem(itemId);
        // If it's not a link, we don't navigate
        return;
      }

      if (event && event.defaultPrevented) return;

      if (pathname === targetRoute) {
        setActiveItem(itemId);
        setPendingSidebarHref("");
        if (event) event.preventDefault();
        return;
      }

      setActiveItem(itemId);
      setPendingSidebarHref(targetRoute);
      if (event) event.preventDefault();
      navigateWithTransition(router, targetRoute);
    },
    [pathname, router, setActiveItem, submenuTrail.length, submenuType]
  );

  const handleSubmenuTriggerClick = useCallback(
    (itemId) => {
      setActiveItem(itemId);
      setSubmenuType((prev) => (prev === itemId ? null : itemId));
      setSubmenuTrail([]);
      updateSubmenuPosition(itemId);
    },
    [setActiveItem, updateSubmenuPosition]
  );

  const handleNavHover = useCallback(
    (itemId) => {
      const targetRoute = routeMap[itemId];
      if (targetRoute && targetRoute !== "#") {
        router.prefetch(targetRoute);
      }
    },
    [router]
  );

  const navigateInstant = useCallback(
    (href) => {
      if (!href || instantNavLockRef.current) return;
      instantNavLockRef.current = true;
      setSubmenuType(null);
      setSubmenuTrail([]);
      setPendingSidebarHref(href);
      router.prefetch(href);
      navigateWithTransition(router, href);
      window.setTimeout(() => {
        instantNavLockRef.current = false;
      }, 120);
    },
    [router]
  );

  const handleDashboardToggle = useCallback(() => {
    setSubmenuType(null);
    setSubmenuTrail([]);

    if (dashboardVisible) {
      setDashboardVisible(false);
      return;
    }

    setIsDashboardPanelMounted(true);
    setDashboardVisible(true);
    loadPanelsModule().catch(() => {});
  }, [dashboardVisible]);

  const sidebarNavItems = useMemo(
    () =>
      visibleNavItems.map((item) => {
        const isSubmenuTrigger =
          item.id === "report" ||
          item.id === "chart" ||
          item.id === "complain" ||
          item.id === "setting";

        const ref =
          item.id === "report"
            ? reportTriggerRef
            : item.id === "chart"
            ? chartTriggerRef
            : item.id === "complain"
            ? complaintTriggerRef
            : item.id === "setting"
            ? settingTriggerRef
            : null;

        return (
          <li key={item.id} className={styles.menuItem}>
            <SidebarNavButton
              ref={ref}
              item={item}
              isActive={resolvedActiveItem === item.id}
              isLoading={Boolean(routeMap[item.id]) && isNavigating && pathnameMatchesHref(pendingSidebarHref, routeMap[item.id])}
              isSubmenuTrigger={isSubmenuTrigger}
              onClick={isSubmenuTrigger ? handleSubmenuTriggerClick : handlePrimaryNavClick}
              onHover={!isSubmenuTrigger ? handleNavHover : undefined}
            />
          </li>
        );
      }),
    [
      complaintTriggerRef,
      chartTriggerRef,
      handleNavHover,
      handlePrimaryNavClick,
      handleSubmenuTriggerClick,
      isNavigating,
      pendingSidebarHref,
      reportTriggerRef,
      resolvedActiveItem,
      settingTriggerRef,
      visibleNavItems,
    ]
  );

  const getPanelTopForCount = useCallback((top, count) => {
    const minTop = 80;
    const estimatedPanelHeight = Math.min(560, Math.max(1, count || 1) * 44 + 24);
    const maxTop =
      typeof window !== "undefined"
        ? Math.max(minTop, window.innerHeight - estimatedPanelHeight - 12)
        : minTop;
    return Math.min(Math.max(minTop, top), maxTop);
  }, []);

  const isMenuItemActive = useCallback(
    (item) => {
      if (!item || typeof item !== "object") return false;
      if (item.href && pathname && pathname !== "/") {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
      }
      return Array.isArray(item.subItems) ? item.subItems.some(isMenuItemActive) : false;
    },
    [pathname]
  );

  const openChildMenu = useCallback(
    (item, depth, top) => {
      const childItems = Array.isArray(item?.subItems) ? item.subItems : [];
      if (!childItems.length) {
        setSubmenuTrail((current) => current.slice(0, depth));
        return;
      }

      setSubmenuTrail((current) => [
        ...current.slice(0, depth),
        {
          parentKey: item.key || item.label,
          items: childItems,
          top: getPanelTopForCount(top, childItems.length),
        },
      ]);
    },
    [getPanelTopForCount]
  );

  useEffect(() => {
    if (!pendingSidebarHref) return;
    if (pathnameMatchesHref(pathname, pendingSidebarHref)) {
      setPendingSidebarHref("");
    }
  }, [pathname, pendingSidebarHref]);

  useEffect(() => {
    if (!isOpen) {
      setSubmenuType(null);
      setSubmenuTrail([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!submenuType || !submenuListRef.current) return;
    submenuListRef.current.scrollTop = 0;
  }, [submenuType]);

  useEffect(() => {
    if (!submenuType) return undefined;

    updateSubmenuPosition(submenuType);
    const onResize = () => updateSubmenuPosition(submenuType);
    const onClickOutside = (event) => {
      const target = event.target;
      const outsideReportTrigger = !reportTriggerRef.current || !reportTriggerRef.current.contains(target);
      const outsideChartTrigger = !chartTriggerRef.current || !chartTriggerRef.current.contains(target);
      const outsideComplaintTrigger =
        !complaintTriggerRef.current || !complaintTriggerRef.current.contains(target);
      const outsideSettingTrigger = !settingTriggerRef.current || !settingTriggerRef.current.contains(target);
      const clickedInsideChildPanel = childPanelRefs.current.some((panel) => panel && panel.contains(target));
      if (
        submenuPanelRef.current &&
        !submenuPanelRef.current.contains(target) &&
        !clickedInsideChildPanel &&
        outsideReportTrigger &&
        outsideChartTrigger &&
        outsideComplaintTrigger &&
        outsideSettingTrigger
      ) {
        setSubmenuType(null);
        setSubmenuTrail([]);
      }
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [submenuType, updateSubmenuPosition]);

  return (
    <>
      <aside className={`${styles.sidebar} ${!isOpen ? styles.collapsed : ""}`} id="sidebar">
        <div className={styles.sidebarLogo}>
          <Link href="/tracking">
            <Image className={styles.logoDefault} src={logo} alt="Logo" width={96} height={96} />
          </Link>
        </div>

        <ul className={styles.menu}>
          {sidebarNavItems}
        </ul>

        <button
          className={styles.toggleBtn}
          onClick={(event) => {
            event.preventDefault();
          }}
          type="button"
        >
          <Image src={toggleIcon} alt="Toggle Icon" width={20} height={20} />
        </button>
      </aside>

      {!hideDashboardToggle ? (
        <button
          type="button"
          className={styles.verticalOrangeButton}
          style={{ left: `${toggleLeft}px`, top: `${panelToggleTop}px` }}
          onClick={handleDashboardToggle}
          aria-label="Toggle dashboard overlay"
          title="Toggle dashboard overlay"
        />
      ) : null}

      {!hideDashboardToggle && isDashboardPanelMounted ? (
        <div
          style={{
            position: "fixed",
            top: `${panelTop}px`,
            bottom: "8px",
            left: `${panelLeft}px`,
            width: `${panelWidth}px`,
            zIndex: 9998,
            transition: "width 0.18s ease",
            opacity: dashboardVisible ? 1 : 0,
            visibility: dashboardVisible ? "visible" : "hidden",
            pointerEvents: dashboardVisible ? "auto" : "none",
          }}
          aria-hidden={!dashboardVisible}
        >
          {!isInitialPanelSnapshotReady ? (
            <DashboardPanelLoadingState />
          ) : (
            <Panels
              onPanelWidthChange={setDashboardPanelWidth}
              vehicles={preparedPanelVehicles}
              isVehiclesLoading={false}
              isVehiclesRefreshing={isPanelVehiclesRefreshing}
              vehiclesError={preparedPanelVehiclesError}
              onRefreshVehicles={refreshPanelVehicles}
              onStatusFilterChange={onMobileStatusFilterChange}
              isUsingFallbackSnapshot={isPreparedPanelSnapshotStale}
            />
          )}
        </div>
      ) : null}

      {submenuType && isOpen && (
        <div
          ref={submenuPanelRef}
          className={styles.reportPanel}
          style={{
            left: `${submenuLeft}px`,
            top: `${submenuTop}px`,
            width: `${submenuWidth}px`,
          }}
        >
          <ul ref={submenuListRef} className={styles.reportMenuList}>
            {activeSubmenuItems.map((item) => {
              if (item.type === "section") {
                return (
                  <li key={`section-${item.sectionLabel}`} className={styles.reportSectionRow}>
                    <span className={styles.reportSectionLabel}>{item.sectionLabel}</span>
                  </li>
                );
              }

              const { key, label, description, badge, Icon, href, subItems } = item;
              const hasChildren = Array.isArray(subItems) && subItems.length > 0;
              const isOpenInTrail = submenuTrail[0]?.parentKey && key && submenuTrail[0].parentKey === key;
              const isActiveItem = isMenuItemActive(item);
              const isLoadingItem = Boolean(href) && isNavigating && pathnameMatchesHref(pendingSidebarHref, href);

              return (
                <li key={key || label}>
                  <button
                    type="button"
                    className={`${styles.reportMenuItem} ${
                      isActiveItem || isOpenInTrail ? styles.reportMenuItemActive : ""
                    }`}
                    disabled={!href && !hasChildren}
                    onMouseEnter={(event) => {
                      if (href) router.prefetch(href);
                      const rect = event.currentTarget.getBoundingClientRect();
                      openChildMenu(item, 0, rect.top);
                    }}
                    onTouchStart={() => {
                      if (href) router.prefetch(href);
                    }}
                    onClick={(event) => {
                      if (hasChildren) return;
                      if (!href) return;
                      event.preventDefault();
                      navigateInstant(href);
                    }}
                  >
                    <span className={styles.reportItemLeft}>
                      <Icon size={13} />
                      <span className={styles.reportItemTextWrap}>
                        <span className={styles.reportItemLabel}>{label}</span>
                        {description ? (
                          <span className={styles.reportItemDescription}>{description}</span>
                        ) : null}
                      </span>
                    </span>
                    <span className={styles.reportItemRight}>
                      {isLoadingItem ? <span className={styles.reportInlineLoader} aria-hidden="true" /> : null}
                      {badge ? <span className={styles.reportItemBadge}>{badge}</span> : null}
                      <FaChevronRight size={10} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {isOpen &&
        submenuTrail.map((panel, depth) => (
          <div
            key={`${panel.parentKey}-${depth}`}
            ref={(node) => {
              childPanelRefs.current[depth] = node;
            }}
            className={styles.reportChildPanel}
            style={{
              left: `${submenuLeft + submenuWidth + 8 + depth * (childPanelWidth + 8)}px`,
              top: `${panel.top}px`,
              width: `${childPanelWidth}px`,
            }}
          >
            <ul className={styles.reportMenuList}>
              {panel.items.map((subItem) => {
                const hasChildren = Array.isArray(subItem.subItems) && subItem.subItems.length > 0;
                const isOpenInTrail =
                  submenuTrail[depth + 1]?.parentKey &&
                  (subItem.key || subItem.label) === submenuTrail[depth + 1].parentKey;
                const isActiveItem = isMenuItemActive(subItem);
                const isLoadingItem =
                  Boolean(subItem.href) &&
                  isNavigating &&
                  pathnameMatchesHref(pendingSidebarHref, subItem.href);

                return (
                  <li key={subItem.href || subItem.key || subItem.label}>
                    <button
                      type="button"
                      className={`${styles.reportMenuItem} ${
                        isActiveItem || isOpenInTrail ? styles.reportMenuItemActive : ""
                      }`}
                      disabled={!subItem.href && !hasChildren}
                      onMouseEnter={(event) => {
                        if (subItem.href) router.prefetch(subItem.href);
                        const rect = event.currentTarget.getBoundingClientRect();
                        openChildMenu(subItem, depth + 1, rect.top);
                      }}
                      onTouchStart={() => {
                        if (subItem.href) router.prefetch(subItem.href);
                      }}
                      onClick={(event) => {
                        if (hasChildren || !subItem.href) return;
                        event.preventDefault();
                        navigateInstant(subItem.href);
                      }}
                    >
                      <span className={styles.reportItemLeft}>
                        <span className={styles.reportChildDot}>•</span>
                        <span className={styles.reportItemTextWrap}>
                          <span className={styles.reportItemLabel}>{subItem.label}</span>
                          {subItem.description ? (
                            <span className={styles.reportItemDescription}>{subItem.description}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className={styles.reportItemRight}>
                        {isLoadingItem ? <span className={styles.reportInlineLoader} aria-hidden="true" /> : null}
                        <FaChevronRight size={10} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </>
  );
};

export default Sidebar;
