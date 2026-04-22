import React, { useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaPlay, FaTimes } from "react-icons/fa";

const readPlaybackDatePart = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const [datePart] = normalized.split("T");
  return datePart || "";
};

const readPlaybackTimePart = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "00:00";
  const [, timePart = ""] = normalized.split("T");
  if (!timePart) return "00:00";
  return timePart.slice(0, 5) || "00:00";
};

const buildPlaybackDateTimeDraftValue = (currentValue, nextDatePart, nextTimePart) => {
  const resolvedDatePart = nextDatePart || readPlaybackDatePart(currentValue);
  if (!resolvedDatePart) return "";
  const resolvedTimePart = nextTimePart || readPlaybackTimePart(currentValue) || "00:00";
  return `${resolvedDatePart}T${resolvedTimePart}`;
};

export default function PlaybackOverlays({
  isPlaybackCameraRestoring,
  onClose,
  selectedVehicleAnchorStyle,
  isMobileViewport,
  selectedVehicle,
  playbackMenuOpen,
  playbackMenuPanelStyle,
  playbackApiLoading,
  playbackApiError,
  selectedVehiclePlaybackActive,
  playbackApiSamples,
  playbackHasVisiblePath,
  playbackOptions,
  activePlaybackPreset,
  isPlaybackCustomRangeOpen,
  setPlaybackRangeValidationError,
  setPlaybackCustomRangeDraft,
  playbackCustomRangeApplied,
  setIsPlaybackCustomRangeOpen,
  applyPlaybackPreset,
  playbackCustomRangeDraft,
  playbackRangeValidationError,
  setPlaybackMenuOpen,
  applyPlaybackCustomRange,
}) {
  const [mobilePendingPreset, setMobilePendingPreset] = useState("");

  const updatePlaybackCustomRangeField = (field, nextDatePart, nextTimePart) => {
    setPlaybackRangeValidationError("");
    setPlaybackCustomRangeDraft((current) => {
      const currentValue = current?.[field] || "";
      return {
        ...current,
        [field]: buildPlaybackDateTimeDraftValue(currentValue, nextDatePart, nextTimePart),
      };
    });
  };

  useEffect(() => {
    if (!isMobileViewport || !playbackMenuOpen) return;
    setMobilePendingPreset(activePlaybackPreset || playbackOptions[0] || "Today");
  }, [activePlaybackPreset, isMobileViewport, playbackMenuOpen, playbackOptions]);

  const showPlaybackLoader =
    selectedVehiclePlaybackActive && playbackApiLoading && !playbackHasVisiblePath;
  const showPlaybackEmptyState =
    selectedVehiclePlaybackActive &&
    !playbackApiLoading &&
    !playbackHasVisiblePath &&
    Boolean(playbackApiError);
  const mobileSelectedPreset = mobilePendingPreset || activePlaybackPreset || playbackOptions[0] || "Today";
  const mobileVehicleTitle = useMemo(
    () =>
      String(
        selectedVehicle?.vehicle_no ||
          selectedVehicle?.obj_reg_no ||
          selectedVehicle?.obj_name ||
          selectedVehicle?.vehicle_name ||
          selectedVehicle?.imei_id ||
          "Playback"
      ).trim(),
    [selectedVehicle]
  );
  const mobileSummaryLine = useMemo(() => {
    if (mobileSelectedPreset === "Custom") {
      const start = playbackCustomRangeDraft?.start || playbackCustomRangeApplied?.start || "";
      const end = playbackCustomRangeDraft?.end || playbackCustomRangeApplied?.end || "";
      if (start && end) {
        return `${start.replace("T", " ")} - ${end.replace("T", " ")}`;
      }
      return "Choose custom date range";
    }
    return mobileSelectedPreset;
  }, [mobileSelectedPreset, playbackCustomRangeApplied, playbackCustomRangeDraft]);

  const handleMobilePlaybackStart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (mobileSelectedPreset === "Custom") {
      applyPlaybackCustomRange();
      return;
    }
    applyPlaybackPreset(mobileSelectedPreset);
  };

  return (
    <>
      {isPlaybackCameraRestoring ? (
        <div
          aria-live="polite"
          aria-label="Restoring map"
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1550,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              minWidth: "112px",
              height: "34px",
              padding: "0 12px",
              borderRadius: "999px",
              background: "rgba(13, 18, 27, 0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 14px 34px rgba(0, 0, 0, 0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "#eff5ff",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="#F7941E" strokeWidth="2" strokeLinecap="round">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 9 9"
                  to="360 9 9"
                  dur="0.72s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
            <span>Restoring map</span>
          </div>
        </div>
      ) : null}

      {showPlaybackLoader ? (
        <div
          aria-live="polite"
          aria-label="Loading playback path"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1540,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              minWidth: "186px",
              minHeight: "52px",
              padding: "12px 44px 12px 16px",
              borderRadius: "16px",
              background: "rgba(13, 18, 27, 0.92)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.24)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              color: "#eff5ff",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            {typeof onClose === "function" ? (
              <button
                type="button"
                aria-label="Close playback"
                title="Close playback"
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  width: "28px",
                  height: "28px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.08)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#eff5ff",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              >
                <FaTimes aria-hidden="true" size={12} />
              </button>
            ) : null}
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
              <path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="#F7941E" strokeWidth="2" strokeLinecap="round">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 9 9"
                  to="360 9 9"
                  dur="0.72s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
            <span>Loading playback path...</span>
          </div>
        </div>
      ) : null}

      {showPlaybackEmptyState ? (
        <div
          aria-live="polite"
          aria-label="Playback unavailable"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1540,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              minWidth: "240px",
              maxWidth: "320px",
              padding: "14px 44px 14px 16px",
              borderRadius: "18px",
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid rgba(46, 66, 98, 0.14)",
              boxShadow: "0 18px 44px rgba(22, 35, 58, 0.16)",
              color: "#213756",
              textAlign: "center",
            }}
          >
            {typeof onClose === "function" ? (
              <button
                type="button"
                aria-label="Close playback"
                title="Close playback"
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  width: "28px",
                  height: "28px",
                  borderRadius: "10px",
                  border: "1px solid rgba(217, 59, 54, 0.18)",
                  background: "rgba(255, 245, 245, 0.98)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#d93b36",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              >
                <FaTimes aria-hidden="true" size={12} />
              </button>
            ) : null}
            <strong style={{ display: "block", fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>
              No Playback History
            </strong>
            <span style={{ display: "block", fontSize: "12px", lineHeight: 1.45, color: "#546b8c" }}>
              {playbackApiError || "No history is available for this vehicle in the selected time range."}
            </span>
          </div>
        </div>
      ) : null}

      {selectedVehicle && playbackMenuOpen && (isMobileViewport || selectedVehicleAnchorStyle) ? (
        <aside
          className={`vtp-vehicle-playback-panel ${isMobileViewport ? "is-mobile" : ""}`}
          data-vehicle-playback-panel="true"
          style={playbackMenuPanelStyle || undefined}
        >
          {isMobileViewport ? (
            <>
              <div className="vtp-vehicle-playback-mobile-head">
                <div className="vtp-vehicle-playback-mobile-grip" aria-hidden="true" />
                <div className="vtp-vehicle-playback-mobile-topline">
                  <div className="vtp-vehicle-playback-mobile-title">
                    <strong>{mobileVehicleTitle}</strong>
                    <span>Playback</span>
                  </div>
                  <button
                    type="button"
                    className="vtp-vehicle-playback-mobile-close"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsPlaybackCustomRangeOpen(false);
                      setPlaybackMenuOpen(false);
                    }}
                    aria-label="Close playback"
                    title="Close playback"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
                <div className="vtp-vehicle-playback-mobile-summary">
                  <div className="vtp-vehicle-playback-mobile-summary-row">
                    <FaCalendarAlt size={13} />
                    <span>{mobileSummaryLine}</span>
                  </div>
                  <div className="vtp-vehicle-playback-mobile-state">
                    {playbackApiLoading
                      ? "Loading history..."
                      : playbackApiError ||
                        (selectedVehiclePlaybackActive && playbackApiSamples.length === 0
                          ? "No playback history available"
                          : "Select a range and start playback")}
                  </div>
                </div>
              </div>
              <div className="vtp-vehicle-playback-mobile-preset-grid">
                {playbackOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={mobileSelectedPreset === option ? "is-active" : ""}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMobilePendingPreset(option);
                      if (option === "Custom") {
                        setPlaybackRangeValidationError("");
                        setPlaybackCustomRangeDraft((current) =>
                          current?.start && current?.end ? current : playbackCustomRangeApplied
                        );
                        setIsPlaybackCustomRangeOpen(true);
                        return;
                      }
                      setIsPlaybackCustomRangeOpen(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {mobileSelectedPreset === "Custom" && isPlaybackCustomRangeOpen ? (
                <div className="vtp-vehicle-playback-mobile-custom">
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: "8px" }}>
                      <input
                        type="date"
                        value={readPlaybackDatePart(playbackCustomRangeDraft.start)}
                        onChange={(event) => {
                          updatePlaybackCustomRangeField("start", event.target.value, null);
                        }}
                      />
                      <input
                        type="time"
                        value={readPlaybackTimePart(playbackCustomRangeDraft.start)}
                        onChange={(event) => {
                          updatePlaybackCustomRangeField("start", null, event.target.value);
                        }}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: "8px" }}>
                      <input
                        type="date"
                        value={readPlaybackDatePart(playbackCustomRangeDraft.end)}
                        onChange={(event) => {
                          updatePlaybackCustomRangeField("end", event.target.value, null);
                        }}
                      />
                      <input
                        type="time"
                        value={readPlaybackTimePart(playbackCustomRangeDraft.end)}
                        onChange={(event) => {
                          updatePlaybackCustomRangeField("end", null, event.target.value);
                        }}
                      />
                    </div>
                  </div>
                  {playbackRangeValidationError ? (
                    <span className="vtp-vehicle-playback-mobile-error">{playbackRangeValidationError}</span>
                  ) : null}
                </div>
              ) : null}
              <div className="vtp-vehicle-playback-mobile-actions">
                <button
                  type="button"
                  className="vtp-vehicle-playback-mobile-play"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={handleMobilePlaybackStart}
                >
                  <FaPlay size={14} />
                  <span>Play</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="vtp-vehicle-playback-head">
                <div className="vtp-vehicle-playback-head-top">
                  <div className="vtp-vehicle-playback-head-copy">
                    <strong>Playback</strong>
                    <span>
                      {playbackApiLoading
                        ? "Loading history..."
                        : playbackApiError ||
                          (selectedVehiclePlaybackActive && playbackApiSamples.length === 0
                            ? "No playback history available"
                            : "Choose a time range")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="vtp-vehicle-playback-list">
            {playbackOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={
                  activePlaybackPreset === option || (option === "Custom" && isPlaybackCustomRangeOpen)
                    ? "is-active"
                    : ""
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (option === "Custom") {
                    setPlaybackRangeValidationError("");
                    setPlaybackCustomRangeDraft((current) =>
                      current?.start && current?.end ? current : playbackCustomRangeApplied
                    );
                    setIsPlaybackCustomRangeOpen(true);
                    return;
                  }
                  applyPlaybackPreset(option);
                }}
              >
                {option}
              </button>
            ))}
            {isPlaybackCustomRangeOpen ? (
              <div style={{ display: "grid", gap: "8px", padding: "8px 0 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: "8px" }}>
                  <input
                    type="date"
                    value={readPlaybackDatePart(playbackCustomRangeDraft.start)}
                    onChange={(event) => {
                      updatePlaybackCustomRangeField("start", event.target.value, null);
                    }}
                    style={{
                      width: "100%",
                      minHeight: "36px",
                      border: "1px solid #d7ddea",
                      borderRadius: "10px",
                      padding: "0 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#32486f",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="time"
                    value={readPlaybackTimePart(playbackCustomRangeDraft.start)}
                    onChange={(event) => {
                      updatePlaybackCustomRangeField("start", null, event.target.value);
                    }}
                    style={{
                      width: "100%",
                      minHeight: "36px",
                      border: "1px solid #d7ddea",
                      borderRadius: "10px",
                      padding: "0 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#32486f",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: "8px" }}>
                  <input
                    type="date"
                    value={readPlaybackDatePart(playbackCustomRangeDraft.end)}
                    onChange={(event) => {
                      updatePlaybackCustomRangeField("end", event.target.value, null);
                    }}
                    style={{
                      width: "100%",
                      minHeight: "36px",
                      border: "1px solid #d7ddea",
                      borderRadius: "10px",
                      padding: "0 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#32486f",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="time"
                    value={readPlaybackTimePart(playbackCustomRangeDraft.end)}
                    onChange={(event) => {
                      updatePlaybackCustomRangeField("end", null, event.target.value);
                    }}
                    style={{
                      width: "100%",
                      minHeight: "36px",
                      border: "1px solid #d7ddea",
                      borderRadius: "10px",
                      padding: "0 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#32486f",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                {playbackRangeValidationError ? (
                  <span style={{ color: "#d85d37", fontSize: "11px", fontWeight: 700, lineHeight: 1.3 }}>
                    {playbackRangeValidationError}
                  </span>
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPlaybackRangeValidationError("");
                      setIsPlaybackCustomRangeOpen(false);
                      setPlaybackMenuOpen(false);
                    }}
                    style={{
                      minHeight: "34px",
                      borderRadius: "10px",
                      border: "1px solid #d7ddea",
                      background: "#ffffff",
                      color: "#365281",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      applyPlaybackCustomRange();
                    }}
                    style={{
                      minHeight: "34px",
                      borderRadius: "10px",
                      border: "1px solid #d7ddea",
                      background: "linear-gradient(180deg, #fefefe 0%, #f3f6fb 100%)",
                      color: "#365281",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
              </div>
            </>
          )}
        </aside>
      ) : null}
    </>
  );
}
