"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getVehicleImageSrc } from "@/lib/vehicleImage";
import {
  FaBatteryHalf,
  FaBell,
  FaBroadcastTower,
  FaCarSide,
  FaChartLine,
  FaChevronRight,
  FaCog,
  FaCrosshairs,
  FaDoorOpen,
  FaDotCircle,
  FaEye,
  FaExternalLinkAlt,
  FaExclamationTriangle,
  FaFileAlt,
  FaGasPump,
  FaGlobe,
  FaInfoCircle,
  FaLocationArrow,
  FaLock,
  FaMapMarkerAlt,
  FaPowerOff,
  FaRegCircle,
  FaRoad,
  FaShareAlt,
  FaSyncAlt,
  FaTachometerAlt,
  FaThermometerHalf,
  FaTint,
  FaTruck,
  FaUserAlt,
  FaArrowsAlt,
} from "react-icons/fa";
import styles from "./TelemetryPanel.module.css";

const fallbackVehicle = {
  vehicle_no: "TS-0001",
  vehicle_type: "SUV",
  driver_name: "Samama Anees",
  mobile_no: "03132258597",
  speed: 0,
  location_name: "Shahrah Faisal, Karachi",
  latitude: 24.904,
  longitude: 67.08,
  movement_status: "STOP",
  imei_id: "350424066474667",
};

const settingsWidgets = [
  { title: "Object Info", items: ["Status", "Driver Information", "Work Hour", "Odo Meter", "Follow", "Share Live Location", "Navigate", "Find Near By", "Mode", "Street View", "Object Name"] },
  { title: "Location", items: ["Address", "Geofence"] },
  { title: "Temperature", items: ["Temperature"] },
  { title: "Today Activity", items: ["Distance", "Running", "Stop", "Inactive", "Idle", "Work Hour", "Working Start", "Last Stop"] },
  { title: "Speed", items: ["Speed"] },
  { title: "Alert", items: ["Alert Information"] },
  { title: "Fuel", items: ["Level", "Refill and Drain", "Blind Area", "Waste", "Tank Capacity", "Consumption", "Consumption (CAN)", "Carbon Emission", "Carbon Emission (CAN)", "Number of Tank", "Remaining", "Updated"] },
  { title: "Job", items: ["Job Information"] },
  { title: "Near By", items: ["Address"] },
  { title: "GPS Device Parameter", items: ["Internal Battery", "Satellite", "External Power", "Internal Battery %", "Movement", "Angle", "Sleep Mode", "Altitude", "HDOP", "PDOP", "Extend Battery", "IMSI", "ICCID", "MAC", "ICCID-2", "Axis X", "Axis Y", "Axis Z", "SD Status", "BT Status", "GNSS Status"] },
  { title: "Network Parameter", items: ["GSM", "Cell Id", "Network Mode", "Network Type", "Operator", "PMN Code", "Country", "Zone", "Network Rank"] },
  { title: "Security", items: ["Immbolize", "Door", "Boot", "Buzzer"] },
  { title: "Driver Information", items: ["Driver Number", "RFID", "Age", "Driving Experience", "License Available", "License To Drive", "License Expiry", "Life Ins. Expiry", "Mediclaim Expiry"] },
  { title: "GPS Device Information", items: ["GPS Device Information"] },
  { title: "Expense", items: ["Expense Information"] },
  { title: "Documents", items: ["Objects Document", "Drivers Document"] },
  { title: "Work Efficiency", items: ["Work Efficiency", "Distance Efficiency"] },
  { title: "ADAS", items: ["ADAS Events"] },
  { title: "Object Information", items: ["Purchase Date", "Purchase Amount", "Seat Capacity", "Capacity", "Company Average", "Object Brand", "Permit Name", "Object Model", "Age", "VIN (Chassis) Number", "Engine Number", "Object Category", "Weight Capacity", "Fuel Type", "Object Info 1", "Object Info 2", "Object Info 3", "Object Info 4", "Object Info 5"] },
  { title: "DMS", items: ["DMS Events"] },
  { title: "Toll Information", items: ["Toll Information"] },
  { title: "Battery Level", items: ["Battery Usage"] },
  { title: "Fuel Consumption", items: ["Fuel Type", "Distance", "Duration", "Waste"] },
  { title: "Camera", items: ["Camera Activity"] },
  { title: "Reminder", items: ["Reminder"] },
  { title: "Humidity Level", items: ["Humidity Level"] },
  { title: "Tanker Door", items: ["Tanker Door"] },
  { title: "Load", items: ["Load"] },
  { title: "Beacon", items: ["Beacon"] },
  { title: "Euro Sense Degree BT", items: ["Name", "Mode", "Angle X", "Angle Y", "Angle Z", "Device Is Ready", "All Setting Are Set", "Low Battery Alarm", "Battery Level", "Number Of Complex Event", "Drum Operation Time", "Number Of Drum Starts", "Current Operation Status", "Total Operation Time", "Temperature", "Status Of Operation", "No Of Events", "Drum Operation Speed"] },
  { title: "Eye Sensor", items: ["Temperature", "Humidity", "Battery Voltage", "Battery Voltage Value", "Low Battery Indication", "Movement Angle", "Movement Counter", "Magnetic Field", "Magnetic Presence", "Temperature Presence", "Movement", "Movement Count", "Pitch", "Roll"] },
  { title: "Flow Meter", items: ["Consumption", "Consumption - 2", "Flow Rate", "Flow Rate - 2", "Type", "Position", "Type - 2", "Position - 2"] },
  { title: "Alcohol Level", items: ["Alcohol Level", "Avg", "Max", "High Level", "Sensor Disconnection"] },
  { title: "Passenger Seat", items: ["Passenger Seat Information"] },
  { title: "RPM", items: ["RPM"] },
  { title: "DVR State", items: ["DVR State"] },
  { title: "Pressure Gauge", items: ["Pressure Gauge"] },
  { title: "Recording", items: ["Recording"] },
  { title: "Ad Blue", items: ["Ad Blue"] },
  { title: "Driving Behavior", items: ["Driving Behavior"] },
  { title: "Door", items: ["Door"] },
  { title: "Power Mode", items: ["Power Mode"] },
];
const TELEMETRY_WIDGET_API = "/api/telemetry/widgets";
const defaultWidgetVisibility = Object.freeze(
  Object.fromEntries(settingsWidgets.map((widget) => [widget.title, true]))
);
const overviewWidgetTitles = [
  "Object Info",
  "Location",
  "Today Activity",
  "Fuel",
  "Fuel Consumption",
  "Alert",
  "Speed",
  "Temperature",
  "Job",
  "Near By",
  "GPS Device Parameter",
  "Network Parameter",
  "Security",
  "Driver Information",
  "GPS Device Information",
  "Expense",
  "Documents",
  "Work Efficiency",
  "ADAS",
  "Object Information",
  "DMS",
  "Toll Information",
  "Battery Level",
  "Reminder",
  "Humidity Level",
  "Tanker Door",
  "Load",
  "Beacon",
  "Euro Sense Degree BT",
  "Eye Sensor",
  "Flow Meter",
  "Alcohol Level",
  "Passenger Seat",
  "RPM",
  "DVR State",
  "Pressure Gauge",
  "Recording",
  "Ad Blue",
  "Driving Behavior",
  "Door",
  "Power Mode",
];
const makeDigits = (source) => {
  const normalized = String(source ?? "").replace(/\D/g, "").slice(0, 7);
  return normalized.padEnd(7, "0").split("");
};

const readString = (source, keys, fallback = "N/A") => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
};

const readNumber = (source, keys, fallback = null) => {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const readDateTime = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return formatDateTime(value);
    }
  }
  return "N/A";
};

const buildDriverName = (source) => {
  const direct = readString(source, ["driver_name"], "");
  if (direct) return direct;
  const first = readString(source, ["driver_first_name"], "");
  const last = readString(source, ["driver_last_name"], "");
  return [first, last].filter(Boolean).join(" ").trim() || "N/A";
};

const buildLocation = (source) => {
  const direct = readString(
    source,
    ["location_name", "address", "address_text", "display_address", "last_address", "location"],
    ""
  );
  if (direct) return direct;
  const branch = readString(source, ["branch"], "");
  const company = readString(source, ["company"], "");
  const organization = readString(source, ["organizations", "organization"], "");
  return [branch, company, organization].filter(Boolean).join(", ") || "N/A";
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

const readPercent = (source, keys, fallback = 0) => {
  for (const key of keys) {
    const raw = source?.[key];
    if (raw === undefined || raw === null) continue;
    const match = String(raw).match(/-?\d+(\.\d+)?/);
    if (match) return clampPercent(Number(match[0]));
  }
  return clampPercent(fallback);
};

const formatVehicleTypeLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toLowerCase() === "default") return "Vehicle";
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};
function InfoRows({ rows }) {
  return (
    <div className={styles.infoRows}>
      {rows.map((row, idx) => (
        <div key={`${row.label}-${idx}`} className={styles.infoRow}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
function MiniCard({ title, children, trailing }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <span>{title}</span>
        {trailing || <span />}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export default function TelemetryPanel({ isOpen, vehicle, onClose }) {
  const [activeTopTab, setActiveTopTab] = useState("overview");
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [widgetVisibility, setWidgetVisibility] = useState(defaultWidgetVisibility);
  const [isWidgetVisibilityLoaded, setIsWidgetVisibilityLoaded] = useState(false);
  const mobileSheetTouchStartYRef = useRef(null);
  const widgetVisibilitySaveTimerRef = useRef(null);
  const skipNextWidgetVisibilitySaveRef = useRef(true);
  const data = vehicle || fallbackVehicle;

  useEffect(() => {
    if (!isOpen) {
      setMobileSheetExpanded(false);
      return;
    }
    setMobileSheetExpanded(false);
  }, [isOpen, vehicle?.id, vehicle?.imei_id, vehicle?.vehicle_no, vehicle?.obj_reg_no]);

  useEffect(() => {
    if (!isOpen || isWidgetVisibilityLoaded) return undefined;

    let isCancelled = false;

    const loadWidgetVisibility = async () => {
      try {
        const response = await fetch(TELEMETRY_WIDGET_API, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (isCancelled) return;
        if (response.ok && payload?.visibility && typeof payload.visibility === "object") {
          setWidgetVisibility({
            ...defaultWidgetVisibility,
            ...Object.fromEntries(
              Object.keys(defaultWidgetVisibility).map((title) => [title, payload?.visibility?.[title] !== false])
            ),
          });
        }
      } catch {
        // Ignore preference hydration failures and keep default widget visibility.
      } finally {
        if (isCancelled) return;
        skipNextWidgetVisibilitySaveRef.current = true;
        setIsWidgetVisibilityLoaded(true);
      }
    };

    loadWidgetVisibility();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, isWidgetVisibilityLoaded]);

  useEffect(() => {
    if (!isOpen || !isWidgetVisibilityLoaded) return undefined;
    if (skipNextWidgetVisibilitySaveRef.current) {
      skipNextWidgetVisibilitySaveRef.current = false;
      return undefined;
    }

    if (widgetVisibilitySaveTimerRef.current) {
      window.clearTimeout(widgetVisibilitySaveTimerRef.current);
    }

    widgetVisibilitySaveTimerRef.current = window.setTimeout(() => {
      fetch(TELEMETRY_WIDGET_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: widgetVisibility }),
      }).catch(() => {});
      widgetVisibilitySaveTimerRef.current = null;
    }, 250);
  }, [isOpen, isWidgetVisibilityLoaded, widgetVisibility]);

  useEffect(() => {
    return () => {
      if (widgetVisibilitySaveTimerRef.current) {
        window.clearTimeout(widgetVisibilitySaveTimerRef.current);
        widgetVisibilitySaveTimerRef.current = null;
      }
    };
  }, []);

  const view = useMemo(() => {
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    const tripKm = readNumber(
      data,
      ["current_trip_km", "trip_distance", "today_distance", "distance_km", "today_km", "distance"],
      0
    );
    const speed = readNumber(data, ["speed_kmh", "speed", "speedKmh"], 0);
    const battery = readNumber(data, ["battery_level", "battery_percentage", "internal_battery_percent"], 0);
    const batteryPercent = readPercent(data, ["battery_level", "internal_battery_percent", "battery_percent"], battery);
    const fuelPercent = readPercent(data, ["fuel_level", "fuel", "fuel_percent"], 0);
    const rpmValue = readNumber(data, ["rpm", "engine_rpm"], Number.isFinite(speed) ? speed * 90 : 0) || 0;
    const pressureValue = readNumber(data, ["pressure", "tire_pressure"], 0) || 0;
    const rawType = readString(data, ["vehicle_type", "obj_type", "object_type"], "");
    const displayType = formatVehicleTypeLabel(rawType);
    const imageType = rawType || "default";
    const vehicleNumber = readString(
      data,
      ["vehicle_no", "obj_reg_no", "vehicle_reg_no", "plate_no", "registration_no"],
      "N/A"
    );
    const vehicleName = readString(
      data,
      ["obj_name", "vehicle_name", "object_name", "vehicle_no", "obj_reg_no"],
      vehicleNumber
    );

    return {
      plate: vehicleNumber,
      vehicleName,
      type: displayType,
      imageType,
      status: String(data.movement_status || "STOP").toUpperCase(),
      location: buildLocation(data),
      lat: Number.isFinite(lat) ? lat.toFixed(6) : "N/A",
      lng: Number.isFinite(lng) ? lng.toFixed(6) : "N/A",
      tripKm: Number.isFinite(tripKm) ? tripKm.toFixed(2) : "0.00",
      speed: Number.isFinite(speed) ? speed.toFixed(0) : "0",
      driver: buildDriverName(data),
      mobile: readString(data, ["mobile_no", "driver_mobile", "mobile"], "N/A"),
      imei: data.imei_id || "N/A",
      battery: Number.isFinite(battery) ? battery.toFixed(1) : "0.0",
      batteryPercent,
      fuelPercent,
      rpmValue,
      pressureValue,
      digits: makeDigits(data.odo_meter ?? data.odometer ?? data.imei_id ?? "0"),
      geofence: readString(data, ["geofence_name", "geofence"], "N/A"),
      averageSpeed: readString(data, ["average_speed", "avg_speed"], Number.isFinite(speed) ? String(speed) : "N/A"),
      maxSpeed: readString(data, ["max_speed", "maximum_speed", "top_speed"], Number.isFinite(speed) ? String(speed) : "N/A"),
      speedLimit: readString(data, ["speed_limit", "overspeed_limit"], "N/A"),
      fuelLevel: readString(data, ["fuel_level", "fuel", "fuel_percent"], "N/A"),
      fuelDrain: readString(data, ["fuel_drain"], "N/A"),
      tankCapacity: readString(data, ["tank_capacity"], "N/A"),
      fuelConsumption: readString(data, ["fuel_consumption"], "N/A"),
      fuelTemperature: readString(data, ["fuel_temperature"], "N/A"),
      temperature: readString(data, ["temperature", "temp", "temperature_value"], "N/A"),
      minTemperature: readString(data, ["min_temperature"], "N/A"),
      maxTemperature: readString(data, ["max_temperature"], "N/A"),
      runningTime: readString(data, ["running_time", "moving_time", "travel_time"], "N/A"),
      idleTime: readString(data, ["idle_time", "idling_time"], "N/A"),
      stopTime: readString(data, ["stop_time", "stopped_time", "parking_time"], "N/A"),
      inactiveTime: readString(data, ["inactive_time", "offline_time"], "N/A"),
      workHour: readString(data, ["work_hour", "working_hour", "work_hours"], "N/A"),
      workingStart: readDateTime(data, ["working_start", "working_start_time", "device_datetime", "gps_time", "gpstime"]),
      lastStop: readDateTime(data, ["last_stop", "last_stop_time", "server_datetime", "server_time", "servertime"]),
      gpsTime: readDateTime(data, ["gps_time", "gpstime", "device_time", "device_datetime"]),
      serverTime: readDateTime(data, ["servertime", "server_time", "server_datetime", "updated_at", "timestamp"]),
      satellites: readString(data, ["satellites", "satellite", "gps_satellites", "satellite_count"], "N/A"),
      extPower: readString(data, ["external_voltage", "external_volt", "external_power", "voltage", "battery_voltage"], "N/A"),
      movement: readString(data, ["movement_status"], "N/A"),
      angle: readString(data, ["angle_name", "angle", "heading"], "N/A"),
      altitude: readString(data, ["altitude"], "N/A"),
      gsm: readString(data, ["gsm", "gsm_signal_level", "network_rank"], "N/A"),
      networkMode: readString(data, ["network_mode", "network_type", "gsm_operator"], "N/A"),
      operator: readString(data, ["operator", "gsm_operator"], "N/A"),
      deviceModel: readString(data, ["device_model", "model"], "N/A"),
      installationDate: readString(data, ["installation_date"], "N/A"),
      warranty: readString(data, ["warranty"], "N/A"),
      batteryRange: readString(data, ["battery_range"], "N/A"),
      batteryCapacity: readString(data, ["battery_capacity"], "N/A"),
      estFullCharge: readString(data, ["est_full_charge"], "N/A"),
      chargingEvent: readString(data, ["charging_event"], "N/A"),
      nearby: readString(data, ["geofence_name", "geofence"], buildLocation(data)),
      objectBrand: readString(data, ["object_brand", "brand"], "N/A"),
      objectModel: readString(data, ["object_model", "model", "device_model"], "N/A"),
      category: readString(data, ["object_category", "category"], "Movable"),
      fuelType: readString(data, ["fuel_type"], "N/A"),
      purchaseDate: readString(data, ["purchase_date"], "N/A"),
      purchaseAmount: readString(data, ["purchase_amount"], "N/A"),
      seatCapacity: readString(data, ["seat_capacity"], "N/A"),
      capacity: readString(data, ["capacity"], "N/A"),
      companyAverage: readString(data, ["company_average"], "N/A"),
      permitName: readString(data, ["permit_name"], "N/A"),
      age: readString(data, ["age"], "N/A"),
      vin: readString(data, ["vin", "chassis_number"], "N/A"),
      engineNumber: readString(data, ["engine_number"], "N/A"),
      driverRfid: readString(data, ["driver_rfid", "rfid"], "N/A"),
      licenseType: readString(data, ["license_type"], "N/A"),
      licenseExpiry: readString(data, ["license_expiry"], "N/A"),
      lifeInsuranceExpiry: readString(data, ["life_insurance_expiry"], "N/A"),
      mediclaimExpiry: readString(data, ["mediclaim_expiry"], "N/A"),
      ignition: readString(data, ["ignition_status"], "N/A"),
    };
  }, [data]);

  const activityRows = [
    { label: "Running", value: view.runningTime, color: "#2fb04a" },
    { label: "Idle", value: view.idleTime, color: "#f5b400" },
    { label: "Stop", value: view.stopTime, color: "#ef4f4f" },
    { label: "In active", value: view.inactiveTime, color: "#3d57f5" },
    { label: "Work Hour", value: view.workHour, color: "#7a808f" },
  ];
  const mobilePrimaryTime = view.gpsTime !== "N/A" ? view.gpsTime : view.serverTime;
  const statusLabel =
    view.status === "STOP"
      ? "Stopped"
      : view.status === "IDLE"
      ? "Idle"
      : view.status === "INACTIVE"
      ? "Inactive"
      : view.status === "RUNNING"
      ? "Running"
      : view.status;
  const statusToneClass =
    view.status === "STOP"
      ? styles.statusStopped
      : view.status === "IDLE"
      ? styles.statusIdle
      : view.status === "INACTIVE"
      ? styles.statusInactive
      : styles.statusRunning;
  const heroSubtitle = view.vehicleName !== view.plate ? view.vehicleName : `${view.type} profile`;
  const isWidgetVisible = (title) => widgetVisibility[title] !== false;
  const hasVisibleOverviewWidgets = overviewWidgetTitles.some((title) => isWidgetVisible(title));
  const toggleWidgetVisibility = (title) => {
    setWidgetVisibility((current) => ({
      ...current,
      [title]: current[title] === false,
    }));
  };

  const engineParameters = [
    { label: "Speed", value: `${view.speed} km/h` },
    { label: "Satellites", value: view.satellites },
    { label: "Ignition", value: view.ignition },
    { label: "External Power", value: view.extPower },
    { label: "Movement", value: view.movement },
    { label: "Angle", value: view.angle },
    { label: "Altitude", value: view.altitude },
    { label: "Network", value: view.networkMode },
    { label: "Operator", value: view.operator },
    { label: "GPS Time", value: view.gpsTime },
    { label: "Server Time", value: view.serverTime },
  ];

  const fuelNeedleStyle = {
    "--telemetry-fuel-angle": `${-62 + view.fuelPercent * 1.24}deg`,
  };

  const batteryBars = [
    Math.max(18, Math.round(view.batteryPercent * 0.3)),
    Math.max(26, Math.round(view.batteryPercent * 0.52)),
    Math.max(34, Math.round(view.batteryPercent * 0.76)),
    Math.max(42, Math.round(view.batteryPercent * 1.0)),
  ];

  const rpmNeedleStyle = {
    "--telemetry-rpm-angle": `${-55 + Math.min(110, Math.max(0, view.rpmValue / 50))}deg`,
  };

  const pressureNeedleStyle = {
    "--telemetry-pressure-angle": `${-48 + Math.min(96, Math.max(0, view.pressureValue * 2))}deg`,
  };

  if (!isOpen) {
    return null;
  }

  const handleMobileSheetTouchStart = (event) => {
    const touch = event?.touches?.[0];
    mobileSheetTouchStartYRef.current = touch?.clientY ?? null;
  };

  const handleMobileSheetTouchEnd = (event) => {
    const startY = mobileSheetTouchStartYRef.current;
    mobileSheetTouchStartYRef.current = null;
    if (!Number.isFinite(startY)) return;
    const touch = event?.changedTouches?.[0];
    const endY = touch?.clientY;
    if (!Number.isFinite(endY)) return;
    const deltaY = endY - startY;
    if (deltaY <= -32) {
      setMobileSheetExpanded(true);
      return;
    }
    if (deltaY >= 32) {
      setMobileSheetExpanded(false);
    }
  };

  return (
      <aside
        className={`${styles.panel} ${isOpen ? styles.open : ""}`}
        aria-hidden={!isOpen}
        data-telemetry-panel="true"
      >
        <div
          className={`${styles.inner} ${mobileSheetExpanded ? styles.innerExpanded : styles.innerCollapsed}`}
          data-expanded={mobileSheetExpanded ? "true" : "false"}
        >
        <div
          className={styles.mobileSheetChrome}
          onTouchStart={handleMobileSheetTouchStart}
          onTouchEnd={handleMobileSheetTouchEnd}
          onDoubleClick={() => setMobileSheetExpanded((current) => !current)}
        >
          <div className={styles.mobileSheetGrip} aria-hidden="true" />
          <div className={styles.mobileSheetBar}>
            <div className={styles.mobileSheetTitleWrap}>
              <strong>{view.plate}</strong>
              <span>Telemetry</span>
            </div>
            <button
              type="button"
              className={styles.mobileSheetClose}
              onClick={() => onClose?.()}
              aria-label="Close telemetry"
              title="Close telemetry"
            >
              Close
            </button>
          </div>
        </div>
        <section className={styles.mobileHero}>
          <div className={styles.mobileHeroMain}>
            <div className={styles.mobileHeroThumb}>
              <Image
                src={getVehicleImageSrc(view.imageType)}
                alt={view.type}
                fill
                sizes="56px"
                className={styles.mobileHeroThumbImage}
                unoptimized={String(getVehicleImageSrc(view.imageType)).endsWith(".svg")}
              />
            </div>
            <div className={styles.mobileHeroCopy}>
              <strong className={styles.mobileHeroTitle}>{view.plate}</strong>
              <span className={styles.mobileHeroSubtitle}>Telemetry</span>
            </div>
            <button
              type="button"
              className={styles.mobileHeroAction}
              onClick={() => setActiveTopTab("vehicle")}
              aria-label="Open vehicle tab"
              title="Vehicle tab"
            >
              <FaCog />
            </button>
          </div>
          <div className={styles.mobileHeroMeta}>
            <span className={`${styles.mobileHeroStatus} ${statusToneClass}`}>
              {statusLabel}
            </span>
            <span className={styles.mobileHeroChip}>{view.workHour}</span>
            <span className={styles.mobileHeroChip}>{view.tripKm} km</span>
            <span className={styles.mobileHeroChip}>{view.speed} km/h</span>
          </div>
          <div className={styles.mobileHeroTimeRow}>
            <span>{mobilePrimaryTime}</span>
          </div>
        </section>
        <div className={styles.topTabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTopTab === "overview" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTopTab("overview")}
            aria-pressed={activeTopTab === "overview"}
            title="Overview"
          >
            <FaUserAlt />
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTopTab === "vehicle" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTopTab("vehicle")}
            aria-pressed={activeTopTab === "vehicle"}
            title="Vehicle"
          >
            <FaTruck />
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTopTab === "settings" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTopTab("settings")}
            aria-pressed={activeTopTab === "settings"}
            title="Settings"
          >
            <FaCog />
          </button>
        </div>

        {activeTopTab === "overview" && <div className={styles.stack}>
          {!hasVisibleOverviewWidgets ? (
            <div className={styles.placeholderView}>
              <div className={styles.placeholderTitle}>No widgets selected</div>
              <div className={styles.placeholderText}>
                Open the settings tab and enable the telemetry widgets you want to see.
              </div>
            </div>
          ) : null}

          {isWidgetVisible("Object Info") ? (
            <section className={`${styles.card} ${styles.heroCard}`}>
              <div className={styles.cardBody}>
                <div className={styles.heroTopLine}>
                  <div className={styles.heroTitleBlock}>
                    <span className={styles.heroEyebrow}>Vehicle Telemetry</span>
                    <div className={styles.heroTitle}>{view.plate}</div>
                    <div className={styles.heroSubtitleLine}>{heroSubtitle}</div>
                  </div>
                  <button type="button" className={styles.heroInfoButton} aria-label="Telemetry details" title="Telemetry details">
                    <FaInfoCircle />
                  </button>
                </div>
                <div className={styles.heroMetaRow}>
                  <span className={styles.heroPlate}>{view.type}</span>
                  <span className={`${styles.statusPill} ${statusToneClass}`}>{statusLabel}</span>
                </div>
                <div className={styles.heroImageShell}>
                  <div className={styles.heroImageAura} aria-hidden="true" />
                  <div className={styles.vehicleImageWrap}>
                    <Image
                      src={getVehicleImageSrc(view.imageType)}
                      alt={view.type}
                      fill
                      sizes="146px"
                      className={styles.vehicleImage}
                      priority
                      unoptimized={String(getVehicleImageSrc(view.imageType)).endsWith(".svg")}
                    />
                  </div>
                </div>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span>Vehicle Name</span>
                    <strong>{view.vehicleName}</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span>Current Trip</span>
                    <strong>{view.tripKm} km</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span>Speed</span>
                    <strong>{view.speed} km/h</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span>Work Hour</span>
                    <strong>{view.workHour}</strong>
                  </div>
                </div>
                <div className={styles.digitPanel}>
                  <span className={styles.digitPanelLabel}>Odometer</span>
                  <div className={styles.digitRow}>{view.digits.map((digit, idx) => <span key={`${digit}-${idx}`} className={styles.digitCell}>{digit}</span>)}</div>
                </div>
                <div className={styles.detailRows}>
                  <div className={styles.infoRowCompact}><span>Driver</span><strong>{view.driver}</strong></div>
                  <div className={styles.infoRowCompact}><span>Mobile</span><strong>{view.mobile}</strong></div>
                  <div className={styles.infoRowCompact}><span>Details</span><strong><FaInfoCircle /></strong></div>
                </div>
              </div>
              <div className={styles.quickActions}>
                <button type="button"><FaEye /></button>
                <button type="button"><FaShareAlt /></button>
                <button type="button"><FaLocationArrow /></button>
                <button type="button"><FaMapMarkerAlt /></button>
                <button type="button"><FaBell /></button>
              </div>
            </section>
          ) : null}

          {isWidgetVisible("Location") ? (
            <section className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.infoRowCompact}><span><FaMapMarkerAlt /> Location</span><FaChevronRight /></div>
                <div className={styles.miniMuted}>
                  {view.location !== "N/A" ? view.location : `${view.lat},${view.lng}`}
                </div>
                <div className={styles.infoRowCompact}><span><FaDotCircle /> Geofence</span><span /></div>
                <div className={styles.miniMuted}>{view.geofence}</div>
              </div>
              <div className={styles.smallFooterTabs}>
                <button type="button"><FaRegCircle /></button>
                <button type="button"><FaUserAlt /></button>
                <button type="button"><FaGlobe /></button>
              </div>
            </section>
          ) : null}

          {isWidgetVisible("Today Activity") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span>Today Activity</span><FaSyncAlt /></div>
              <div className={styles.cardBody}>
                <div className={styles.activityHero}>
                  <div className={styles.activityRoadIcon}><FaRoad /></div>
                  <div className={styles.activityDistanceWrap}>
                    <strong>{view.tripKm} km</strong>
                    <div className={styles.activityDistanceLine} />
                  </div>
                  <div className={styles.activityVehicleIcon}><FaCarSide /></div>
                </div>
                <div className={styles.activityRowsModern}>
                  {activityRows.map((row) => (
                    <div key={row.label} className={styles.activityRowModern}>
                      <span>{row.label}</span>
                      <strong style={{ color: row.color }}>{row.value}</strong>
                    </div>
                  ))}
                </div>
                <div className={styles.activityMetaBlock}>
                  <div className={styles.activityMetaItem}>
                    <span>Working Start</span>
                    <strong className={styles.activityGreen}>{view.workingStart}</strong>
                  </div>
                  <div className={styles.activityMetaSub}>{view.location}</div>
                  <div className={styles.activityMetaItem}>
                    <span>Last Stop</span>
                    <strong className={styles.activityRed}>{view.lastStop}</strong>
                  </div>
                  <div className={styles.activityMetaSub}>{view.nearby}</div>
                </div>
              </div>
              <button type="button" className={styles.activityShowLog}>
                Show Log
              </button>
            </section>
          ) : null}

          {isWidgetVisible("Fuel") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaGasPump /> Fuel</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.fuelGauge}>
                  <div className={styles.fuelNeedle} style={fuelNeedleStyle} />
                  <div className={styles.gaugeValueBadge}>{view.fuelPercent}%</div>
                </div>
                <InfoRows rows={[
                  { label: "Level", value: view.fuelLevel },
                  { label: "Drain", value: view.fuelDrain },
                  { label: "Tank Capacity", value: view.tankCapacity },
                  { label: "Fuel Consumption", value: view.fuelConsumption },
                  { label: "Fuel Temperature", value: view.fuelTemperature },
                ]} />
              </div>
            </section>
          ) : null}

          {isWidgetVisible("Fuel Consumption") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaChartLine /> Fuel Usage</span>} trailing={<span />}>
              <InfoRows rows={[
                { label: "Distance", value: `${view.tripKm} km` },
                { label: "Duration", value: view.workHour },
                { label: "Waste", value: readString(data, ["fuel_waste"], "N/A") },
              ]} />
              <div className={styles.centerMuted}>Idle time: {view.idleTime}</div>
            </MiniCard>
          ) : null}

          {isWidgetVisible("Alert") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaExclamationTriangle /> Alert</span><strong>Total 0</strong></div>
              <div className={styles.cardBody}><div className={styles.infoRow}><span>Total</span><strong>0 km/h</strong></div></div>
              <div className={styles.orangeAction}>+ Alert</div>
            </section>
          ) : null}

          {isWidgetVisible("Speed") ? (
            <MiniCard title="Speed" trailing={<FaSyncAlt />}>
              <InfoRows rows={[
                { label: "Average Speed", value: `${view.averageSpeed} km/h` },
                { label: "Maximum Speed", value: `${view.maxSpeed} km/h` },
                { label: "Speed Limit", value: view.speedLimit },
              ]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("Temperature") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaThermometerHalf /> Temperature</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.temperatureValue}>{view.temperature}</div>
                <InfoRows rows={[{ label: "Min", value: view.minTemperature }, { label: "Max", value: view.maxTemperature }]} />
              </div>
            </section>
          ) : null}

          {isWidgetVisible("Job") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaFileAlt /> Job</span><span /></div>
              <div className={styles.cardBody}>
                <InfoRows rows={[{ label: "Allocated", value: "0" }, { label: "Complete", value: "0" }]} />
              </div>
              <div className={styles.dualActionRow}><button type="button">+ Job</button><button type="button">History</button></div>
            </section>
          ) : null}

          {isWidgetVisible("Near By") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaMapMarkerAlt /> Near By</span>} trailing={<span />}>
              {view.nearby}
            </MiniCard>
          ) : null}

          {isWidgetVisible("GPS Device Parameter") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaCrosshairs /> GPS Device Parameter</span>} trailing={<span />}>
              <InfoRows rows={[
                { label: "GPS Time", value: view.gpsTime },
                { label: "GNSS Status", value: view.satellites !== "N/A" ? "Connected" : "N/A" },
                { label: "Satellites", value: view.satellites },
                { label: "Ext Power", value: view.extPower },
                { label: "Int Battery %", value: `${view.battery}%` },
                { label: "Movement", value: view.movement },
                { label: "Angle", value: view.angle },
                { label: "Altitude", value: view.altitude },
              ]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("Network Parameter") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaGlobe /> Network Parameter</span>} trailing={<span />}>
              <InfoRows rows={[
                { label: "GSM", value: view.gsm },
                { label: "Network Mode", value: view.networkMode },
                { label: "Operator", value: view.operator },
                { label: "Server Time", value: view.serverTime },
              ]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("Security") ? (
            <section className={styles.card}>
              <div className={styles.orangeActionRow}><span><FaLock /> Immobilize Door</span><FaChevronRight /></div>
            </section>
          ) : null}

          {isWidgetVisible("Driver Information") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaUserAlt /> Driver Information</span>} trailing={<span />}>
              <InfoRows rows={[
                { label: "Driver", value: view.driver },
                { label: "Driver Number", value: view.mobile },
                { label: "RFID", value: view.driverRfid },
                { label: "Age", value: view.age },
                { label: "License To Drive", value: view.licenseType },
                { label: "License Expiry", value: view.licenseExpiry },
                { label: "Life Ins. Expiry", value: view.lifeInsuranceExpiry },
                { label: "Mediclaim Expiry", value: view.mediclaimExpiry },
              ]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("GPS Device Information") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaBroadcastTower /> GPS Device Information</span>} trailing={<span />}>
              <InfoRows rows={[
                { label: "Device", value: view.deviceModel },
                { label: "Device Status", value: view.status },
                { label: "Last Date", value: view.serverTime },
                { label: "IMEI", value: view.imei },
                { label: "Installation Date", value: view.installationDate },
                { label: "Warranty", value: view.warranty },
              ]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("Expense") ? (
            <section className={styles.card}>
              <div className={styles.expenseRow}>
                <div className={styles.expenseLeft}>Expenses (last 7 days)</div>
                <strong>Rs0.00</strong>
              </div>
              <div className={styles.dualActionRow}><button type="button">+ Job</button><button type="button">History</button></div>
            </section>
          ) : null}

          {isWidgetVisible("Documents") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaFileAlt /> Documents</span><span /></div>
              <div className={styles.cardBody}>No Record Found</div>
              <div className={styles.orangeAction}>+ Document</div>
            </section>
          ) : null}

          {isWidgetVisible("Work Efficiency") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span className={styles.cardTitle}><FaChartLine /> Work Efficiency</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.infoRow}><span>00:00 hrs of 0 hrs</span><span /></div>
                <div className={styles.progressBar}><span style={{ width: "0%" }} /></div>
                <div className={styles.infoRow}><span>0 kms of 0 kms</span><span /></div>
                <div className={styles.progressBar}><span style={{ width: "0%" }} /></div>
              </div>
            </section>
          ) : null}

          {isWidgetVisible("ADAS") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaCarSide /> ADAS</span>} trailing={<span />}><InfoRows rows={[{ label: "Total", value: "0" }]} /></MiniCard>
          ) : null}

          {isWidgetVisible("Object Information") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaCarSide /> Object Information</span>} trailing={<span />}>
              <InfoRows rows={[
                { label: "Purchase Date", value: view.purchaseDate },
                { label: "Purchase Amount", value: view.purchaseAmount },
                { label: "Seat Capacity", value: view.seatCapacity },
                { label: "Capacity", value: view.capacity },
                { label: "Company Average", value: view.companyAverage },
                { label: "Object Brand", value: view.objectBrand },
                { label: "Permit Name", value: view.permitName },
                { label: "Object Model", value: view.objectModel },
                { label: "Age", value: view.age },
                { label: "VIN (Chassis) Number", value: view.vin },
                { label: "Engine No", value: view.engineNumber },
                { label: "Object Category", value: view.category },
                { label: "Fuel Type", value: view.fuelType },
              ]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("DMS") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaEye /> DMS</span>} trailing={<span />}><InfoRows rows={[{ label: "Total", value: "0" }]} /></MiniCard>
          ) : null}
          {isWidgetVisible("Toll Information") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaRoad /> Toll Information</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}

          {isWidgetVisible("Battery Level") ? (
            <>
              <section className={styles.card}>
                <div className={styles.cardHead}><span className={styles.cardTitle}><FaBatteryHalf /> Battery Level</span><span /></div>
                <div className={styles.cardBody}>
                  <div className={styles.batteryPct}>{view.battery}%</div>
                  <InfoRows rows={[
                    { label: "Range", value: view.batteryRange },
                    { label: "Capacity", value: view.batteryCapacity },
                    { label: "Est. Full Charge", value: view.estFullCharge },
                    { label: "Charging Event", value: view.chargingEvent },
                  ]} />
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}><span className={styles.cardTitle}><FaBatteryHalf /> Battery Usage</span><span /></div>
                <div className={styles.cardBody}>
                  <div className={styles.barsChart}>
                    {batteryBars.map((height, index) => (
                      <span
                        key={`battery-bar-${index}`}
                        style={{ height: `${height}%` }}
                        className={styles[`batteryBar${index + 1}`]}
                      />
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : null}

          {isWidgetVisible("Reminder") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaBell /> Reminder</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.reminderGrid}>
                  <div><small>Due</small><strong>1</strong></div>
                  <div><small>Overdue</small><strong>0</strong></div>
                  <div><small>Upcoming</small><strong>1</strong></div>
                </div>
              </div>
              <div className={styles.orangeAction}>+ Add Reminder</div>
            </section>
          ) : null}

          {isWidgetVisible("Humidity Level") ? (
            <section className={styles.card}><div className={styles.orangeAction}>No Humidity Sensor Found</div></section>
          ) : null}
          {isWidgetVisible("Tanker Door") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaDoorOpen /> Tanker Door</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}
          {isWidgetVisible("Load") ? (
            <MiniCard title="No Load Sensor" trailing={<span />}>Found</MiniCard>
          ) : null}
          {isWidgetVisible("Beacon") ? (
            <MiniCard title="Beacon" trailing={<strong>0</strong>}><span>Connected</span></MiniCard>
          ) : null}
          {isWidgetVisible("Euro Sense Degree BT") ? (
            <MiniCard title="Euro sense Degree BT" trailing={<span />}>No Record Found</MiniCard>
          ) : null}
          {isWidgetVisible("Eye Sensor") ? (
            <MiniCard title="Eye Sensor" trailing={<span />}>No Record Found</MiniCard>
          ) : null}
          {isWidgetVisible("Flow Meter") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaTint /> Flow Meter</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}
          {isWidgetVisible("Alcohol Level") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaTint /> Alcohol Level</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}

          {isWidgetVisible("Passenger Seat") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaUserAlt /> Passenger Seat</span>} trailing={<span />}>
              <InfoRows rows={[{ label: "Occupied", value: "0" }, { label: "Vacant", value: "0" }]} />
            </MiniCard>
          ) : null}

          {isWidgetVisible("RPM") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span><FaTachometerAlt /> RPM</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.rpmMeter}>
                  <div className={styles.rpmNeedle} style={rpmNeedleStyle} />
                  <div className={styles.gaugeValueBadge}>{Math.round(view.rpmValue)} RPM</div>
                </div>
                <InfoRows rows={[{ label: "Lowest", value: "0 RPM" }, { label: "Current", value: `${Math.round(view.rpmValue)} RPM` }]} />
              </div>
            </section>
          ) : null}

          {isWidgetVisible("DVR State") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaBroadcastTower /> DVR State</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}

          {isWidgetVisible("Pressure Gauge") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span className={styles.cardTitle}><FaTachometerAlt /> Pressure Gauge</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.pressureGauge}>
                  <div className={styles.pressureNeedle} style={pressureNeedleStyle} />
                  <div className={styles.gaugeValueBadge}>{view.pressureValue}</div>
                </div>
                <InfoRows rows={[
                  { label: "Safe", value: "0-38" },
                  { label: "Warning", value: "39-70" },
                  { label: "Critical", value: "71-100" },
                ]} />
              </div>
            </section>
          ) : null}

          {isWidgetVisible("Recording") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaBroadcastTower /> Recording</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}

          {isWidgetVisible("Ad Blue") ? (
            <section className={styles.card}>
              <div className={styles.cardHead}><span className={styles.cardTitle}><FaTint /> Ad Blue</span><span /></div>
              <div className={styles.cardBody}>
                <div className={styles.adBlueGauge} />
                <InfoRows rows={[
                  { label: "Low Level", value: "0 ltr" },
                  { label: "Refill", value: "0 ltr" },
                  { label: "Drain", value: "0 ltr" },
                ]} />
              </div>
            </section>
          ) : null}

          {isWidgetVisible("Driving Behavior") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaCarSide /> Driver Behavior</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}
          {isWidgetVisible("Door") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaDoorOpen /> Door</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}
          {isWidgetVisible("Power Mode") ? (
            <MiniCard title={<span className={styles.cardTitle}><FaPowerOff /> Power Mode</span>} trailing={<span />}>No Record Found</MiniCard>
          ) : null}
        </div>}

        {activeTopTab === "vehicle" && (
          <section className={styles.vehicleTabView}>
            <article className={styles.vehicleParamsCard}>
              <div className={styles.vehicleParamsHeader}>
                <span className={styles.vehicleParamsTitle}>
                  <FaExternalLinkAlt size={13} />
                  <strong>Engine Parameters</strong>
                </span>
              </div>
              <div className={styles.vehicleParamsBody}>
                {engineParameters.map((item) => (
                  <div key={item.label} className={styles.vehicleParamsRow}>
                    <span>{item.label}</span>
                    {item.value ? <strong>{item.value}</strong> : <strong>&nbsp;</strong>}
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTopTab === "settings" && (
          <section className={styles.settingsView}>
            <div className={styles.settingsBanner}>
              <h4>Manage Your Widgets</h4>
              <p>
                Select the telemetry widgets you want to keep visible. Unchecked widgets will be hidden
                from the panel.
              </p>
            </div>

            <div className={styles.settingsWidgetsList}>
              {settingsWidgets.map((widget) => (
                <article
                  key={widget.title}
                  className={`${styles.settingsWidgetCard} ${
                    isWidgetVisible(widget.title) ? styles.settingsWidgetCardActive : styles.settingsWidgetCardInactive
                  }`}
                >
                  <div className={styles.settingsWidgetHeader}>
                    <button
                      type="button"
                      className={styles.settingsWidgetToggle}
                      onClick={() => toggleWidgetVisibility(widget.title)}
                      aria-pressed={isWidgetVisible(widget.title)}
                      aria-label={`${isWidgetVisible(widget.title) ? "Hide" : "Show"} ${widget.title}`}
                    >
                      <span
                        className={`${styles.settingsWidgetCheck} ${
                          isWidgetVisible(widget.title)
                            ? styles.settingsWidgetCheckActive
                            : styles.settingsWidgetCheckInactive
                        }`}
                      >
                        {isWidgetVisible(widget.title) ? "\u2713" : ""}
                      </span>
                      <h5>{widget.title}</h5>
                    </button>
                    <button
                      type="button"
                      className={styles.settingsWidgetDrag}
                      aria-label={`${widget.title} visibility is ${isWidgetVisible(widget.title) ? "on" : "off"}`}
                      title={isWidgetVisible(widget.title) ? "Visible in telemetry panel" : "Hidden from telemetry panel"}
                    >
                      <FaArrowsAlt />
                    </button>
                  </div>
                  <div className={styles.settingsWidgetBody}>
                    {widget.items.map((item) => (
                      <div key={`${widget.title}-${item}`} className={styles.settingsWidgetItem}>
                        <span className={styles.settingsWidgetDot} aria-hidden="true" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
