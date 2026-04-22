"use client";

import {
  FaBell,
  FaCar,
  FaClipboardList,
  FaCommentDots,
  FaDollarSign,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaGasPump,
  FaListAlt,
  FaMapMarkerAlt,
  FaRegClock,
  FaRegDotCircle,
  FaRoad,
  FaSatellite,
  FaShoppingBag,
  FaTachometerAlt,
  FaThermometerHalf,
  FaTools,
  FaLock,
} from "react-icons/fa";
import { customerSettingsModuleItems } from "@/lib/customerSettingsModules";

const sortMenuItemsAlphabetically = (items) =>
  [...items].sort((left, right) =>
    String(left?.label || "").localeCompare(String(right?.label || ""), undefined, {
      sensitivity: "base",
    })
  );

export const reportMenuItems = sortMenuItemsAlphabetically([
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
    key: "ke",
    label: "KE",
    Icon: FaRegDotCircle,
    href: "/report/ke",
    subItems: [
      { label: "Detail Activity Report", href: "/report/ke/detail-activity-report" },
      { label: "Travel", href: "/report/ke/travel" },
      { label: "Trip", href: "/report/ke/trip" },
      { label: "Stoppage", href: "/report/ke/stoppage" },
      { label: "Over Speed Summary", href: "/report/ke/over-speed-summary" },
      { label: "Daywise Distance", href: "/report/ke/daywise-distance" },
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
]);

export const chartMenuItems = [
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

export const complaintMenuItems = [
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

export const settingMenuItems = [
  ...customerSettingsModuleItems.map((item) => ({
    key: item.key,
    label: item.label,
    Icon:
      item.href === "/vehicle"
        ? FaCar
        : item.href === "/vehiclegroup" || item.href === "/object-group"
        ? FaListAlt
        : FaRegDotCircle,
    href: item.href,
  })),
];
