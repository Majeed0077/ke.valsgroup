"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const REFRESH_MS = 30000;

const FALLBACK_DATA = {
  generatedAt: null,
  engine: {
    title: "Engine",
    subtitle: "No vehicles reporting right now",
    on: false,
    onLabel: "ON",
    offLabel: "OFF",
  },
  saving: {
    amount: 0,
    displayValue: "0",
    subtitle: "Vehicles reporting right now",
    tooltip: 0,
    tooltipDisplayValue: "0 ON",
    series: [0, 0, 0, 0, 0, 0, 0, 0],
    markerIndex: 4,
  },
  donut: {
    month: "Live fleet split",
    segments: [
      { label: "Running", value: 0, color: "#3DDC84" },
      { label: "Idle", value: 0, color: "#F4C542" },
      { label: "Stopped", value: 0, color: "#FF5A5F" },
      { label: "InActive", value: 0, color: "#2F81F7" },
      { label: "No Data", value: 0, color: "#6B7280" },
    ],
  },
  usage: {
    totalDistanceKm: 0,
    avgDistanceKm: 0,
    bars: Array.from({ length: 12 }, (_, index) => ({
      label: String(index + 1),
      value: 0,
      heightPercent: 10,
    })),
  },
  daily: {
    title: "Branch Activity",
    subtitle: "Top branches by live vehicle count",
    averageMinutes: 0,
    bars: [
      { d: "A", h: 20 },
      { d: "B", h: 20 },
      { d: "C", h: 20 },
      { d: "D", h: 20 },
      { d: "E", h: 20 },
      { d: "F", h: 20 },
      { d: "G", h: 20 },
    ],
    footerTitle: "0 unacknowledged alerts",
    footerSubtitle: "High 0 | Medium 0 | Low 0",
  },
  overspeed: {
    score: 0,
    alerts: 0,
    maxSpeed: 0,
  },
  avgDriving: {
    title: "Average Driving",
    meta: "Estimated from live running telemetry",
    hours: 0,
    minutes: 0,
  },
  lineCard: {
    title: "Vehicle Activity",
    value: 0,
    series: {
      day: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      month: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      year: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      max: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  hours: {
    title: "Branch Utilization",
    value: 0,
    unitLabel: "Avg km/h",
    rows: [
      { m: "A", b: 0, g: 0, grey: 10 },
      { m: "B", b: 0, g: 0, grey: 10 },
      { m: "C", b: 0, g: 0, grey: 10 },
      { m: "D", b: 0, g: 0, grey: 10 },
      { m: "E", b: 0, g: 0, grey: 10 },
      { m: "F", b: 0, g: 0, grey: 10 },
    ],
  },
};

const normalizeData = (raw) => {
  if (!raw || typeof raw !== "object") return FALLBACK_DATA;

  const safeDailyBars =
    Array.isArray(raw?.daily?.bars) && raw.daily.bars.length > 0
      ? raw.daily.bars
      : FALLBACK_DATA.daily.bars;

  const safeDonutSegments =
    Array.isArray(raw?.donut?.segments) && raw.donut.segments.length > 0
      ? raw.donut.segments
      : FALLBACK_DATA.donut.segments;

  const safeHoursRows =
    Array.isArray(raw?.hours?.rows) && raw.hours.rows.length > 0
      ? raw.hours.rows
      : FALLBACK_DATA.hours.rows;

  const safeUsageBars =
    Array.isArray(raw?.usage?.bars) && raw.usage.bars.length > 0
      ? raw.usage.bars
      : FALLBACK_DATA.usage.bars;

  const safeSavingSeries =
    Array.isArray(raw?.saving?.series) && raw.saving.series.length > 1
      ? raw.saving.series.map((value) => Number(value || 0))
      : FALLBACK_DATA.saving.series;

  return {
    generatedAt: raw.generatedAt ?? FALLBACK_DATA.generatedAt,
    engine: {
      title: raw?.engine?.title ?? FALLBACK_DATA.engine.title,
      subtitle: raw?.engine?.subtitle ?? FALLBACK_DATA.engine.subtitle,
      on: Boolean(raw?.engine?.on ?? FALLBACK_DATA.engine.on),
      onLabel: raw?.engine?.onLabel ?? FALLBACK_DATA.engine.onLabel,
      offLabel: raw?.engine?.offLabel ?? FALLBACK_DATA.engine.offLabel,
    },
    saving: {
      amount: Number(raw?.saving?.amount ?? FALLBACK_DATA.saving.amount),
      displayValue:
        raw?.saving?.displayValue ??
        String(raw?.saving?.amount ?? FALLBACK_DATA.saving.displayValue),
      subtitle: raw?.saving?.subtitle ?? FALLBACK_DATA.saving.subtitle,
      tooltip: Number(raw?.saving?.tooltip ?? raw?.saving?.amount ?? FALLBACK_DATA.saving.tooltip),
      tooltipDisplayValue:
        raw?.saving?.tooltipDisplayValue ??
        String(raw?.saving?.tooltip ?? raw?.saving?.amount ?? FALLBACK_DATA.saving.tooltipDisplayValue),
      series: safeSavingSeries,
      markerIndex: Number(raw?.saving?.markerIndex ?? FALLBACK_DATA.saving.markerIndex),
    },
    donut: {
      month: raw?.donut?.month ?? FALLBACK_DATA.donut.month,
      segments: safeDonutSegments,
    },
    usage: {
      totalDistanceKm: Number(raw?.usage?.totalDistanceKm ?? FALLBACK_DATA.usage.totalDistanceKm),
      avgDistanceKm: Number(raw?.usage?.avgDistanceKm ?? FALLBACK_DATA.usage.avgDistanceKm),
      bars: safeUsageBars,
    },
    daily: {
      title: raw?.daily?.title ?? FALLBACK_DATA.daily.title,
      subtitle: raw?.daily?.subtitle ?? FALLBACK_DATA.daily.subtitle,
      averageMinutes: Number(raw?.daily?.averageMinutes ?? FALLBACK_DATA.daily.averageMinutes),
      bars: safeDailyBars,
      footerTitle: raw?.daily?.footerTitle ?? FALLBACK_DATA.daily.footerTitle,
      footerSubtitle: raw?.daily?.footerSubtitle ?? FALLBACK_DATA.daily.footerSubtitle,
    },
    overspeed: {
      score: Number(raw?.overspeed?.score ?? FALLBACK_DATA.overspeed.score),
      alerts: Number(raw?.overspeed?.alerts ?? FALLBACK_DATA.overspeed.alerts),
      maxSpeed: Number(raw?.overspeed?.maxSpeed ?? FALLBACK_DATA.overspeed.maxSpeed),
    },
    avgDriving: {
      title: raw?.avgDriving?.title ?? FALLBACK_DATA.avgDriving.title,
      meta: raw?.avgDriving?.meta ?? FALLBACK_DATA.avgDriving.meta,
      hours: Number(raw?.avgDriving?.hours ?? FALLBACK_DATA.avgDriving.hours),
      minutes: Number(raw?.avgDriving?.minutes ?? FALLBACK_DATA.avgDriving.minutes),
    },
    lineCard: {
      title: raw?.lineCard?.title ?? FALLBACK_DATA.lineCard.title,
      value: Number(raw?.lineCard?.value ?? FALLBACK_DATA.lineCard.value),
      series: raw?.lineCard?.series ?? FALLBACK_DATA.lineCard.series,
    },
    hours: {
      title: raw?.hours?.title ?? FALLBACK_DATA.hours.title,
      value: Number(raw?.hours?.value ?? FALLBACK_DATA.hours.value),
      unitLabel: raw?.hours?.unitLabel ?? FALLBACK_DATA.hours.unitLabel,
      rows: safeHoursRows,
    },
  };
};

export function useDashboardData() {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("Dashboard API failed");
      const payload = await res.json();
      setData(normalizeData(payload));
    } catch {
      setError("Dashboard data load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh: fetchData,
    }),
    [data, loading, error, fetchData]
  );
}
