"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FaArrowLeft,
  FaBell,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaFilter,
  FaRedoAlt,
} from "react-icons/fa";
import styles from "./NotificationsInboxPage.module.css";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "0", label: "Unread" },
  { value: "1", label: "Seen" },
];

const SEVERITY_FILTERS = [
  { value: "", label: "All Severities" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const TIME_PRESETS = [
  { value: "1h", label: "1h", hours: 1 },
  { value: "6h", label: "6h", hours: 6 },
  { value: "24h", label: "24h", hours: 24 },
  { value: "7d", label: "7d", hours: 24 * 7 },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const EMPTY_OVERVIEW = {
  total: 0,
  unacknowledged: 0,
  high: 0,
  medium: 0,
  low: 0,
};

function normalizeSeverity(value) {
  const severity = String(value || "").trim().toUpperCase();
  if (severity === "HIGH" || severity === "MEDIUM" || severity === "LOW") return severity;
  if (["3", "CRITICAL", "SEVERE", "URGENT", "EMERGENCY"].includes(severity)) return "HIGH";
  if (["2", "MED", "MODERATE", "WARNING", "WARN"].includes(severity)) return "MEDIUM";
  return "LOW";
}

function formatRelativeTime(value) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 60000) return "just now";
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatAbsoluteTime(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeAlert(row) {
  const severity = normalizeSeverity(
    row?.level ||
      row?.severity ||
      row?.priority ||
      row?.priority_level ||
      row?.severity_level ||
      row?.alert_level ||
      row?.class ||
      row?.type ||
      row?.category
  );
  const timestamp = row?.time || row?.created_at || row?.inapps_at || "";
  return {
    id: Number(row?.id || 0),
    severity,
    message: String(row?.message || row?.rule_name || "Alert received"),
    vehicleName: String(row?.vehicleName || row?.obj_name || row?.obj_reg_no || row?.imei || "Unknown vehicle"),
    time: timestamp,
    acknowledged: Number(row?.acknowledged || 0) === 1,
    remarks: String(row?.remarks || ""),
    displayTime: formatRelativeTime(timestamp),
    exactTime: formatAbsoluteTime(timestamp),
  };
}

function normalizeSummary(payload) {
  const source = payload?.data || payload?.payload || payload || {};
  const bySeverity =
    source?.by_severity ||
    source?.bySeverity ||
    source?.severity_counts ||
    source?.severityCounts ||
    {};

  return {
    total: Number(source?.total_alerts || source?.total || 0),
    unacknowledged: Number(source?.unacknowledged || source?.unacknowledged_count || 0),
    high: Number(
      bySeverity?.HIGH ?? bySeverity?.high ?? source?.HIGH ?? source?.high ?? source?.high_severity ?? 0
    ),
    medium: Number(
      bySeverity?.MEDIUM ??
        bySeverity?.medium ??
        source?.MEDIUM ??
        source?.medium ??
        source?.medium_severity ??
        0
    ),
    low: Number(
      bySeverity?.LOW ?? bySeverity?.low ?? source?.LOW ?? source?.low ?? source?.low_severity ?? 0
    ),
  };
}

function resolveRange(timePreset, fromDate, toDate) {
  if (timePreset === "custom") {
    return {
      from_date: fromDate ? new Date(fromDate).toISOString() : "",
      to_date: toDate ? new Date(toDate).toISOString() : "",
    };
  }

  if (timePreset === "all") {
    return { from_date: "", to_date: "" };
  }

  const preset = TIME_PRESETS.find((item) => item.value === timePreset);
  if (!preset?.hours) {
    return { from_date: "", to_date: "" };
  }

  const now = new Date();
  const from = new Date(now.getTime() - preset.hours * 60 * 60 * 1000);
  return {
    from_date: from.toISOString(),
    to_date: now.toISOString(),
  };
}

export default function NotificationsInboxPage() {
  const searchParams = useSearchParams();
  const initialSeverity = String(searchParams.get("severity") || "").toUpperCase();

  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState(
    initialSeverity === "HIGH" || initialSeverity === "MEDIUM" || initialSeverity === "LOW"
      ? initialSeverity
      : ""
  );
  const [timePreset, setTimePreset] = useState("24h");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [overviewStats, setOverviewStats] = useState(EMPTY_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [acknowledgingId, setAcknowledgingId] = useState("");

  useEffect(() => {
    if (initialSeverity === "HIGH" || initialSeverity === "MEDIUM" || initialSeverity === "LOW") {
      setSeverityFilter(initialSeverity);
    }
  }, [initialSeverity]);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("acknowledged", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const { from_date, to_date } = resolveRange(timePreset, fromDate, toDate);
      if (from_date) params.set("from_date", from_date);
      if (to_date) params.set("to_date", to_date);

      const response = await fetch(`/api/alerts?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to fetch notifications.");
      }

      const rows = Array.isArray(payload?.alerts)
        ? payload.alerts.map((item) => normalizeAlert(item)).sort((left, right) => new Date(right.time) - new Date(left.time))
        : [];

      setAlerts(rows);
      setTotal(Number(payload?.total || rows.length));
      const rowFallback = {
        total: Number(payload?.total || rows.length),
        unacknowledged: rows.filter((item) => !item.acknowledged).length,
        high: rows.filter((item) => item.severity === "HIGH").length,
        medium: rows.filter((item) => item.severity === "MEDIUM").length,
        low: rows.filter((item) => item.severity === "LOW").length,
      };
      const normalizedSummary = normalizeSummary(payload?.summary);
      setOverviewStats({
        total: normalizedSummary.total || rowFallback.total,
        unacknowledged: normalizedSummary.unacknowledged || rowFallback.unacknowledged,
        high: Math.max(normalizedSummary.high, rowFallback.high),
        medium: Math.max(normalizedSummary.medium, rowFallback.medium),
        low: Math.max(normalizedSummary.low, rowFallback.low),
      });
    } catch (nextError) {
      setError(nextError?.message || "Unable to fetch notifications.");
      setAlerts([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, limit, offset, searchTerm, severityFilter, statusFilter, timePreset, toDate]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  const currentStats = useMemo(() => {
    return alerts.reduce(
      (acc, item) => {
        if (!item.acknowledged) acc.unread += 1;
        if (item.severity === "HIGH") acc.high += 1;
        if (item.severity === "MEDIUM") acc.medium += 1;
        if (item.severity === "LOW") acc.low += 1;
        return acc;
      },
      { unread: 0, high: 0, medium: 0, low: 0 }
    );
  }, [alerts]);

  const handleAcknowledge = async (item) => {
    if (!item?.id) return;
    setAcknowledgingId(String(item.id));

    const previousAlerts = alerts;
    const previousTotal = total;

    const nextAlerts =
      statusFilter === "0"
        ? alerts.filter((row) => row.id !== item.id)
        : alerts.map((row) => (row.id === item.id ? { ...row, acknowledged: true } : row));

    setAlerts(nextAlerts);
    if (statusFilter === "0") {
      setTotal((prev) => Math.max(0, prev - 1));
    }

    try {
      const response = await fetch("/api/alerts/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: item.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Unable to mark notification as seen.");
      }
      await fetchAlerts();
    } catch {
      setAlerts(previousAlerts);
      setTotal(previousTotal);
    } finally {
      setAcknowledgingId("");
    }
  };

  const handleApplySearch = (event) => {
    event.preventDefault();
    setOffset(0);
    fetchAlerts();
  };

  const handleFilterChange = (setter, value) => {
    setter(value);
    setOffset(0);
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Notifications</p>
            <h1 className={styles.title}>Alerts Inbox</h1>
            <p className={styles.subtitle}>
              Review the full alert history with time filters, date range, and latest-first visibility.
            </p>
          </div>
          <div className={styles.topbarActions}>
            <Link href="/tracking" className={styles.backLink}>
              <FaArrowLeft size={12} />
              Back to Tracking
            </Link>
            <button type="button" className={styles.refreshButton} onClick={fetchAlerts}>
              <FaRedoAlt size={12} />
              Refresh
            </button>
          </div>
        </div>

        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total matched</span>
            <strong>{total}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Unread in view</span>
            <strong>{currentStats.unread}</strong>
          </div>
          <div className={styles.statCard}>
            <span>High</span>
            <strong>{overviewStats.high}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Medium</span>
            <strong>{overviewStats.medium}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Low</span>
            <strong>{overviewStats.low}</strong>
          </div>
        </section>

        <section className={styles.filtersCard}>
          <div className={styles.filtersHeader}>
            <div className={styles.filtersTitle}>
              <FaFilter size={13} />
              <span>Filters</span>
            </div>
            <div className={styles.filtersMeta}>
              <FaClock size={12} />
              <span>Newest alerts stay on top</span>
            </div>
          </div>
          <div className={styles.filtersLayout}>
            <div className={styles.filterColumnMain}>
              <div className={styles.filterBlock}>
                <span className={styles.filterLabel}>Status</span>
                <div className={styles.filterChips}>
                  {STATUS_FILTERS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`${styles.filterChip} ${statusFilter === item.value ? styles.filterChipActive : ""}`}
                      onClick={() => handleFilterChange(setStatusFilter, item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.filterBlock}>
                <span className={styles.filterLabel}>Severity</span>
                <div className={styles.filterChips}>
                  {SEVERITY_FILTERS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`${styles.filterChip} ${severityFilter === item.value ? styles.filterChipActive : ""}`}
                      onClick={() => handleFilterChange(setSeverityFilter, item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.filterBlock}>
                <span className={styles.filterLabel}>Time range</span>
                <div className={styles.filterChips}>
                  {TIME_PRESETS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.filterChip} ${timePreset === item.value ? styles.filterChipActive : ""}`}
                      onClick={() => handleFilterChange(setTimePreset, item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.filterColumnSide}>
              <form className={styles.searchForm} onSubmit={handleApplySearch}>
                <label className={`${styles.fieldLabel} ${styles.searchField}`}>
                  Search
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Vehicle, message, rule"
                    className={styles.input}
                  />
                </label>
                <button type="submit" className={styles.secondaryButton}>
                  Apply
                </button>
              </form>

              <div className={styles.formGrid}>
                <label className={styles.fieldLabel}>
                  Page size
                  <select
                    className={styles.select}
                    value={limit}
                    onChange={(event) => {
                      setLimit(Number(event.target.value));
                      setOffset(0);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.fieldLabel}>
                  From
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={fromDate}
                    disabled={timePreset !== "custom"}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </label>

                <label className={styles.fieldLabel}>
                  To
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={toDate}
                    disabled={timePreset !== "custom"}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.feedCard}>
          <div className={styles.feedHeader}>
            <div>
              <h2>Alert history</h2>
              <p>
                Showing {alerts.length} alerts on page {currentPage} of {pageCount}
              </p>
            </div>
            <div className={styles.feedLegend}>
              <span><FaBell size={11} /> Live feed</span>
              <span><FaCheckCircle size={11} /> Seen supported</span>
            </div>
          </div>

          {error ? (
            <div className={styles.errorBanner}>
              <FaExclamationTriangle size={13} />
              <span>{error}</span>
            </div>
          ) : null}

          {isLoading ? <div className={styles.emptyState}>Loading notifications...</div> : null}

          {!isLoading && alerts.length === 0 ? (
            <div className={styles.emptyState}>No notifications matched the selected filters.</div>
          ) : null}

          {!isLoading && alerts.length > 0 ? (
            <div className={styles.feedList}>
              {alerts.map((item) => (
                <article key={item.id} className={styles.feedItem}>
                  <div className={`${styles.severityBar} ${styles[`severity${item.severity}`]}`} />
                  <div className={styles.feedItemBody}>
                    <div className={styles.feedItemTop}>
                      <div className={styles.feedTitleWrap}>
                        <h3>{item.message}</h3>
                        <span className={`${styles.severityPill} ${styles[`severityPill${item.severity}`]}`}>
                          {item.severity}
                        </span>
                      </div>
                      <div className={styles.timeWrap}>
                        <span>{item.displayTime}</span>
                        <small>{item.exactTime}</small>
                      </div>
                    </div>
                    <div className={styles.feedMeta}>
                      <span className={styles.vehicleName}>{item.vehicleName}</span>
                      <span>{item.acknowledged ? "Seen" : "Unread"}</span>
                      {item.remarks ? <span>Remarks: {item.remarks}</span> : null}
                    </div>
                    <div className={styles.feedActions}>
                      {!item.acknowledged ? (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled={acknowledgingId === String(item.id)}
                          onClick={() => handleAcknowledge(item)}
                        >
                          {acknowledgingId === String(item.id) ? "Saving..." : "Seen"}
                        </button>
                      ) : (
                        <span className={styles.seenBadge}>Already seen</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            >
              Previous
            </button>
            <span>
              Page {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={offset + limit >= total || isLoading}
              onClick={() => setOffset((prev) => prev + limit)}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
