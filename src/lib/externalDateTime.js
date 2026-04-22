const EXTERNAL_LOCAL_OFFSET = "+05:00";
const NAIVE_EXTERNAL_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,6})?$/;

function normalizeNaiveExternalDateTime(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(" ", "T");
  if (!NAIVE_EXTERNAL_DATE_TIME_PATTERN.test(normalized)) {
    return normalized;
  }

  const [basePart, fractionPart = ""] = normalized.split(".");
  const normalizedBase = basePart.length === 16 ? `${basePart}:00` : basePart;
  const milliseconds = fractionPart ? fractionPart.slice(0, 3).padEnd(3, "0") : "";
  return `${normalizedBase}${milliseconds ? `.${milliseconds}` : ""}${EXTERNAL_LOCAL_OFFSET}`;
}

export function parseExternalTimestamp(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    const next = new Date(value);
    return Number.isNaN(next.getTime()) ? null : next;
  }

  const text = String(value).trim();
  if (!text) return null;

  const numericValue = Number(text);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    const next = new Date(numericValue);
    return Number.isNaN(next.getTime()) ? null : next;
  }

  const withTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(text) || /GMT/i.test(text)
      ? text
      : normalizeNaiveExternalDateTime(text);

  const next = new Date(withTimezone);
  return Number.isNaN(next.getTime()) ? null : next;
}

export function parseExternalTimestampMs(value) {
  const parsed = parseExternalTimestamp(value);
  return parsed ? parsed.getTime() : 0;
}

export function formatExternalTimestampIso(value) {
  const parsed = parseExternalTimestamp(value);
  return parsed ? parsed.toISOString() : "";
}
