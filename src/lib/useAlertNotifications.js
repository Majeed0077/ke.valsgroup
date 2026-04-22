"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ALERTS = [];
const DEFAULT_SUMMARY = {
  total: 0,
  unacknowledged: 0,
  acknowledgedToday: 0,
  high: 0,
  medium: 0,
  low: 0,
};
const PANEL_PAGE_SIZE = Math.max(
  20,
  Number(process.env.NEXT_PUBLIC_ALERTS_PANEL_PAGE_SIZE || 20)
);

const POLL_INTERVAL_MS = Math.max(
  15000,
  Number(process.env.NEXT_PUBLIC_ALERTS_POLL_INTERVAL_MS || 15000)
);
function resolveAlertsWebSocketUrl() {
  const configured = String(process.env.NEXT_PUBLIC_ALERTS_WS_URL || "").trim();
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/alerts`;
}

function formatRelativeTime(value) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes <= 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function normalizeNotificationLevel(item) {
  const value =
    item?.level ??
    item?.severity ??
    item?.raw?.severity ??
    item?.raw?.level ??
    item?.raw?.priority ??
    item?.raw?.priority_level ??
    item?.raw?.severity_level ??
    item?.raw?.alert_level ??
    item?.raw?.class ??
    item?.raw?.type ??
    item?.raw?.category;

  const level = String(value || "").trim().toUpperCase();
  if (level === "HIGH" || level === "MEDIUM" || level === "LOW") return level;
  if (["3", "CRITICAL", "SEVERE", "URGENT", "EMERGENCY"].includes(level)) return "HIGH";
  if (["2", "MED", "MODERATE", "WARNING", "WARN"].includes(level)) return "MEDIUM";
  return "LOW";
}

function normalizeNotification(item) {
  const level = normalizeNotificationLevel(item);
  const timestamp = new Date(item?.time || 0).getTime() || 0;
  return {
    ...item,
    level,
    levelClass: `${level.charAt(0)}${level.slice(1).toLowerCase()}`,
    timestamp,
    displayTime: formatRelativeTime(item?.time),
  };
}

function countSeverity(items) {
  return items.reduce(
    (acc, item) => {
      const level = normalizeNotificationLevel(item);
      if (level === "HIGH") acc.high += 1;
      else if (level === "MEDIUM") acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

export function useAlertNotifications({ enabled = true, severity = "", panelOpen = false } = {}) {
  const [notifications, setNotifications] = useState(DEFAULT_ALERTS);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [streamMode, setStreamMode] = useState("polling");
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);
  const loadedLimitRef = useRef(PANEL_PAGE_SIZE);

  const fetchAlerts = useCallback(async ({ limitOverride, append = false } = {}) => {
    if (!enabled) return;
    setError("");
    if (append) setIsLoadingMore(true);
    else setIsLoading(!hasLoadedRef.current);

    try {
      const resolvedLimit = Math.max(
        PANEL_PAGE_SIZE,
        Number(limitOverride || loadedLimitRef.current || PANEL_PAGE_SIZE)
      );
      const requestLimit = append || panelOpen ? resolvedLimit : 1;
      const severityQuery =
        severity === "HIGH" || severity === "MEDIUM" || severity === "LOW"
          ? `&severity=${encodeURIComponent(severity)}`
          : "";

      const alertsRes = await fetch(
        `/api/alerts?acknowledged=0&limit=${requestLimit}&offset=0${severityQuery}`,
        { cache: "no-store" }
      );
      const alertsJson = await alertsRes.json().catch(() => ({ alerts: [], summary: DEFAULT_SUMMARY }));
      const summaryJson = alertsJson?.summary || DEFAULT_SUMMARY;

      if (!alertsRes.ok) {
        throw new Error(alertsJson?.message || "Unable to fetch alerts.");
      }

      const normalizedAlerts = (alertsJson?.alerts || [])
        .map((item) => normalizeNotification(item))
        .sort((left, right) => right.timestamp - left.timestamp);
      const severityFallback = countSeverity(normalizedAlerts);
      const resolvedHigh = Math.max(Number(summaryJson?.high || 0), severityFallback.high);
      const resolvedMedium = Math.max(Number(summaryJson?.medium || 0), severityFallback.medium);
      const resolvedLow = Math.max(Number(summaryJson?.low || 0), severityFallback.low);
      const resolvedUnread = Number(summaryJson?.unacknowledged || normalizedAlerts.length);
      const resolvedAcknowledgedToday = Number(summaryJson?.acknowledgedToday || 0);

      setNotifications(normalizedAlerts);
      setSummary({
        total: Number(summaryJson?.total || normalizedAlerts.length),
        unacknowledged: resolvedUnread,
        acknowledgedToday: resolvedAcknowledgedToday,
        high: resolvedHigh,
        medium: resolvedMedium,
        low: resolvedLow,
      });
      loadedLimitRef.current = resolvedLimit;
      hasLoadedRef.current = true;
    } catch (nextError) {
      if (!hasLoadedRef.current) {
        setNotifications(DEFAULT_ALERTS);
        setSummary(DEFAULT_SUMMARY);
      }
      setError(nextError?.message || "Unable to fetch alerts.");
    } finally {
      if (append) setIsLoadingMore(false);
      else setIsLoading(false);
    }
  }, [enabled, panelOpen, severity]);

  useEffect(() => {
    loadedLimitRef.current = PANEL_PAGE_SIZE;
    hasLoadedRef.current = false;
    setNotifications(DEFAULT_ALERTS);
  }, [severity]);

  const loadMore = useCallback(async () => {
    if (!enabled || !panelOpen || isLoadingMore) return;
    const loadedCount = notifications.length;
    const totalActive =
      severity === "HIGH"
        ? Number(summary.high || 0)
        : severity === "MEDIUM"
        ? Number(summary.medium || 0)
        : severity === "LOW"
        ? Number(summary.low || 0)
        : Number(summary.unacknowledged || 0);
    if (loadedCount >= totalActive) return;
    await fetchAlerts({ limitOverride: loadedCount + PANEL_PAGE_SIZE, append: true });
  }, [enabled, fetchAlerts, isLoadingMore, notifications.length, panelOpen, severity, summary.high, summary.medium, summary.low, summary.unacknowledged]);

  useEffect(() => {
    if (!enabled) return undefined;

    let socket = null;
    let intervalId = null;
    let disposed = false;

    const stopPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      setStreamMode((prev) => (prev === "websocket" ? prev : "polling"));
      fetchAlerts();
      intervalId = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        fetchAlerts();
      }, POLL_INTERVAL_MS);
    };

    const resumePolling = () => {
      if (disposed || document.visibilityState !== "visible") return;
      setStreamMode("polling");
      startPolling();
    };

    const wsUrl = resolveAlertsWebSocketUrl();
    startPolling();

    if (wsUrl) {
      try {
        socket = new WebSocket(wsUrl);
        socket.onopen = () => {
          if (disposed) return;
          stopPolling();
          setStreamMode("websocket");
          fetchAlerts();
          socket.send("refresh");
        };
        socket.onmessage = () => {
          if (disposed) return;
          fetchAlerts();
        };
        socket.onerror = () => {
          resumePolling();
        };
        socket.onclose = () => {
          resumePolling();
        };
      } catch {}
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!socket) startPolling();
        else fetchAlerts();
        return;
      }

      if (!socket) stopPolling();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (socket) socket.close();
      stopPolling();
    };
  }, [enabled, fetchAlerts]);

  return useMemo(
    () => ({
      notifications,
      summary,
      isLoading,
      isLoadingMore,
      error,
      streamMode,
      refresh: fetchAlerts,
      loadMore,
      hasMore:
        notifications.length <
        (severity === "HIGH"
          ? Number(summary.high || 0)
          : severity === "MEDIUM"
          ? Number(summary.medium || 0)
          : severity === "LOW"
          ? Number(summary.low || 0)
          : Number(summary.unacknowledged || 0)),
      unreadCount: summary.unacknowledged,
    }),
    [notifications, summary, isLoading, isLoadingMore, error, streamMode, fetchAlerts, loadMore, severity]
  );
}
