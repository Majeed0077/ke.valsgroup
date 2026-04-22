"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Responsive, WidthProvider } from "react-grid-layout";
import styles from "./Dashboard.module.css";
import { useDashboardData } from "./useDashboardData";

const DEFAULT_CITY = "Karachi";
const WEATHER_API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
const WEATHER_API_URL = "https://api.weatherapi.com/v1/current.json";
const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const FUEL_REFRESH_MS = 10 * 60 * 1000;
const DASHBOARD_FAVORITE_LAYOUT_KEY = "vtp_dashboard_favorite_layout_v1";
const DRAG_ACTIVATION_DISTANCE = 8;
const DASHBOARD_LAYOUT_API = "/api/dashboard/layout";
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
};
const GEOLOCATION_ACCURACY_RETRY_THRESHOLD_METERS = 2000;
const GEOLOCATION_DISTANCE_RETRY_THRESHOLD_KM = 250;
const DASHBOARD_CARD_SEARCH_INDEX = {
  weather: ["weather", "temperature", "city", "forecast", "location"],
  engine: ["engine", "switch", "ignition", "status"],
  time: ["time", "clock", "date", "current time"],
  saving: ["saving", "fleet value", "summary", "trend"],
  donut: ["fleet split", "running", "idle", "stopped", "status"],
  daily: ["daily", "activity", "average", "time spent"],
  overspeed: ["overspeed", "alert", "speed", "maximum speed"],
  avgDriving: ["average driving", "driving", "hours", "minutes"],
  lineCard: ["vehicle activity", "line chart", "activity trend"],
  hours: ["bar chart", "hours", "usage", "chart"],
  fuel: ["fuel", "petrol", "diesel", "prices"],
};

const KARACHI_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const KARACHI_TIME_DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-PK", {
  timeZone: "Asia/Karachi",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const getWeatherVisualTheme = (condition, isDay) => {
  const text = String(condition?.text || "").toLowerCase();
  const code = Number(condition?.code || 0);

  const isRain =
    text.includes("rain") ||
    text.includes("drizzle") ||
    text.includes("shower") ||
    [1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code);
  const isStorm =
    text.includes("thunder") ||
    [1087, 1273, 1276, 1279, 1282].includes(code);
  const isPartlyCloudy =
    text.includes("partly cloudy") ||
    [1003].includes(code);
  const isCloudy =
    text.includes("cloud") ||
    text.includes("overcast") ||
    text.includes("mist") ||
    text.includes("fog") ||
    [1006, 1009, 1030, 1135, 1147].includes(code);
  const isClear =
    text.includes("sunny") ||
    text.includes("clear") ||
    [1000].includes(code);

  if (isStorm) return isDay ? "storm" : "night-storm";
  if (isRain) return isDay ? "rain" : "night-rain";
  if (isPartlyCloudy) return isDay ? "partly-cloudy" : "night-cloudy";
  if (isCloudy) return isDay ? "cloudy" : "night-cloudy";
  if (isClear) return isDay ? "sunny" : "night-clear";
  return isDay ? "partly-cloudy" : "night-cloudy";
};

const WeatherBackdrop = ({ theme, compact = false }) => (
  <div className={`${styles.weatherBackdrop} ${styles[`weatherBackdrop${theme
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`]}`}>
    <div className={`${styles.weatherAtmosphere} ${compact ? styles.weatherAtmosphereCompact : ""}`}>
      <span className={styles.weatherGlow} />
      <span className={`${styles.weatherOrb} ${styles[`weatherOrb${theme.includes("night") ? "Moon" : "Sun"}`]}`} />
      <span className={`${styles.weatherCloud} ${styles.weatherCloudA}`} />
      <span className={`${styles.weatherCloud} ${styles.weatherCloudB}`} />
      <span className={`${styles.weatherMist} ${styles.weatherMistA}`} />
      <span className={`${styles.weatherMist} ${styles.weatherMistB}`} />
      <span className={`${styles.weatherRain} ${styles.weatherRainPrimary}`} />
      <span className={`${styles.weatherRain} ${styles.weatherRainSecondary}`} />
      <span className={styles.weatherLightning} />
      <span className={`${styles.weatherStar} ${styles.weatherStarA}`} />
      <span className={`${styles.weatherStar} ${styles.weatherStarB}`} />
      <span className={`${styles.weatherStar} ${styles.weatherStarC}`} />
    </div>
  </div>
);

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_LAYOUTS = {
  lg: [
    { i: "weather", x: 0, y: 0, w: 3, h: 4 },
    { i: "engine", x: 3, y: 0, w: 6, h: 4 },
    { i: "time", x: 9, y: 0, w: 3, h: 4 },
    { i: "saving", x: 0, y: 4, w: 6, h: 7 },
    { i: "donut", x: 6, y: 4, w: 3, h: 7 },
    { i: "daily", x: 9, y: 4, w: 3, h: 7 },
    { i: "overspeed", x: 0, y: 11, w: 3, h: 6 },
    { i: "avgDriving", x: 3, y: 11, w: 3, h: 6 },
    { i: "lineCard", x: 6, y: 11, w: 6, h: 6 },
    { i: "hours", x: 0, y: 17, w: 3, h: 5 },
    { i: "fuel", x: 3, y: 17, w: 6, h: 5 },
  ],
  md: [
    { i: "weather", x: 0, y: 0, w: 3, h: 4 },
    { i: "engine", x: 3, y: 0, w: 6, h: 4 },
    { i: "time", x: 9, y: 0, w: 3, h: 4 },
    { i: "saving", x: 0, y: 4, w: 6, h: 7 },
    { i: "donut", x: 6, y: 4, w: 3, h: 7 },
    { i: "daily", x: 9, y: 4, w: 3, h: 7 },
    { i: "overspeed", x: 0, y: 11, w: 3, h: 6 },
    { i: "avgDriving", x: 3, y: 11, w: 3, h: 6 },
    { i: "lineCard", x: 6, y: 11, w: 6, h: 6 },
    { i: "hours", x: 0, y: 17, w: 3, h: 5 },
    { i: "fuel", x: 3, y: 17, w: 6, h: 5 },
  ],
  sm: [
    { i: "weather", x: 0, y: 0, w: 3, h: 4 },
    { i: "engine", x: 3, y: 0, w: 3, h: 4 },
    { i: "time", x: 0, y: 4, w: 3, h: 4 },
    { i: "saving", x: 3, y: 4, w: 3, h: 6 },
    { i: "donut", x: 0, y: 8, w: 3, h: 6 },
    { i: "daily", x: 3, y: 8, w: 3, h: 6 },
    { i: "overspeed", x: 0, y: 14, w: 3, h: 6 },
    { i: "avgDriving", x: 3, y: 14, w: 3, h: 6 },
    { i: "lineCard", x: 0, y: 20, w: 6, h: 6 },
    { i: "hours", x: 0, y: 26, w: 3, h: 5 },
    { i: "fuel", x: 3, y: 26, w: 3, h: 5 },
  ],
  xs: [
    { i: "weather", x: 0, y: 0, w: 4, h: 4 },
    { i: "engine", x: 0, y: 4, w: 4, h: 4 },
    { i: "time", x: 0, y: 8, w: 4, h: 4 },
    { i: "saving", x: 0, y: 12, w: 4, h: 7 },
    { i: "donut", x: 0, y: 19, w: 4, h: 7 },
    { i: "daily", x: 0, y: 26, w: 4, h: 7 },
    { i: "overspeed", x: 0, y: 33, w: 4, h: 6 },
    { i: "avgDriving", x: 0, y: 39, w: 4, h: 6 },
    { i: "lineCard", x: 0, y: 45, w: 4, h: 6 },
    { i: "hours", x: 0, y: 51, w: 4, h: 5 },
    { i: "fuel", x: 0, y: 56, w: 4, h: 5 },
  ],
  xxs: [
    { i: "weather", x: 0, y: 0, w: 2, h: 4 },
    { i: "engine", x: 0, y: 4, w: 2, h: 4 },
    { i: "time", x: 0, y: 8, w: 2, h: 4 },
    { i: "saving", x: 0, y: 12, w: 2, h: 7 },
    { i: "donut", x: 0, y: 19, w: 2, h: 7 },
    { i: "daily", x: 0, y: 26, w: 2, h: 7 },
    { i: "overspeed", x: 0, y: 33, w: 2, h: 6 },
    { i: "avgDriving", x: 0, y: 39, w: 2, h: 6 },
    { i: "lineCard", x: 0, y: 45, w: 2, h: 6 },
    { i: "hours", x: 0, y: 51, w: 2, h: 5 },
    { i: "fuel", x: 0, y: 56, w: 2, h: 5 },
  ],
};

const cloneLayouts = (layouts) => JSON.parse(JSON.stringify(layouts));
const createDefaultLayouts = () => cloneLayouts(DEFAULT_LAYOUT_SNAPSHOT);
const MIN_ITEM_HEIGHT = {
  hours: 6,
  saving: 8,
  lineCard: 8,
};

const normalizeLayouts = (inputLayouts) => {
  const source = inputLayouts && typeof inputLayouts === "object" ? inputLayouts : {};
  const next = {};

  Object.keys(source).forEach((bp) => {
    const layout = Array.isArray(source[bp]) ? source[bp] : [];
    next[bp] = layout.map((item) => {
      const minH = MIN_ITEM_HEIGHT[item.i] || 1;
      return { ...item, h: Math.max(item.h || minH, minH) };
    });
  });

  return next;
};

const DEFAULT_LAYOUT_SNAPSHOT = normalizeLayouts(cloneLayouts(DEFAULT_LAYOUTS));
const DEFAULT_LAYOUT_SNAPSHOT_STRING = JSON.stringify(DEFAULT_LAYOUT_SNAPSHOT);

const buildPolylinePoints = (series) => {
  const list = Array.isArray(series) ? series : [];
  if (list.length === 0) return "0,160 520,160";
  const maxValue = Math.max(...list, 1);
  const stepX = list.length > 1 ? 520 / (list.length - 1) : 520;

  return list
    .map((value, index) => {
      const x = Math.round(index * stepX);
      const y = Math.round(160 - (Number(value || 0) / maxValue) * 120);
      return `${x},${y}`;
    })
    .join(" ");
};

const buildSmoothPath = (points) => {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return "";
  if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;

  let path = `M ${list[0].x} ${list[0].y}`;

  for (let index = 0; index < list.length - 1; index += 1) {
    const previous = list[index - 1] || list[index];
    const current = list[index];
    const next = list[index + 1];
    const afterNext = list[index + 2] || next;

    const controlPoint1X = current.x + (next.x - previous.x) / 6;
    const controlPoint1Y = current.y + (next.y - previous.y) / 6;
    const controlPoint2X = next.x - (afterNext.x - current.x) / 6;
    const controlPoint2Y = next.y - (afterNext.y - current.y) / 6;

    path += ` C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${next.x} ${next.y}`;
  }

  return path;
};

const SAVING_CHART_FRAME = {
  width: 520,
  height: 220,
  plotLeft: 32,
  plotRight: 502,
  plotTop: 20,
  plotBottom: 186,
};

const SAVING_SERIES = [
  3250, 3480, 3740, 3660, 3690, 3460, 3550, 3680, 3390, 3340,
  3560, 3880, 3600, 3210, 3360, 3400, 3420, 3410, 3380, 3340,
];

const buildSavingChart = (series, markerIndex) => {
  const {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
  } = SAVING_CHART_FRAME;
  const safeSeries = Array.isArray(series) && series.length > 1 ? series : SAVING_SERIES;
  const maxValue = Math.max(...safeSeries, 5000);
  const minValue = Math.min(...safeSeries, 1000);
  const valueRange = Math.max(maxValue - minValue, 1);
  const stepX = (plotRight - plotLeft) / (safeSeries.length - 1);

  const points = safeSeries.map((value, index) => {
    const normalized = (value - minValue) / valueRange;
    return {
      x: Number((plotLeft + stepX * index).toFixed(2)),
      y: Number((plotBottom - normalized * (plotBottom - plotTop) * 0.84).toFixed(2)),
      value,
    };
  });

  const clampedMarkerIndex = Math.min(
    Math.max(Number(markerIndex) || 0, 0),
    points.length - 1
  );
  const markerPoint = points[clampedMarkerIndex];
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${plotLeft} ${height} Z`;

  return {
    linePath,
    areaPath,
    markerPoint,
    markerLeftPercent: (markerPoint.x / width) * 100,
  };
};

const MOBILE_FLEET_STATUS_ORDER = [
  { label: "Running", color: "#3DDC84" },
  { label: "Idle", color: "#F4C542" },
  { label: "Stopped", color: "#FF5A5F" },
  { label: "InActive", color: "#2F81F7" },
  { label: "No Data", color: "#6B7280" },
];
const MOBILE_ALERT_TILES = [
  { title: "Fence Overstay", subtitle: "Max Overstay", theme: "purple" },
  { title: "Stay Away From Zone", subtitle: "", theme: "amber" },
  { title: "AC Misuse", subtitle: "Approx Fuel Wastage", theme: "cyan" },
  { title: "Stay In Zone", subtitle: "", theme: "green" },
];
const MOBILE_OBJECT_MODE_ROWS = [
  { label: "Good To Go" },
  { label: "On Job" },
  { label: "Repair" },
  { label: "Accident" },
  { label: "Breakdown" },
  { label: "Private Mode" },
  { label: "Occupied" },
];

const CLOCK_TICKS = Array.from({ length: 60 }, (_, index) => {
  const angle = index * 6 * (Math.PI / 180);
  const isHour = index % 5 === 0;
  const length = isHour ? 20 : 10;
  const strokeWidth = isHour ? 6 : 2;

  return {
    key: index,
    x1: 256 + Math.cos(angle) * (200 - length),
    y1: 256 + Math.sin(angle) * (200 - length),
    x2: 256 + Math.cos(angle) * 200,
    y2: 256 + Math.sin(angle) * 200,
    strokeWidth,
  };
});

const getKarachiClockState = (now = new Date()) => {
  const parts = KARACHI_DATE_PARTS_FORMATTER.formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateString = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
  const date = new Date(dateString);
  const seconds = date.getSeconds();
  const minutes = date.getMinutes();
  const hours = date.getHours() % 12;

  return {
    dateLabel: date.toLocaleDateString("en-PK"),
    timeString: KARACHI_TIME_DISPLAY_FORMATTER.format(now),
    hourAngle: (hours / 12) * 360 + (minutes / 60) * 30,
    minuteAngle: (minutes / 60) * 360,
    secondAngle: (seconds / 60) * 360,
  };
};

const DashboardTimeCard = ({ dragHandle }) => {
  const [clockState, setClockState] = useState(() => getKarachiClockState());

  useEffect(() => {
    const updateTime = () => {
      setClockState(getKarachiClockState());
    };

    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`${styles.card} ${styles.timeCard}`}>
      {dragHandle}
      <div className={styles.timeLeft}>
        <div className={styles.timeTitle}>Time</div>
        <div className={styles.timeDate}>{clockState.dateLabel}</div>
        <div className={styles.timeDate}>{clockState.timeString}</div>
      </div>

      <div className={styles.clockWrap} aria-label="Analog clock">
        <svg viewBox="0 0 512 512" width="168" height="168" className={styles.clockSvg}>
          <circle
            cx="256"
            cy="256"
            r="245"
            className={styles.clockCircle}
            fill="none"
            stroke="#111"
            strokeWidth="9"
          />
          {CLOCK_TICKS.map((tick) => (
            <line
              key={tick.key}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              className={styles.clockTick}
              stroke="#111"
              strokeLinecap="round"
              strokeWidth={tick.strokeWidth}
            />
          ))}

          <line
            x1="256"
            y1="256"
            x2="256"
            y2="160"
            className={styles.hourHand}
            stroke="#111"
            strokeWidth="9"
            strokeLinecap="round"
            style={{ transformOrigin: "256px 256px", transform: `rotate(${clockState.hourAngle}deg)` }}
          />
          <line
            x1="256"
            y1="256"
            x2="256"
            y2="110"
            className={styles.minuteHand}
            stroke="#111"
            strokeWidth="5"
            strokeLinecap="round"
            style={{ transformOrigin: "256px 256px", transform: `rotate(${clockState.minuteAngle}deg)` }}
          />
          <line
            x1="256"
            y1="256"
            x2="256"
            y2="85"
            className={styles.secondHand}
            stroke="#f26647"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transformOrigin: "256px 256px", transform: `rotate(${clockState.secondAngle}deg)` }}
          />
          <circle cx="256" cy="256" r="6" fill="#d53e3e" />
        </svg>
      </div>
    </div>
  );
};

const MobileTagPill = ({ children, tone = "brand" }) => (
  <span
    className={`${styles.mobileDashTagPill} ${
      tone === "alert" ? styles.mobileDashTagPillAlert : styles.mobileDashTagPillBrand
    }`}
  >
    {children}
  </span>
);

const MobileDashboardCard = ({ title, accent = "brand", right, children, compact = false, collapsed = false, className = "" }) => (
  <section
    className={`${styles.mobileDashCard} ${className} ${compact ? styles.mobileDashCardCompact : ""} ${
      collapsed ? styles.mobileDashCardCollapsed : ""
    }`}
  >
    <span
      className={`${styles.mobileDashCardAccent} ${
        styles[`mobileDashCardAccent${accent.charAt(0).toUpperCase()}${accent.slice(1)}`]
      }`}
      aria-hidden="true"
    />
    <div className={styles.mobileDashCardHeader}>
      <h2>{title}</h2>
      {right ? <div className={styles.mobileDashCardHeaderRight}>{right}</div> : null}
    </div>
    {children}
  </section>
);

const MobileHeader = () => (
  <header className={styles.mobileDashHeader}>
    <h1>Dashboard</h1>
    <div className={styles.mobileDashHeaderActions}>
      <button type="button" className={styles.mobileDashIconButton} aria-label="Edit dashboard">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m12.5 5.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className={styles.mobileDashIconButton} aria-label="Filter dashboard">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16l-6.5 7.1v4.9l-3 1v-5.9L4 6Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className={styles.mobileDashIconButton} aria-label="Muted alerts">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 17H5.5a1 1 0 0 1-.8-1.6L6 13.7V10a6 6 0 0 1 11.2-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 19a2.5 2.5 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m19 5-9 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  </header>
);

const MobileFleetStatusCard = ({ segments }) => {
  const [animateDonut, setAnimateDonut] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAnimateDonut(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const normalizedSegments = MOBILE_FLEET_STATUS_ORDER.map((segment) => {
    const matched = (Array.isArray(segments) ? segments : []).find(
      (item) => String(item?.label || "").trim().toLowerCase() === segment.label.toLowerCase()
    );

    return {
      label: segment.label,
      value: Number(matched?.value || 0),
      color: matched?.color || segment.color,
    };
  });
  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
  const safeTotal = total || 1;
  const center = 70;
  const radius = 52;
  const ringThickness = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedArc = 0;
  let cumulativeDelay = 0;

  const animatedSegments = normalizedSegments.map((segment) => {
    const arcLength = circumference * (segment.value / safeTotal);
    const dashOffset = -accumulatedArc;
    const animationDuration = 0.18 + (segment.value / safeTotal) * 0.95;
    const transitionDelay = cumulativeDelay;

    accumulatedArc += arcLength;
    cumulativeDelay += animationDuration * 0.16;

    return {
      ...segment,
      arcLength,
      dashOffset,
      transitionDelay,
      animationDuration,
    };
  });

  return (
    <MobileDashboardCard title="Fleet Status" accent="blue" className={styles.mobileDashFleetStatusCard}>
      <div className={styles.mobileDashFleetStatusDivider} />
      <div className={styles.mobileDashFleetStatus}>
        <div className={styles.mobileDashDonutWrap}>
          <svg viewBox="0 0 140 140" className={styles.mobileDashDonut} aria-label="Fleet status">
            <circle cx={center} cy={center} r={radius} className={styles.mobileDashDonutTrack} />
            {animatedSegments.map((segment) => (
              <circle
                key={segment.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={ringThickness}
                strokeLinecap="butt"
                className={styles.mobileDashDonutSegment}
                style={{
                  strokeDasharray: animateDonut
                    ? `${segment.arcLength} ${circumference}`
                    : `0 ${circumference}`,
                  strokeDashoffset: segment.dashOffset,
                  transitionDuration: `${segment.animationDuration}s`,
                  transitionDelay: `${segment.transitionDelay}s`,
                }}
              />
            ))}
            <circle cx={center} cy={center} r="34" className={styles.mobileDashDonutInner} />
            <g className={`${styles.mobileDashDonutCenter} ${animateDonut ? styles.mobileDashDonutCenterVisible : ""}`}>
              <g transform={`rotate(90 ${center} ${center})`}>
                <text x={center} y={center - 5} className={styles.mobileDashDonutCenterValue}>
                  {total}
                </text>
                <text x={center} y={center + 13} className={styles.mobileDashDonutCenterLabel}>
                  Objects
                </text>
              </g>
            </g>
          </svg>
        </div>
        <div className={styles.mobileDashLegend}>
          {normalizedSegments.map((segment, index) => {
            const percent = Math.round((segment.value / safeTotal) * 100);
            return (
              <div
                key={segment.label}
                className={`${styles.mobileDashLegendRow} ${animateDonut ? styles.mobileDashLegendRowVisible : ""}`}
                style={{ transitionDelay: `${0.34 + index * 0.06}s` }}
              >
                <div className={styles.mobileDashLegendLabel}>
                  <span className={styles.mobileDashLegendDot} style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}</span>
                </div>
                <strong style={{ color: segment.color }}>
                  {segment.value} ({percent}%)
                </strong>
              </div>
            );
          })}
        </div>
      </div>
    </MobileDashboardCard>
  );
};

const MobileWeatherCard = ({ theme, iconSrc, location, temperature, conditionText, timeLabel, loading, error }) => (
  <section
    className={`${styles.mobileDashWeatherCard} ${styles[`mobileWeatherCard${theme
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")}`]}`}
  >
    <WeatherBackdrop theme={theme} compact />
    <div className={styles.mobileDashWeatherOverlay} />
    <div className={styles.mobileDashWeatherContent}>
      <div className={styles.mobileDashWeatherTop}>
        <div>
          <span className={styles.mobileDashWeatherEyebrow}>Weather</span>
          <h2>{location || "Searching..."}</h2>
        </div>
        <Image src={iconSrc} alt="" width={54} height={54} unoptimized />
      </div>
      <div className={styles.mobileDashWeatherMain}>
        <strong>{loading ? "..." : temperature !== null ? `${temperature}\u00b0` : "--"}</strong>
        <p>
          {loading ? "Loading..." : conditionText}
          {timeLabel ? ` • ${timeLabel}` : ""}
        </p>
      </div>
      {error ? <div className={styles.mobileDashWeatherError}>{error}</div> : null}
    </div>
  </section>
);

const MobileFleetUsageCard = ({ usage }) => (
  <MobileDashboardCard
    title="Fleet Usage"
    accent="green"
    right={<MobileTagPill>Today</MobileTagPill>}
  >
    <div className={styles.mobileDashUsageMetrics}>
      <div>
        <span>Total Fleet Usage</span>
        <strong>{Number(usage?.totalDistanceKm || 0).toFixed(2)} km</strong>
      </div>
      <div className={styles.mobileDashUsageMetricSecondary}>
        <span>Avg. Distance / Object</span>
        <strong>{Number(usage?.avgDistanceKm || 0).toFixed(2)} km</strong>
      </div>
    </div>
    <div className={styles.mobileDashChartTitle}>Distance (km)</div>
    <div className={styles.mobileDashBarChart}>
      {(Array.isArray(usage?.bars) ? usage.bars : []).map((bar, index) => (
        <div key={`${bar.label}-${index}`} className={styles.mobileDashBarSlot}>
          <span className={styles.mobileDashBarTrack} />
          <span className={styles.mobileDashBarFill} style={{ height: `${Math.max(10, Number(bar?.heightPercent || 0))}%` }} />
          <small>{bar?.label || index + 1}</small>
        </div>
      ))}
      <div className={styles.mobileDashAxisLabel}>Duration</div>
    </div>
  </MobileDashboardCard>
);

const UnusedMobileFleetIdleCard = () => (
  <MobileDashboardCard
    title="Fleet Idle"
    accent="yellow"
    right={
      <div className={styles.mobileDashHeaderGroup}>
        <MobileTagPill>Today</MobileTagPill>
        <span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>
      </div>
    }
  >
    <div className={styles.mobileDashMetricRows}>
      <div className={styles.mobileDashMetricRow}>
        <span className={`${styles.mobileDashMetricIcon} ${styles.mobileDashMetricIconYellow}`}>⌛</span>
        <div>
          <span>Total Fleet Idle</span>
        </div>
        <strong>147 hrs</strong>
      </div>
      <div className={styles.mobileDashMetricRow}>
        <span className={`${styles.mobileDashMetricIcon} ${styles.mobileDashMetricIconRed}`}>⛽</span>
        <div>
          <span>Approx Fuel Waste</span>
        </div>
        <strong>278 ltr</strong>
      </div>
    </div>
    <p className={styles.mobileDashHelperText}>
      Note: generally an idle loss occurs between 1.8 to 2.4 liters of fuel per hour. Object with Movable category are considered in analytics.
    </p>
  </MobileDashboardCard>
);

const UnusedMobileInfoTile = ({ title, subtitle, value, label, theme }) => (
  <article className={`${styles.mobileDashInfoTile} ${styles[`mobileDashInfoTile${theme.charAt(0).toUpperCase()}${theme.slice(1)}`]}`}>
    <div className={styles.mobileDashInfoTileTop}>
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <span className={styles.mobileDashTileChevron} aria-hidden="true">&#8250;</span>
    </div>
    <div className={styles.mobileDashInfoTileBottom}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={styles.mobileDashInfoTilePill}>0% Object</div>
    </div>
  </article>
);

const UnusedMobileReminderCard = ({ title, accent }) => (
  <MobileDashboardCard title={title} accent={accent} compact>
    <div className={styles.mobileDashReminderList}>
      {[
        { key: "due", label: "Due", tone: "blue" },
        { key: "overdue", label: "Overdue", tone: "red" },
      ].map((row) => (
        <div key={row.key} className={styles.mobileDashReminderRow}>
          <div className={styles.mobileDashReminderLeft}>
            <span className={`${styles.mobileDashReminderIcon} ${styles[`mobileDashReminderIcon${row.tone.charAt(0).toUpperCase()}${row.tone.slice(1)}`]}`}>◫</span>
            <span>{row.label}</span>
          </div>
          <div className={styles.mobileDashReminderRight}>
            <strong>0</strong>
            <span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>
          </div>
        </div>
      ))}
    </div>
  </MobileDashboardCard>
);

const UnusedMobileFleetFuelCard = () => (
  <MobileDashboardCard
    title="Fleet Fuel"
    accent="yellow"
    right={
      <div className={styles.mobileDashHeaderGroup}>
        <MobileTagPill>Today</MobileTagPill>
        <MobileTagPill tone="alert">Alert</MobileTagPill>
      </div>
    }
  >
    <div className={styles.mobileDashReminderList}>
      {[
        { key: "refill", label: "Total Fuel Refill", icon: "⛽", tone: "green" },
        { key: "drain", label: "Total Fuel Drain", icon: "⛽", tone: "red" },
      ].map((row) => (
        <div key={row.key} className={styles.mobileDashReminderRow}>
          <div className={styles.mobileDashReminderLeft}>
            <span className={`${styles.mobileDashReminderIcon} ${styles[`mobileDashReminderIcon${row.tone.charAt(0).toUpperCase()}${row.tone.slice(1)}`]}`}>{row.icon}</span>
            <span>{row.label}</span>
          </div>
          <div className={styles.mobileDashReminderRight}>
            <strong>0 ltr</strong>
            <span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>
          </div>
        </div>
      ))}
    </div>
  </MobileDashboardCard>
);

const UnusedMobileObjectModeCard = () => (
  <MobileDashboardCard title="Object Mode" accent="blue" right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}>
    <div className={styles.mobileDashProgressList}>
      {MOBILE_OBJECT_MODE_ROWS.map((row) => (
        <div key={row.label} className={styles.mobileDashProgressItem}>
          <div className={styles.mobileDashProgressRow}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
          <div className={styles.mobileDashProgressTrack}>
            <div className={styles.mobileDashProgressFill} style={{ width: `${row.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  </MobileDashboardCard>
);

const MobileFleetIdleCard = ({ totalIdle, fuelWaste, note }) => (
  <MobileDashboardCard
    title="Fleet Idle"
    accent="yellow"
    right={
      <div className={styles.mobileDashHeaderGroup}>
        <MobileTagPill>Today</MobileTagPill>
        <span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>
      </div>
    }
  >
    <div className={styles.mobileDashMetricRows}>
      <div className={styles.mobileDashMetricRow}>
        <span className={`${styles.mobileDashMetricIcon} ${styles.mobileDashMetricIconYellow}`}>⌛</span>
        <div>
          <span>Total Fleet Idle</span>
        </div>
        <strong>{totalIdle || "--"}</strong>
      </div>
      <div className={styles.mobileDashMetricRow}>
        <span className={`${styles.mobileDashMetricIcon} ${styles.mobileDashMetricIconRed}`}>⛽</span>
        <div>
          <span>Approx Fuel Waste</span>
        </div>
        <strong>{fuelWaste || "--"}</strong>
      </div>
    </div>
    <p className={styles.mobileDashHelperText}>{note || "No live idle detail available."}</p>
  </MobileDashboardCard>
);

const MobileInfoTile = ({ title, subtitle, theme }) => (
  <article className={`${styles.mobileDashInfoTile} ${styles[`mobileDashInfoTile${theme.charAt(0).toUpperCase()}${theme.slice(1)}`]}`}>
    <div className={styles.mobileDashInfoTileTop}>
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <span className={styles.mobileDashTileChevron} aria-hidden="true">&#8250;</span>
    </div>
    <div className={styles.mobileDashInfoTileBottom}>
      <div>
        <span>No live data</span>
        <strong>--</strong>
      </div>
      <div className={styles.mobileDashInfoTilePill}>Unavailable</div>
    </div>
  </article>
);

const MobileReminderCard = ({ title, accent }) => (
  <MobileDashboardCard title={title} accent={accent} compact>
    <div className={styles.mobileDashReminderList}>
      {[
        { key: "due", label: "Due", tone: "blue" },
        { key: "overdue", label: "Overdue", tone: "red" },
      ].map((row) => (
        <div key={row.key} className={styles.mobileDashReminderRow}>
          <div className={styles.mobileDashReminderLeft}>
            <span className={`${styles.mobileDashReminderIcon} ${styles[`mobileDashReminderIcon${row.tone.charAt(0).toUpperCase()}${row.tone.slice(1)}`]}`}>◫</span>
            <span>{row.label}</span>
          </div>
          <div className={styles.mobileDashReminderRight}>
            <strong>--</strong>
            <span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>
          </div>
        </div>
      ))}
    </div>
  </MobileDashboardCard>
);

const MobileFleetFuelCard = ({ petrol, diesel }) => (
  <MobileDashboardCard
    title="Fleet Fuel"
    accent="yellow"
    right={
      <div className={styles.mobileDashHeaderGroup}>
        <MobileTagPill>Today</MobileTagPill>
        <MobileTagPill tone="alert">Alert</MobileTagPill>
      </div>
    }
  >
    <div className={styles.mobileDashReminderList}>
      {[
        { key: "refill", label: "Total Fuel Refill", value: petrol, icon: "⛽", tone: "green" },
        { key: "drain", label: "Total Fuel Drain", value: diesel, icon: "⛽", tone: "red" },
      ].map((row) => (
        <div key={row.key} className={styles.mobileDashReminderRow}>
          <div className={styles.mobileDashReminderLeft}>
            <span className={`${styles.mobileDashReminderIcon} ${styles[`mobileDashReminderIcon${row.tone.charAt(0).toUpperCase()}${row.tone.slice(1)}`]}`}>{row.icon}</span>
            <span>{row.label}</span>
          </div>
          <div className={styles.mobileDashReminderRight}>
            <strong>{row.value || "--"}</strong>
            <span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>
          </div>
        </div>
      ))}
    </div>
  </MobileDashboardCard>
);

const MobileObjectModeCard = () => (
  <MobileDashboardCard title="Object Mode" accent="blue" right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}>
    <div className={styles.mobileDashProgressList}>
      {MOBILE_OBJECT_MODE_ROWS.map((row) => (
        <div key={row.label} className={styles.mobileDashProgressItem}>
          <div className={styles.mobileDashProgressRow}>
            <span>{row.label}</span>
            <strong>--</strong>
          </div>
          <div className={styles.mobileDashProgressTrack}>
            <div className={styles.mobileDashProgressFill} style={{ width: "0%" }} />
          </div>
        </div>
      ))}
    </div>
  </MobileDashboardCard>
);

const MobileFleetWorkloadCard = ({ bars }) => (
  <MobileDashboardCard
    title="Fleet Workload"
    accent="cyan"
    right={<MobileTagPill>Today</MobileTagPill>}
  >
    <div className={styles.mobileDashChartTitle}>Percentage</div>
    <div className={`${styles.mobileDashBarChart} ${styles.mobileDashBarChartCyan}`}>
      {(Array.isArray(bars) ? bars : []).map((bar, index) => (
        <div key={`${bar?.label || index}-${index}`} className={styles.mobileDashBarSlot}>
          <span className={styles.mobileDashBarTrack} />
          <span className={styles.mobileDashBarFill} style={{ height: `${Math.max(10, Number(bar?.heightPercent || 0))}%` }} />
          <small>{bar?.label || index + 1}</small>
        </div>
      ))}
      <div className={styles.mobileDashAxisLabel}>Hours</div>
    </div>
  </MobileDashboardCard>
);

const UnusedMobileCollapsedCard = ({ title, accent = "purple" }) => (
  <MobileDashboardCard
    title={title}
    accent={accent}
    right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}
    collapsed
  />
);

const UnusedMobileWorkEfficiencyCard = () => (
  <MobileDashboardCard title="Work Efficiency" accent="green" compact right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}>
    <div className={styles.mobileDashEfficiencyRow}>
      <span>-- / --</span>
      <strong>--</strong>
    </div>
    <div className={styles.mobileDashProgressTrack}>
      <div className={styles.mobileDashProgressFillMuted} style={{ width: "0%" }} />
    </div>
  </MobileDashboardCard>
);

const MobileCollapsedCard = ({ title, accent = "purple" }) => (
  <MobileDashboardCard
    title={title}
    accent={accent}
    right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}
    collapsed
  />
);

const MobileWorkEfficiencyCard = () => (
  <MobileDashboardCard title="Work Efficiency" accent="green" compact right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}>
    <div className={styles.mobileDashEfficiencyRow}>
      <span>0 hrs / 0 hrs</span>
      <strong>0%</strong>
    </div>
    <div className={styles.mobileDashProgressTrack}>
      <div className={styles.mobileDashProgressFillMuted} style={{ width: "0%" }} />
    </div>
  </MobileDashboardCard>
);

const MobileAlertsCard = ({ summary, detail }) => (
  <MobileDashboardCard title="Alerts" accent="red" compact right={<span className={styles.mobileDashChevron} aria-hidden="true">&#8250;</span>}>
    <div className={styles.mobileDashAlertsWrap}>
      <div className={styles.mobileDashAlertsMain}>
        <div className={styles.mobileDashAlertsIcon}>
          <span>!</span>
        </div>
        <div className={styles.mobileDashAlertsCopy}>
          <strong>{summary}</strong>
          <span>{detail}</span>
        </div>
      </div>
      <div className={styles.mobileDashAlertsMeta}>
        <div className={styles.mobileDashAlertsDots}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.mobileDashAlertsPill}>Live</div>
      </div>
      <button type="button" className={styles.mobileDashSupportButton} aria-label="Support">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 14v-2a7 7 0 0 1 14 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="3" y="13" width="4" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="17" y="13" width="4" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 19v2h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  </MobileDashboardCard>
);

const Dashboard = ({ isMobileView = false }) => {
  /* =======================
     TOP UI STATE
  ======================== */
  const [topSearch, setTopSearch] = useState("");
  const [layouts, setLayouts] = useState(() => createDefaultLayouts());
  const [isLayoutReady, setIsLayoutReady] = useState(true);
  const [lineRange, setLineRange] = useState("day");
  const [isFavoriteLayout, setIsFavoriteLayout] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);
  const [isGridDraggable, setIsGridDraggable] = useState(true);
  const { data: dashboardData, loading: dashboardLoading } = useDashboardData();
  const layoutHydratedRef = useRef(false);
  const layoutSaveTimerRef = useRef(null);

  /* =======================
     ENGINE STATE
  ======================== */
  const [engineOn, setEngineOn] = useState(false);

  /* =======================
     WEATHER STATE
  ======================== */
  const [city, setCity] = useState(DEFAULT_CITY);
  const [locationLabel, setLocationLabel] = useState("Searching...");
  const [weather, setWeather] = useState({
    temp_c: null,
    condition: { text: "", icon: "" },
    isDay: null,
  });
  const [loading, setLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [weatherLocationDebug, setWeatherLocationDebug] = useState({
    detectedCoords: "Awaiting browser location",
    resolvedArea: "Resolving location",
    accuracyMeters: null,
    source: "browser",
    retries: 0,
  });
  const weatherAbortRef = useRef(null);
  const cityLiveSearchReadyRef = useRef(false);
  const currentLocationQueryRef = useRef("");
  const lastAcceptedCoordsRef = useRef(null);

  /* =======================
     FUEL STATE
  ======================== */
  const [fuel, setFuel] = useState({
    petrol: null,
    diesel: null,
    updatedAt: null,
  });
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelError, setFuelError] = useState(null);
  const pendingDragRef = useRef(null);
  const normalizedTopSearch = useMemo(() => topSearch.trim().toLowerCase(), [topSearch]);
  const matchingCardKeys = useMemo(() => {
    const topSearchTokens = normalizedTopSearch.split(/\s+/).filter(Boolean);

    return Object.entries(DASHBOARD_CARD_SEARCH_INDEX)
      .filter(([, terms]) =>
        topSearchTokens.length === 0
          ? true
          : topSearchTokens.every((token) =>
              terms.some((term) => term.toLowerCase().includes(token))
            )
      )
      .map(([key]) => key);
  }, [normalizedTopSearch]);
  const visibleCardCount = matchingCardKeys.length;
  const isCardVisible = (key) => matchingCardKeys.includes(key);

  const cleanupPendingDrag = useCallback(() => {
    const pending = pendingDragRef.current;
    if (!pending) return;

    window.removeEventListener("mousemove", pending.onMove);
    window.removeEventListener("mouseup", pending.onUp);
    pending.target?.classList.remove("drag-live");
    pendingDragRef.current = null;
  }, []);

  const handleDragHandleMouseDown = useCallback(
    (event) => {
      if (!isGridDraggable || event.button !== 0) return;
      if (event.currentTarget.classList.contains("drag-live")) return;

      cleanupPendingDrag();
      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
      const startX = event.clientX;
      const startY = event.clientY;

      const onMove = (moveEvent) => {
        const pending = pendingDragRef.current;
        if (!pending || pending.activated) return;

        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        if (Math.hypot(deltaX, deltaY) < DRAG_ACTIVATION_DISTANCE) return;

        pending.activated = true;
        target.classList.add("drag-live");
        window.removeEventListener("mousemove", onMove);

        target.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons: 1,
            clientX: moveEvent.clientX,
            clientY: moveEvent.clientY,
          })
        );
      };

      const onUp = () => {
        cleanupPendingDrag();
      };

      pendingDragRef.current = {
        target,
        onMove,
        onUp,
        activated: false,
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [cleanupPendingDrag, isGridDraggable]
  );

  useEffect(() => cleanupPendingDrag, [cleanupPendingDrag]);

  const renderDragHandle = () => {
    if (!isGridDraggable) return null;

    return (
      <div
        className={`card-drag-handle ${styles.cardDragHandle}`}
        aria-hidden="true"
        title="Drag widget"
        onMouseDown={handleDragHandleMouseDown}
      >
        <svg viewBox="0 0 24 24" className={styles.cardDragIcon}>
          <path
            d="M8 6.5h8M8 12h8M8 17.5h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="6" cy="6.5" r="1.25" fill="currentColor" />
          <circle cx="6" cy="12" r="1.25" fill="currentColor" />
          <circle cx="6" cy="17.5" r="1.25" fill="currentColor" />
        </svg>
      </div>
    );
  };

  const saveLayoutsToServer = useCallback(async (nextLayouts) => {
    await fetch(DASHBOARD_LAYOUT_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ layouts: nextLayouts }),
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadLayouts = async () => {
      try {
        const response = await fetch(DASHBOARD_LAYOUT_API, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;

        if (response.ok && payload?.layouts && typeof payload.layouts === "object") {
          setLayouts(normalizeLayouts(payload.layouts));
        } else {
          setLayouts(createDefaultLayouts());
        }
      } catch {
        if (!active) return;
        setLayouts(createDefaultLayouts());
      } finally {
        if (!active) return;
        layoutHydratedRef.current = true;
        setIsLayoutReady(true);
      }
    };

    loadLayouts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const fav = window.localStorage.getItem(DASHBOARD_FAVORITE_LAYOUT_KEY);
      setIsFavoriteLayout(Boolean(fav));
    } catch {
      // ignore localStorage failures
    }
  }, []);

  const handleLayoutChange = useCallback((_currentLayout, allLayouts) => {
    const normalized = normalizeLayouts(allLayouts);
    setLayouts(normalized);

    if (!layoutHydratedRef.current) return;

    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
    }

    layoutSaveTimerRef.current = window.setTimeout(() => {
      saveLayoutsToServer(normalized).catch(() => {});
      layoutSaveTimerRef.current = null;
    }, 450);
  }, [saveLayoutsToServer]);

  /* =======================
     HELPERS
  ======================== */
  const determineTimeOfDay = useCallback((localTimeStr) => {
    if (!localTimeStr) return "";
    const hour = parseInt(localTimeStr.split(" ")[1].split(":")[0], 10);
    if (hour >= 5 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 18) return "Evening";
    return "Night";
  }, []);

  const getCustomWeatherIcon = useCallback((conditionText, isDay) => {
    if (!conditionText) return "/Weather/Default.png";
    const condition = conditionText.toLowerCase();
    const isDayTime = isDay === true;

    if (condition.includes("sunny")) {
      return isDayTime ? "/Weather/MostlySunny.png" : "/Weather/Partly-Cloudy-(Night).png";
    }
    if (condition.includes("clear")) {
      return isDayTime ? "/Weather/MostlySunny.png" : "/Weather/Partly-Cloudy-(Night).png";
    }
    if (condition.includes("partly cloudy")) {
      return isDayTime ? "/Weather/PartlyCloudy(Day).png" : "/Weather/Partly-Cloudy-(Night).png";
    }

    if (
      condition.includes("rain") ||
      condition.includes("drizzle") ||
      condition.includes("shower") ||
      condition.includes("showers")
    ) {
      return "/Weather/Rainy.png";
    }

    if (condition.includes("thunder")) return "/Weather/Thunderstorm.png";

    if (
      condition.includes("snow") ||
      condition.includes("sleet") ||
      condition.includes("blizzard") ||
      condition.includes("ice")
    ) {
      return "/Weather/Default.png";
    }

    if (condition.includes("overcast")) {
      return "/Weather/Partly-Cloudy-with-Rain.png";
    }

    if (
      condition.includes("mist") ||
      condition.includes("fog") ||
      condition.includes("haze") ||
      condition.includes("smoke") ||
      condition.includes("dust") ||
      condition.includes("sand")
    ) {
      return "/Weather/Default.png";
    }

    return "/Weather/Default.png";
  }, []);

  const displayCondition = useCallback((text) => {
    if (!text) return "Loading...";
    if (text.toLowerCase().includes("mist")) return "Partly Cloudy (Day)";
    return text;
  }, []);

  const formatCoordinateLabel = useCallback((latitude, longitude, accuracyMeters) => {
    const coords = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
    if (!Number.isFinite(Number(accuracyMeters))) return coords;
    return `${coords} (±${Math.round(Number(accuracyMeters))}m)`;
  }, []);

  const calculateDistanceKm = useCallback((pointA, pointB) => {
    if (!pointA || !pointB) return 0;

    const toRadians = (value) => (Number(value) * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(pointB.latitude - pointA.latitude);
    const deltaLng = toRadians(pointB.longitude - pointA.longitude);
    const lat1 = toRadians(pointA.latitude);
    const lat2 = toRadians(pointB.latitude);

    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2) * Math.cos(lat1) * Math.cos(lat2);

    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }, []);

  const requestFreshPosition = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !navigator.geolocation) {
          reject(new Error("Geolocation is not supported"));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
      }),
    []
  );

  const isGeolocationSuspicious = useCallback(
    (position) => {
      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      const accuracyMeters = Number(position?.coords?.accuracy || 0);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return true;
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return true;
      if (accuracyMeters > GEOLOCATION_ACCURACY_RETRY_THRESHOLD_METERS) return true;

      const lastAccepted = lastAcceptedCoordsRef.current;
      if (!lastAccepted) return false;

      const distanceKm = calculateDistanceKm(lastAccepted, { latitude, longitude });
      return (
        distanceKm > GEOLOCATION_DISTANCE_RETRY_THRESHOLD_KM &&
        accuracyMeters > 500
      );
    },
    [calculateDistanceKm]
  );

  const formatWeatherLocationFallback = useCallback((location) => {
    if (!location || typeof location !== "object") return "Current location";

    const seen = new Set();
    const parts = [location.name, location.region, location.country].filter(Boolean).filter((part) => {
      const normalized = String(part).trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    return parts.join(", ") || "Current location";
  }, []);

  const reverseGeocodeWeatherLocation = useCallback(async (latitude, longitude, fallbackLocation) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${encodeURIComponent(
        latitude
      )}&lon=${encodeURIComponent(longitude)}`
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }

    const data = await response.json();
    const address = data?.address || {};
    const city =
      address.city ||
      address.town ||
      address.city_district ||
      address.municipality ||
      address.county ||
      address.state_district ||
      address.village ||
      fallbackLocation?.name;
    const region =
      address.state ||
      address.region ||
      address.province ||
      fallbackLocation?.region ||
      address.country ||
      fallbackLocation?.country;
    const seen = new Set();
    const parts = [city, region].filter(Boolean).filter((part) => {
      const normalized = String(part).trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    return {
      city: city || "",
      region: region || "",
      label: parts.join(", ") || formatWeatherLocationFallback(fallbackLocation) || data?.display_name || "Current location",
    };
  }, [formatWeatherLocationFallback]);

  /* =======================
     WEATHER FETCH
  ======================== */
  const fetchWeather = useCallback(
    async (query, options = {}) => {
      const { syncInput = false, preserveCurrentLocation = false, geoMeta = null } = options;
      if (!query || query.trim() === "") return;
      if (!WEATHER_API_KEY) {
        setWeatherError("Weather API key is missing.");
        return;
      }

      if (weatherAbortRef.current) {
        weatherAbortRef.current.abort();
      }

      const controller = new AbortController();
      weatherAbortRef.current = controller;

      setLoading(true);
      setWeatherError(null);

      try {
        const res = await fetch(
          `${WEATHER_API_URL}?key=${WEATHER_API_KEY}&q=${encodeURIComponent(
            query
          )}&aqi=no`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to fetch weather data");

        const data = await res.json();
        let resolvedLocation = {
          city: data?.location?.name || "",
          region: data?.location?.region || data?.location?.country || "",
          label: formatWeatherLocationFallback(data.location),
        };

        if (preserveCurrentLocation && data?.location?.lat && data?.location?.lon) {
          try {
            resolvedLocation = await reverseGeocodeWeatherLocation(
              data.location.lat,
              data.location.lon,
              data.location
            );
          } catch {
            resolvedLocation = {
              city: data?.location?.name || "",
              region: data?.location?.region || data?.location?.country || "",
              label: formatWeatherLocationFallback(data.location),
            };
          }
        }

        setWeather({
          temp_c: data.current.temp_c,
          condition: data.current.condition,
          isDay: data.current.is_day === 1,
        });
        setLocationLabel(resolvedLocation.label);
        setTimeOfDay(determineTimeOfDay(data.location.localtime));
        if (syncInput) {
          setCity(
            resolvedLocation.city ||
              resolvedLocation.region ||
              data.location.name ||
              data.location.region ||
              DEFAULT_CITY
          );
        }
        if (preserveCurrentLocation) {
          currentLocationQueryRef.current = query;
        }
        setWeatherLocationDebug((prev) => ({
          detectedCoords:
            geoMeta?.latitude && geoMeta?.longitude
              ? formatCoordinateLabel(geoMeta.latitude, geoMeta.longitude, geoMeta.accuracyMeters)
              : prev.detectedCoords,
          resolvedArea: resolvedLocation.label,
          accuracyMeters: geoMeta?.accuracyMeters ?? prev.accuracyMeters,
          source: geoMeta?.source || (preserveCurrentLocation ? "browser" : "manual-search"),
          retries: geoMeta?.retries ?? prev.retries,
        }));
      } catch (err) {
        if (err.name !== "AbortError") {
          setWeatherError("Please enter a valid city name");
          setTimeOfDay("");
        }
      } finally {
        setLoading(false);
      }
    },
    [
      determineTimeOfDay,
      formatCoordinateLabel,
      formatWeatherLocationFallback,
      reverseGeocodeWeatherLocation,
    ]
  );

  const fetchCurrentLocationWeather = useCallback(async () => {
    const fallbackQuery = city.trim() || DEFAULT_CITY;

    if (typeof window === "undefined" || !navigator.geolocation) {
      currentLocationQueryRef.current = "";
      setWeatherError("Current location is unavailable. Showing searched city instead.");
      fetchWeather(fallbackQuery, { syncInput: true });
      return;
    }

    let retries = 0;
    let position = null;
    let suspicious = false;

    while (retries < 2) {
      try {
        position = await requestFreshPosition();
      } catch (error) {
        const permissionDenied = error?.code === 1;
        currentLocationQueryRef.current = "";
        setWeatherError(
          permissionDenied
            ? "Location permission denied. Showing searched city instead."
            : "Could not detect current location. Showing searched city instead."
        );
        setWeatherLocationDebug((prev) => ({
          ...prev,
          detectedCoords: permissionDenied ? "Permission denied" : "Location unavailable",
          resolvedArea: prev.resolvedArea || "Awaiting manual city",
          source: "browser",
          retries,
        }));
        fetchWeather(fallbackQuery, { syncInput: true });
        return;
      }

      suspicious = isGeolocationSuspicious(position);
      const { latitude, longitude, accuracy } = position.coords;
      console.info("[Dashboard weather] Geolocation candidate", {
        latitude,
        longitude,
        accuracy,
        attempt: retries + 1,
      });

      if (!suspicious) break;
      retries += 1;
    }

    if (!position) return;

    const { latitude, longitude, accuracy } = position.coords;
    const coordinateQuery = `${latitude},${longitude}`;

    if (suspicious) {
      currentLocationQueryRef.current = "";
      setWeatherError(
        "Current location looks inaccurate. Please tap current location again or search your city manually."
      );
      setWeatherLocationDebug({
        detectedCoords: formatCoordinateLabel(latitude, longitude, accuracy),
        resolvedArea: "Unverified current location",
        accuracyMeters: accuracy,
        source: "browser",
        retries,
      });
      return;
    }

    lastAcceptedCoordsRef.current = { latitude, longitude };
    setWeatherError(null);
    setWeatherLocationDebug((prev) => ({
      ...prev,
      detectedCoords: formatCoordinateLabel(latitude, longitude, accuracy),
      resolvedArea: "Resolving area...",
      accuracyMeters: accuracy,
      source: "browser",
      retries,
    }));
    console.info("[Dashboard weather] Calling WeatherAPI with coordinates", {
      latitude,
      longitude,
      accuracy,
    });
    fetchWeather(coordinateQuery, {
      syncInput: true,
      preserveCurrentLocation: true,
      geoMeta: {
        latitude,
        longitude,
        accuracyMeters: accuracy,
        source: "browser",
        retries,
      },
    });
  }, [
    city,
    fetchWeather,
    formatCoordinateLabel,
    isGeolocationSuspicious,
    requestFreshPosition,
  ]);

  const handleWeatherSearch = () => {
    if (!city.trim()) return;
    currentLocationQueryRef.current = "";
    setWeatherLocationDebug((prev) => ({
      ...prev,
      detectedCoords: "Manual city search",
      source: "manual-search",
      retries: 0,
    }));
    fetchWeather(city.trim(), { syncInput: true });
  };

  const handleFavoriteClick = () => {
    if (typeof window === "undefined") return;
    try {
      if (isFavoriteLayout) {
        window.localStorage.removeItem(DASHBOARD_FAVORITE_LAYOUT_KEY);
        setIsFavoriteLayout(false);
      } else {
        window.localStorage.setItem(DASHBOARD_FAVORITE_LAYOUT_KEY, JSON.stringify(layouts));
        setIsFavoriteLayout(true);
      }
    } catch {
      // ignore localStorage failures
    }
  };

  const handleResetLayout = useCallback(() => {
    const defaultLayouts = createDefaultLayouts();
    setLayouts(defaultLayouts);
    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
      layoutSaveTimerRef.current = null;
    }
    saveLayoutsToServer(defaultLayouts).catch(() => {});
  }, [saveLayoutsToServer]);

  useEffect(() => {
    return () => {
      if (layoutSaveTimerRef.current) {
        window.clearTimeout(layoutSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchCurrentLocationWeather();
  }, [fetchCurrentLocationWeather]);

  useEffect(() => {
    const interval = setInterval(() => {
      const refreshQuery = currentLocationQueryRef.current || city;
      if (!refreshQuery) return;

      fetchWeather(refreshQuery, {
        syncInput: Boolean(currentLocationQueryRef.current),
        preserveCurrentLocation: Boolean(currentLocationQueryRef.current),
      });
    }, WEATHER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [city, fetchWeather]);

  useEffect(() => {
    if (!cityLiveSearchReadyRef.current) {
      cityLiveSearchReadyRef.current = true;
      return;
    }

    const query = city.trim();
    if (query.length < 2) return;

    const debounceId = setTimeout(() => {
      fetchWeather(query);
    }, 450);

    return () => clearTimeout(debounceId);
  }, [city, fetchWeather]);
  /* =======================
     FUEL FETCH
  ======================== */
  const fetchFuelRate = useCallback(async () => {
    setFuelLoading(true);
    setFuelError(null);

    try {
      const res = await fetch(`/api/fuel`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Fuel API failed");

      const data = await res.json();

      setFuel({
        petrol:
          data?.petrol ??
          data?.Petrol ??
          data?.petrolrate ??
          data?.petrolRate ??
          null,
        diesel:
          data?.diesel ??
          data?.Diesel ??
          data?.dieselrate ??
          data?.dieselRate ??
          null,
        updatedAt: data?.updatedAt ?? data?.lastupdated ?? data?.lastUpdated ?? null,
      });
    } catch (e) {
      setFuelError("Fuel rates load nahi ho rahe.");
    } finally {
      setFuelLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFuelTimer = window.setTimeout(() => {
      fetchFuelRate();
    }, 400);
    const t = setInterval(fetchFuelRate, FUEL_REFRESH_MS);
    return () => {
      window.clearTimeout(initialFuelTimer);
      clearInterval(t);
    };
  }, [fetchFuelRate]);

  useEffect(() => {
    if (typeof dashboardData?.engine?.on === "boolean") {
      setEngineOn(dashboardData.engine.on);
    }
  }, [dashboardData?.engine?.on]);

  const {
    savingAxisHigh,
    savingAxisMid,
    savingAxisLow,
    savingChart,
    savingDisplayValue,
    savingSubtitle,
    savingTooltipDisplayValue,
    engineTitle,
    engineSubtitle,
    engineOnLabel,
    engineOffLabel,
    donutSegments,
    desktopDonutSlices,
    desktopDonutPills,
    donutHasData,
    donutRadius,
    donutCenter,
    donutCircumference,
    avgHoursPart,
    avgMinsPart,
    dailyBars,
    dailySubtitle,
    dailyFooterTitle,
    dailyFooterSubtitle,
    overspeedScore,
    overspeedAlerts,
    overspeedMaxSpeed,
    avgDrivingHours,
    avgDrivingMinutes,
    avgDrivingTitle,
    avgDrivingMeta,
    linePoints,
    hoursValue,
    hoursRows,
    hoursTitle,
    hoursUnitLabel,
    usageData,
    alertsSummary,
    alertsDetail,
    workloadBars,
    hasUsageData,
    hasWorkloadData,
  } = useMemo(() => {
    const savingAmount = Number(dashboardData?.saving?.amount || 0);
    const savingTooltip = Number(dashboardData?.saving?.tooltip || savingAmount);
    const savingSubtitleValue =
      dashboardData?.saving?.subtitle || "Vehicles reporting right now";
    const savingDisplayValue =
      dashboardData?.saving?.displayValue || String(savingAmount);
    const savingTooltipDisplayValue =
      dashboardData?.saving?.tooltipDisplayValue || String(savingTooltip);
    const savingSeries =
      Array.isArray(dashboardData?.saving?.series) && dashboardData.saving.series.length > 1
        ? dashboardData.saving.series
        : SAVING_SERIES;
    const savingMaxValue = Math.max(...savingSeries.map((value) => Number(value || 0)), 1);
    const savingAxisHigh = Math.round(savingMaxValue);
    const savingAxisMid = Math.round(savingMaxValue * 0.6);
    const savingAxisLow = Math.round(savingMaxValue * 0.2);
    const savingChart = isMobileView
      ? null
      : buildSavingChart(
          savingSeries,
          dashboardData?.saving?.markerIndex ?? Math.min(14, savingSeries.length - 1)
        );

    const donutSegments = Array.isArray(dashboardData?.donut?.segments)
      ? dashboardData.donut.segments
      : [];
    const donutRadius = 66;
    const donutCenter = 110;
    const donutCircumference = 2 * Math.PI * donutRadius;
    let desktopDonutSlices = [];
    let desktopDonutPills = [];
    let donutHasData = false;

    if (!isMobileView) {
      const desktopDonutSegments = MOBILE_FLEET_STATUS_ORDER.map((segment) => {
        const matched = donutSegments.find(
          (item) => String(item?.label || "").trim().toLowerCase() === segment.label.toLowerCase()
        );

        return {
          label: segment.label,
          value: Number(matched?.value || 0),
          color: matched?.color || segment.color,
        };
      });
      const donutTotal =
        desktopDonutSegments.reduce((sum, segment) => sum + Number(segment?.value || 0), 0) || 1;
      donutHasData = desktopDonutSegments.some((segment) => Number(segment?.value || 0) > 0);
      let donutOffset = 0;

      desktopDonutSlices = desktopDonutSegments.map((segment) => {
        const value = Number(segment.value || 0);
        const percent = Math.round((value / donutTotal) * 100);
        const arc = (value / donutTotal) * donutCircumference;
        const dashOffset = -donutOffset;
        const midAngle =
          ((donutOffset + arc / 2) / donutCircumference) * Math.PI * 2 - Math.PI / 2;
        const pillRadius = 88;
        const pillLeft = donutCenter + Math.cos(midAngle) * pillRadius;
        const pillTop = donutCenter + Math.sin(midAngle) * pillRadius;
        donutOffset += arc;

        return {
          ...segment,
          percent,
          arc,
          dashOffset,
          pillStyle: {
            left: `${(pillLeft / 220) * 100}%`,
            top: `${(pillTop / 220) * 100}%`,
            transform: "translate(-50%, -50%)",
          },
        };
      });

      desktopDonutPills = desktopDonutSlices.filter((segment) => segment.percent > 0);
    }

    const avgMinutes = Number(dashboardData?.daily?.averageMinutes || 0);
    const avgHoursPart = Math.floor(avgMinutes / 60);
    const avgMinsPart = avgMinutes % 60;
    const dailyBars = Array.isArray(dashboardData?.daily?.bars) ? dashboardData.daily.bars : [];
    const dailySubtitle = dashboardData?.daily?.subtitle || "Top branches by live vehicle count";
    const dailyFooterTitle = dashboardData?.daily?.footerTitle || "Set Daily Reminder";
    const dailyFooterSubtitle =
      dashboardData?.daily?.footerSubtitle || "Reminder after you reached daily limit";
    const alertsSummary = dashboardData?.daily?.footerTitle || "No active alerts";
    const alertsDetail = dashboardData?.daily?.footerSubtitle || "High 0 | Medium 0 | Low 0";

    const overspeedScore = Number(dashboardData?.overspeed?.score || 0).toFixed(2);
    const overspeedAlerts = String(Number(dashboardData?.overspeed?.alerts || 0)).padStart(2, "0");
    const overspeedMaxSpeed = Number(dashboardData?.overspeed?.maxSpeed || 0);

    const avgDrivingHours = Number(dashboardData?.avgDriving?.hours || 0);
    const avgDrivingMinutes = Number(dashboardData?.avgDriving?.minutes || 0);
    const avgDrivingTitle = dashboardData?.avgDriving?.title || "Average Driving";
    const avgDrivingMeta = dashboardData?.avgDriving?.meta || "Daily average";

    const lineSeries = dashboardData?.lineCard?.series || {};
    const activeLineSeries = lineSeries[lineRange] || lineSeries.day || [];
    const linePoints = isMobileView ? "" : buildPolylinePoints(activeLineSeries);

    const hoursValue = Number(dashboardData?.hours?.value || 0);
    const hoursRows = Array.isArray(dashboardData?.hours?.rows) ? dashboardData.hours.rows : [];
    const hoursTitle = dashboardData?.hours?.title || "Branch Utilization";
    const hoursUnitLabel = dashboardData?.hours?.unitLabel || "Hours spent";
    const usageData = dashboardData?.usage || { totalDistanceKm: 0, avgDistanceKm: 0, bars: [] };
    const hasDashboardApiData = Boolean(dashboardData?.generatedAt);
    const rawWorkloadSeries = Array.isArray(dashboardData?.lineCard?.series?.day)
      ? dashboardData.lineCard.series.day.slice(0, 12)
      : [];
    const maxWorkloadValue = Math.max(...rawWorkloadSeries.map((value) => Number(value || 0)), 0);
    const workloadBars = rawWorkloadSeries.map((value, index) => ({
      label: String(index + 1),
      heightPercent:
        maxWorkloadValue > 0 ? Math.round((Number(value || 0) / maxWorkloadValue) * 100) : 0,
    }));
    const hasUsageData =
      hasDashboardApiData &&
      Array.isArray(usageData?.bars) &&
      usageData.bars.some((bar) => Number(bar?.value || 0) > 0);
    const hasWorkloadData =
      hasDashboardApiData &&
      workloadBars.some((bar) => Number(bar?.heightPercent || 0) > 0);

    return {
      savingAxisHigh,
      savingAxisMid,
      savingAxisLow,
      savingChart,
      savingDisplayValue,
      savingSubtitle: savingSubtitleValue,
      savingTooltipDisplayValue,
      engineTitle: dashboardData?.engine?.title || "Engine",
      engineSubtitle: dashboardData?.engine?.subtitle || "Switch",
      engineOnLabel: dashboardData?.engine?.onLabel || "ON",
      engineOffLabel: dashboardData?.engine?.offLabel || "OFF",
      donutSegments,
      desktopDonutSlices,
      desktopDonutPills,
      donutHasData,
      donutRadius,
      donutCenter,
      donutCircumference,
      avgHoursPart,
      avgMinsPart,
      dailyBars,
      dailySubtitle,
      dailyFooterTitle,
      dailyFooterSubtitle,
      overspeedScore,
      overspeedAlerts,
      overspeedMaxSpeed,
      avgDrivingHours,
      avgDrivingMinutes,
      avgDrivingTitle,
      avgDrivingMeta,
      linePoints,
      hoursValue,
      hoursRows,
      hoursTitle,
      hoursUnitLabel,
      usageData,
      alertsSummary,
      alertsDetail,
      workloadBars,
      hasUsageData,
      hasWorkloadData,
    };
  }, [dashboardData, isMobileView, lineRange]);
  const isCustomLayout = useMemo(
    () => JSON.stringify(layouts) !== DEFAULT_LAYOUT_SNAPSHOT_STRING,
    [layouts]
  );
  const weatherVisualTheme = useMemo(
    () => getWeatherVisualTheme(weather?.condition, weather?.isDay),
    [weather?.condition, weather?.isDay]
  );
  const weatherDebugLineStyle = {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 1.35,
    color: "#74809a",
    fontWeight: 600,
  };

  if (isMobileView) {
    return (
      <div className={styles.mobileDashPage}>
        <MobileHeader />
        <div className={styles.mobileDashStack}>
          <MobileFleetStatusCard segments={donutSegments} />
          <MobileFleetUsageCard usage={usageData} />
          <MobileFleetIdleCard />
          <section className={styles.mobileDashTileGrid}>
            {MOBILE_ALERT_TILES.map((tile) => (
              <MobileInfoTile key={tile.title} {...tile} />
            ))}
          </section>
          <MobileReminderCard title="Maintenance Reminder" accent="gray" />
          <MobileReminderCard title="Renewal Reminder" accent="gray" />
          <MobileFleetFuelCard
            petrol={fuelLoading ? "..." : fuel.petrol ? `Rs. ${fuel.petrol}` : "--"}
            diesel={fuelLoading ? "..." : fuel.diesel ? `Rs. ${fuel.diesel}` : "--"}
          />
          <MobileObjectModeCard />
          <MobileFleetWorkloadCard bars={hasWorkloadData ? workloadBars : []} />
          <MobileCollapsedCard title="Object Type" />
          <MobileWorkEfficiencyCard />
          <MobileAlertsCard summary={alertsSummary} detail={alertsDetail} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* TOP BAR */}
      <div className={styles.topBar}>
        <div className={styles.topSearchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 18.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
                stroke="#777"
                strokeWidth="2"
              />
              <path
                d="M16.5 16.5 21 21"
                stroke="#777"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            className={styles.topSearch}
            type="search"
            placeholder="Search widgets like weather, fuel, speed..."
            value={topSearch}
            onChange={(e) => setTopSearch(e.target.value)}
            aria-label="Search dashboard"
          />
          <span className={styles.topSearchStatus}>
            {normalizedTopSearch
              ? `${visibleCardCount} match${visibleCardCount === 1 ? "" : "es"}`
              : "All widgets"}
          </span>
          {topSearch ? (
            <button
              type="button"
              className={styles.topSearchClear}
              onClick={() => setTopSearch("")}
              aria-label="Clear dashboard search"
            >
              &times;
            </button>
          ) : null}
        </div>

        <div className={styles.topActions}>
          <button
            className={`${styles.iconBtn} ${isFavoriteLayout ? styles.iconBtnActive : ""}`}
            aria-label="Favorite"
            title={isFavoriteLayout ? "Remove favorite layout" : "Save favorite layout"}
            onClick={handleFavoriteClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3.5 14.7 9l6 .6-4.6 3.9 1.4 5.8-5.5-3.2-5.5 3.2 1.4-5.8L3.3 9.6l6-.6L12 3.5Z"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className={`${styles.iconBtn} ${isCompactView ? styles.iconBtnActive : ""}`}
            aria-label="Filter"
            title={isCompactView ? "Disable compact view" : "Enable compact view"}
            onClick={() => setIsCompactView((prev) => !prev)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className={`${styles.iconBtn} ${!isGridDraggable ? styles.iconBtnActive : ""}`}
            aria-label="Grid"
            title={isGridDraggable ? "Lock widget positions" : "Unlock widget positions"}
            onClick={() => setIsGridDraggable((prev) => !prev)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
                stroke="#fff"
                strokeWidth="2"
              />
            </svg>
          </button>

          <button
            className={`${styles.iconBtn} ${isCustomLayout ? styles.iconBtnActive : ""}`}
            aria-label="Restore default layout"
            title={isCustomLayout ? "Restore default layout" : "Layout already at default"}
            onClick={handleResetLayout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12a8 8 0 1 0 2.3-5.7"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M4 4v4h4"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* GRID */}
      {isLayoutReady && (
        <ResponsiveGridLayout
          className={styles.dashboardGrid}
          layouts={layouts}
          breakpoints={{ lg: 1440, md: 1200, sm: 900, xs: 640, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={isCompactView ? 36 : 42}
          margin={isCompactView ? [8, 8] : [10, 10]}
          containerPadding={[0, 0]}
          draggableCancel={"input,textarea,select,option,button,a,[role='button']"}
          draggableHandle={".card-drag-handle.drag-live"}
          isResizable={false}
          isDraggable={isGridDraggable}
          onLayoutChange={handleLayoutChange}
          onDragStop={cleanupPendingDrag}
        >
        {/* WEATHER */}
        {isCardVisible("weather") && (
        <div key="weather" className={styles.gridItem}>
        <div
          className={`${styles.card} ${styles.weather} ${styles[`weatherCard${weatherVisualTheme
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join("")}`]}`}
        >
          <WeatherBackdrop theme={weatherVisualTheme} />
          <div className={styles.weatherOverlay} />
          <div className={styles.weatherContent}>
          {renderDragHandle()}
          <div className={styles.weatherTopRow}>
            <div className={styles.weatherSearchRow}>
              <input
                className={styles.weatherInput}
                placeholder="Search city weather"
                value={city}
                onChange={(e) => {
                  currentLocationQueryRef.current = "";
                  setCity(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleWeatherSearch();
                }}
                disabled={loading}
                aria-label="Search weather by city"
              />
              <button
                type="button"
                className={styles.weatherCurrentBtn}
                onClick={fetchCurrentLocationWeather}
                aria-label="Use current location weather"
                title="Use current location"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v4M12 17v4M3 12h4M17 12h4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
                </svg>
              </button>
            </div>

            <div className={styles.weatherRight}>
              <div className={styles.weatherTitle}>
                <Image
                  src={
                    weather?.condition?.text && !loading
                      ? getCustomWeatherIcon(weather.condition.text, weather.isDay)
                      : "/Weather/Default.png"
                  }
                  alt=""
                  width={14}
                  height={14}
                  unoptimized
                />
                <span>Weather</span>
              </div>

              <div className={styles.weatherCondition}>
                {loading
                  ? "Loading..."
                  : weather?.condition?.text
                  ? displayCondition(weather.condition.text)
                  : "Loading..."}
              </div>
            </div>
          </div>

          <div className={styles.weatherMain}>
            <div className={styles.weatherTemp}>
              {loading
                ? "Loading..."
                : weather.temp_c !== null
                ? `${weather.temp_c}\u00b0`
                : "--"}
            </div>

            <div className={styles.weatherMeta}>
              <div className={styles.weatherLoc}>
                {locationLabel} {timeOfDay ? `- ${timeOfDay}` : ""}
              </div>
              <div style={weatherDebugLineStyle}>
                Detected location: {weatherLocationDebug.detectedCoords}
              </div>
              <div style={weatherDebugLineStyle}>
                Resolved area: {weatherLocationDebug.resolvedArea}
              </div>
            </div>

            {weatherError && (
              <div className={styles.weatherError} role="alert" aria-live="polite">
                {weatherError}
              </div>
            )}
          </div>
          </div>
        </div>
        </div>
        )}

        {/* ENGINE */}
        {isCardVisible("engine") && (
        <div key="engine" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.engine}`}>
          {renderDragHandle()}
          <div className={styles.engineLeft}>
            <div className={styles.engineTitle}>{engineTitle}</div>
            <div className={styles.engineSub}>{engineSubtitle}</div>
          </div>

          <label className={styles.engineToggle} aria-label="Engine switch">
            <input
              type="checkbox"
              checked={engineOn}
              onChange={() => {}}
              readOnly
            />
            <span className={styles.engineTrack}>
              <span className={styles.engineKnob}>{engineOn ? engineOnLabel : engineOffLabel}</span>
            </span>
          </label>
        </div>
        </div>
        )}

        {/* TIME */}
        {isCardVisible("time") && (
        <div key="time" className={styles.gridItem}>
        <DashboardTimeCard dragHandle={renderDragHandle()} />
        </div>
        )}

        {/* SAVING (static display, same as design) */}
        {isCardVisible("saving") && (
        <div key="saving" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.saving}`}>
          {renderDragHandle()}
          <div className={styles.savingTop}>
            <div className={styles.savingAmount}>
              {dashboardLoading ? "..." : savingDisplayValue}
            </div>
            <div className={styles.savingSub}>{savingSubtitle}</div>
          </div>

          <div className={styles.savingChart}>
            <div className={styles.tooltip} style={{ left: `${savingChart.markerLeftPercent}%` }}>
              {dashboardLoading ? "..." : savingTooltipDisplayValue}
            </div>

            <svg
              viewBox="0 0 520 220"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              className={styles.savingSvg}
            >
              <defs>
                <linearGradient id="savingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5064f5" stopOpacity="0.62" />
                  <stop offset="100%" stopColor="#5064f5" stopOpacity="0.06" />
                </linearGradient>
              </defs>

              <line x1="32" y1="44" x2="502" y2="44" className={styles.savingGridLine} />
              <line x1="32" y1="110" x2="502" y2="110" className={styles.savingGridLine} />
              <line x1="32" y1="186" x2="502" y2="186" className={styles.savingBaseLine} />

              <path
                d={savingChart.areaPath}
                fill="url(#savingAreaGrad)"
              />

              <line
                x1={savingChart.markerPoint.x}
                y1="14"
                x2={savingChart.markerPoint.x}
                y2="186"
                className={styles.savingMarkerLine}
              />

              <path
                d={savingChart.linePath}
                fill="none"
                className={styles.savingLine}
              />

              <circle
                cx={savingChart.markerPoint.x}
                cy={savingChart.markerPoint.y}
                r="10"
                className={styles.savingMarkerOuter}
              />
              <circle
                cx={savingChart.markerPoint.x}
                cy={savingChart.markerPoint.y}
                r="5.5"
                className={styles.savingMarkerInner}
              />
            </svg>

            <div className={styles.savingAxis}>
              <span>{savingAxisHigh}</span>
              <span>{savingAxisMid}</span>
              <span>{savingAxisLow}</span>
            </div>

            <div className={styles.savingMonths}>
              <span>Live</span>
              <span>Trend</span>
              <span>Now</span>
            </div>
          </div>

          <button className={styles.detailsBtn}>Details</button>
        </div>
        </div>
        )}

        {/* DONUT */}
        {isCardVisible("donut") && (
        <div key="donut" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.donutCard}`}>
          {renderDragHandle()}
          <div className={styles.donutHeaderRow}>
            <button className={styles.donutNavBtn} aria-label="Previous month">
              &#8249;
            </button>

            <div className={styles.donutHeaderTitle}>
              {dashboardData?.donut?.month || "Month"}
            </div>

            <button className={styles.donutNavBtn} aria-label="Next month">
              &#8250;
            </button>
          </div>

          <div className={styles.donutBody}>
            <div className={styles.donutLegend}>
              {desktopDonutSlices.map((segment) => (
                <div key={`${segment.label}-legend`} className={styles.legendRow}>
                  <div className={styles.legendLeft}>
                    <span className={styles.dot} style={{ background: segment.color }} />
                    <span>{segment.label}</span>
                  </div>
                  <div className={styles.legendRight}>{segment.percent}%</div>
                </div>
              ))}
            </div>

            <div className={styles.donutWrap}>
              <svg
                className={styles.donutSvg}
                viewBox="0 0 220 220"
                width="206"
                height="206"
                role="img"
                aria-label="Donut chart"
              >
                <circle
                  className={`${styles.donutTrack} ${!donutHasData ? styles.donutTrackEmpty : ""}`}
                  cx={donutCenter}
                  cy={donutCenter}
                  r={donutRadius}
                  fill="none"
                  stroke={!donutHasData ? "#dfe3ec" : "#eceef5"}
                  strokeWidth="40"
                />
                {desktopDonutSlices.map((segment) => (
                  <circle
                    key={segment.label}
                    className={`${styles.donutSegment} ${!donutHasData ? styles.segMuted : ""}`}
                    cx={donutCenter}
                    cy={donutCenter}
                    r={donutRadius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="36"
                    strokeDasharray={`${segment.arc} ${donutCircumference}`}
                    strokeDashoffset={segment.dashOffset}
                  />
                ))}
              </svg>

              {(desktopDonutPills.length > 0 ? desktopDonutPills : desktopDonutSlices.slice(0, 1)).map((segment) => (
                <div key={`${segment.label}-pill`} className={styles.pill} style={segment.pillStyle}>
                  {segment.percent}%
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
        )}

        {/* DAILY */}
        {isCardVisible("daily") && (
        <div key="daily" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.daily}`}>
          {renderDragHandle()}
          <div className={styles.dailyTop}>
            <div className={styles.dailyMetricRow}>
              <div className={styles.dailyBig}>
                {avgHoursPart}h {avgMinsPart}m
              </div>
              <span className={styles.blueArrow} aria-hidden="true">
                &darr;
              </span>
            </div>
            <div className={styles.dailySub}>{dailySubtitle}</div>
          </div>

          <div className={styles.dailyBars}>
            {dailyBars.map((x, idx) => (
              <div key={idx} className={styles.dailyCol}>
                <div
                  className={styles.dailyBar}
                  style={{ height: `${Math.max(Number(x.h || 0), 20)}px` }}
                />
                <div className={styles.dailyLbl}>{x.d}</div>
              </div>
            ))}
          </div>

          <div className={styles.reminderRow}>
            <div>
              <div className={styles.remTitle}>{dailyFooterTitle}</div>
              <div className={styles.remSub}>{dailyFooterSubtitle}</div>
            </div>
            <div className={styles.remGo} aria-hidden="true">
              &#8250;
            </div>
          </div>
        </div>
        </div>
        )}

        {/* OVERSPEED */}
        {isCardVisible("overspeed") && (
        <div key="overspeed" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.overspeed}`}>
          {renderDragHandle()}
          <div className={styles.smallTitle}>Overspeed</div>

          <div className={styles.gaugeWrap}>
            <svg viewBox="0 0 200 120" className={styles.gaugeSvg}>
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#e6e6e6"
                strokeWidth="18"
              />
              <path
                d="M 20 100 A 80 80 0 0 1 100 20"
                fill="none"
                stroke="url(#g1)"
                strokeWidth="18"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2f4aff" />
                  <stop offset="100%" stopColor="#d300ff" />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b039ff" />
                  <stop offset="100%" stopColor="#4400ff" />
                </linearGradient>
              </defs>

              <polygon points="104,22 96,98 112,98" fill="url(#g2)" opacity="0.7" />
              <circle cx="104" cy="98" r="7" fill="url(#g2)" />
            </svg>

            <div className={styles.gaugeCenter}>{overspeedScore}</div>

            <div className={styles.gaugeBottom}>
              <div>
                <div className={styles.alertLbl}>Alert</div>
                <div className={styles.alertVal}>{overspeedAlerts}</div>
              </div>
              <div className={styles.maxSpeed}>
                <div>Max speed</div>
                <div>{overspeedMaxSpeed} km/h</div>
              </div>
            </div>
          </div>
        </div>
        </div>
        )}

        {/* AVERAGE DRIVING */}
        {isCardVisible("avgDriving") && (
        <div key="avgDriving" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.avgDriving}`}>
          {renderDragHandle()}
          <div className={styles.avgDrivingHeader}>
            <div className={styles.avgDrivingTitle}>{avgDrivingTitle}</div>
            <div className={styles.avgDrivingMeta}>{avgDrivingMeta}</div>
          </div>
          <div className={styles.avgDrivingValueBlock}>
            <div className={styles.avgDrivingPrimary}>
              {avgDrivingHours}
              <span> hrs</span>
            </div>
            <div className={styles.avgDrivingSecondary}>
              {String(avgDrivingMinutes).padStart(2, "0")}
              <span> mins</span>
            </div>
          </div>
        </div>
        </div>
        )}

        {/* LINE CHART */}
        {isCardVisible("lineCard") && (
        <div key="lineCard" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.lineCard}`}>
          {renderDragHandle()}
          <div className={styles.lineTop}>
            <div className={styles.lineTitle}>
              {dashboardData?.lineCard?.title || "Vehicle Activity"}
            </div>
            <div className={styles.lineBig}>{dashboardData?.lineCard?.value ?? 0}</div>
          </div>

          <div className={styles.lineArea}>
            <div className={styles.dashed} />
            <div className={styles.dashed} />

            <svg viewBox="0 0 520 180" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="#2256ff"
                strokeWidth="4"
                points={linePoints}
              />
            </svg>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${lineRange === "day" ? styles.activeTab : ""}`}
              onClick={() => setLineRange("day")}
            >
              1 Day
            </button>
            <button
              className={`${styles.tab} ${lineRange === "month" ? styles.activeTab : ""}`}
              onClick={() => setLineRange("month")}
            >
              1 Month
            </button>
            <button
              className={`${styles.tab} ${lineRange === "year" ? styles.activeTab : ""}`}
              onClick={() => setLineRange("year")}
            >
              1 Year
            </button>
            <button
              className={`${styles.tab} ${lineRange === "max" ? styles.activeTab : ""}`}
              onClick={() => setLineRange("max")}
            >
              Max
            </button>
          </div>
        </div>
        </div>
        )}

        {/* HOURS */}
        {isCardVisible("hours") && (
        <div key="hours" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.hours}`}>
          {renderDragHandle()}
          <div className={styles.hoursHeader}>
            <span className={styles.hoursIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="9" width="18" height="2" rx="1" fill="#28bd67" />
                <rect x="3" y="5" width="12" height="2" rx="1" fill="#28bd67" opacity="0.7" />
                <rect x="3" y="13" width="8" height="2" rx="1" fill="#28bd67" opacity="0.7" />
              </svg>
            </span>
            <span className={styles.hoursTitle}>{hoursTitle}</span>
          </div>

          <div className={styles.hoursBigRow}>
            <div className={styles.hoursBig}>{hoursValue}</div>
            <div className={styles.hoursSmall}>
              {hoursUnitLabel.split(" ").map((part) => (
                <div key={part}>{part}</div>
              ))}
            </div>
          </div>

          <div className={styles.hoursChart}>
            <div className={styles.hoursGuide} style={{ left: "37%" }} aria-hidden="true" />
            <div className={styles.hoursGuide} style={{ left: "79%" }} aria-hidden="true" />

            <div className={styles.hBars}>
              {hoursRows.map((r) => (
                <div key={r.m} className={styles.hRow}>
                  <div className={styles.hLbl}>{r.m}</div>
                  <div className={styles.hTrack}>
                    <div className={styles.hBlue} style={{ width: `${r.b}%` }} />
                    <div className={styles.hGreen} style={{ left: `${r.b}%`, width: `${r.g}%` }} />
                    <div
                      className={styles.hGrey}
                      style={{ left: `${r.b + r.g}%`, width: `${r.grey}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.hoursScale} aria-hidden="true">
              <span>0</span>
              <span>20</span>
              <span>40</span>
              <span>60</span>
              <span>80</span>
              <span>100</span>
            </div>
          </div>
        </div>
        </div>
        )}

        {/* FUEL (DYNAMIC) */}
        {isCardVisible("fuel") && (
        <div key="fuel" className={styles.gridItem}>
        <div className={`${styles.card} ${styles.fuel}`}>
          {renderDragHandle()}
          <div className={styles.fuelHead}>
            <span className={styles.fuelIcon} aria-hidden="true">
              {"\u26fd"}
            </span>
            <span>Fuel Prices (PKR / Litre)</span>
          </div>

          <div className={styles.fuelGrid}>
            <div className={styles.fuelBox}>
              <div className={styles.fuelLbl}>Petrol</div>
              <div className={styles.fuelVal}>
                {fuelLoading ? "Loading..." : fuel.petrol ? `Rs. ${fuel.petrol}` : "--"}
              </div>
            </div>

            <div className={styles.fuelBox}>
              <div className={styles.fuelLbl}>Diesel</div>
              <div className={styles.fuelVal}>
                {fuelLoading ? "Loading..." : fuel.diesel ? `Rs. ${fuel.diesel}` : "--"}
              </div>
            </div>
          </div>

          <div className={styles.updated}>
            {fuelError
              ? fuelError
              : fuel.updatedAt
              ? `Last updated: ${fuel.updatedAt}`
              : "Last updated: --"}
          </div>
        </div>
        </div>
        )}
      </ResponsiveGridLayout>
      )}
      {isLayoutReady && visibleCardCount === 0 ? (
        <div className={styles.searchEmpty}>
          No widget matched &quot;{topSearch}&quot;. Try weather, fuel, speed, or activity.
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
