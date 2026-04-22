import { useEffect, useRef, useState } from "react";
import {
  FaBell,
  FaBullseye,
  FaCalendarAlt,
  FaListUl,
  FaPause,
  FaPlay,
  FaRedoAlt,
  FaRoute,
  FaShareAlt,
  FaTimes,
} from "react-icons/fa";

export default function PlaybackBottomBar({
  controller,
  metrics,
  showPlaybackChrome = true,
  playbackSpeedOptions,
  focusPlaybackRoute,
  selectedVehicle,
  isMobileViewport = false,
  playbackCalculationOptions = [],
  playbackMinuteOptions = [],
  playbackSpeedFilterOptions = [],
  playbackSpeedLimitOptions = [],
  playbackAlertFilterOptions = [],
  playbackSeatBeltOptions = [],
}) {
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const mobileSheetTouchStartYRef = useRef(null);

  useEffect(() => {
    setMobileSheetExpanded(false);
  }, [selectedVehicle?.id, selectedVehicle?.imei_id, selectedVehicle?.vehicle_no, controller.playbackRangeLabel]);

  const mobileVehicleTitle = String(
    selectedVehicle?.vehicle_no ||
      selectedVehicle?.obj_reg_no ||
      selectedVehicle?.obj_name ||
      selectedVehicle?.vehicle_name ||
      selectedVehicle?.imei_id ||
      "Playback"
  ).trim();
  const playbackDistanceKm = Math.max(0, Number(metrics?.playbackDistanceMeters || 0)) / 1000;
  const mobileDistanceLabel =
    playbackDistanceKm >= 10 ? `${playbackDistanceKm.toFixed(1)} km` : `${playbackDistanceKm.toFixed(2)} km`;
  const mobileTimeLabel = metrics.playbackCurrentTimeLabel || controller.playbackRangeLabel || "Playback";
  const mobileRunningLabel = String(
    selectedVehicle?.running_time || selectedVehicle?.moving_time || selectedVehicle?.travel_time || "00:00 hrs"
  ).trim();
  const mobileStopLabel = String(
    selectedVehicle?.stop_time || selectedVehicle?.stopped_time || selectedVehicle?.parking_time || "00:00 hrs"
  ).trim();
  const mobileIdleLabel = String(
    selectedVehicle?.idle_time || selectedVehicle?.idling_time || "00:00 hrs"
  ).trim();
  const mobileAlertSummary = Array.isArray(controller.playbackThresholds?.alertFilters)
    ? controller.playbackThresholds.alertFilters.join(", ")
    : "All";
  const mobileSummaryDistance = playbackDistanceKm > 0 ? `${Math.round(playbackDistanceKm)} km` : "0 km";
  const mobileAlertCount = Array.isArray(metrics?.playbackEventRows) ? metrics.playbackEventRows.length : 0;

  if (!showPlaybackChrome) return null;

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
    if (deltaY <= -28) {
      setMobileSheetExpanded(true);
      return;
    }
    if (deltaY >= 28) {
      setMobileSheetExpanded(false);
    }
  };

  if (isMobileViewport) {
    return (
      <div className="vtp-playback-bottombar is-mobile" data-expanded={mobileSheetExpanded ? "true" : "false"}>
        <div className={`vtp-playback-mobile-shell ${mobileSheetExpanded ? "is-expanded" : "is-collapsed"}`}>
          <div
            className="vtp-playback-mobile-sheet-chrome"
            onTouchStart={handleMobileSheetTouchStart}
            onTouchEnd={handleMobileSheetTouchEnd}
            onDoubleClick={() => setMobileSheetExpanded((current) => !current)}
          >
            <div className="vtp-playback-mobile-sheet-grip" aria-hidden="true" />
          </div>

          <div className="vtp-playback-mobile-active-shell">
            <div className="vtp-playback-mobile-head is-expanded-tools">
              <div className="vtp-playback-mobile-active-copy">
                <strong>{mobileVehicleTitle}</strong>
                <div className="vtp-playback-mobile-active-summary">
                  <strong>{`${mobileSummaryDistance} • ${mobileAlertCount} Alert(s)`}</strong>
                  <span>{mobileTimeLabel}</span>
                </div>
              </div>
              <div className="vtp-playback-mobile-head-actions is-active-summary">
                <button
                  type="button"
                  className="vtp-playback-mobile-head-btn is-utility"
                  onClick={controller.handlePlaybackShare}
                  title="Share playback"
                  aria-label="Share playback"
                >
                  <FaShareAlt size={14} />
                </button>
                <button
                  type="button"
                  className="vtp-playback-mobile-head-btn is-utility"
                  onClick={controller.handlePlaybackPrint}
                  title="Playback options"
                  aria-label="Playback options"
                >
                  <FaCalendarAlt size={15} />
                </button>
                <button
                  type="button"
                  className="vtp-playback-mobile-head-btn"
                  onClick={controller.handlePlaybackClose}
                  title="Close playback"
                  aria-label="Close playback"
                >
                  <FaTimes size={15} />
                </button>
                <button
                  type="button"
                  className="vtp-playback-mobile-play is-summary"
                  onClick={() => controller.setPlaybackPaused((current) => !current)}
                  title={controller.playbackPaused ? "Play playback" : "Pause playback"}
                  aria-label={controller.playbackPaused ? "Play playback" : "Pause playback"}
                >
                  {controller.playbackPaused ? <FaPlay size={18} /> : <FaPause size={18} />}
                </button>
              </div>
            </div>

            <div className="vtp-playback-mobile-summary-stats is-inline">
              <div>
                <span>Running</span>
                <strong>{mobileRunningLabel}</strong>
              </div>
              <div>
                <span>Stop</span>
                <strong>{mobileStopLabel}</strong>
              </div>
              <div>
                <span>Idle</span>
                <strong>{mobileIdleLabel}</strong>
              </div>
            </div>
          </div>

          <div className="vtp-playback-mobile-expanded-only">
            <div className="vtp-playback-mobile-settings">
              <div className="vtp-playback-mobile-settings-head">
                <strong>Playback Filters</strong>
                <span>Swipe down to collapse</span>
              </div>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Trip Calculation</strong>
                  <span>Calculation mode</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.tripCalculation}
                    onChange={() => controller.togglePlaybackSetting("tripCalculation")}
                  />
                  <select
                    value={controller.playbackThresholds.calculationMode}
                    onChange={(event) => controller.updatePlaybackThreshold("calculationMode", event.target.value)}
                  >
                    {playbackCalculationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Stoppage</strong>
                  <span>More than</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.stoppage}
                    onChange={() => controller.togglePlaybackSetting("stoppage")}
                  />
                  <select
                    value={String(controller.playbackThresholds.stoppageMinutes)}
                    onChange={(event) =>
                      controller.updatePlaybackThreshold("stoppageMinutes", Number(event.target.value))
                    }
                  >
                    {playbackMinuteOptions.map((minutes) => (
                      <option key={`mobile-stoppage-${minutes}`} value={minutes}>
                        {minutes} Min
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Idle</strong>
                  <span>More than</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.idle}
                    onChange={() => controller.togglePlaybackSetting("idle")}
                  />
                  <select
                    value={String(controller.playbackThresholds.idleMinutes)}
                    onChange={(event) =>
                      controller.updatePlaybackThreshold("idleMinutes", Number(event.target.value))
                    }
                  >
                    {playbackMinuteOptions.map((minutes) => (
                      <option key={`mobile-idle-${minutes}`} value={minutes}>
                        {minutes} Min
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Speed</strong>
                  <span>Threshold</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions is-stack">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.speeding}
                    onChange={() => controller.togglePlaybackSetting("speeding")}
                  />
                  <select
                    value={controller.playbackThresholds.speedComparison}
                    onChange={(event) => controller.updatePlaybackThreshold("speedComparison", event.target.value)}
                  >
                    {playbackSpeedFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={String(controller.playbackThresholds.speedLimit)}
                    onChange={(event) => controller.updatePlaybackThreshold("speedLimit", Number(event.target.value))}
                  >
                    {playbackSpeedLimitOptions.map((speed) => (
                      <option key={`mobile-speed-${speed}`} value={speed}>
                        {speed} km/hr
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Alerts</strong>
                  <span>{mobileAlertSummary || "All"}</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions is-stack">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.alerts}
                    onChange={() => controller.togglePlaybackSetting("alerts")}
                  />
                  <select
                    value={(controller.playbackThresholds.alertFilters || [])[0] || "All"}
                    onChange={(event) => controller.updatePlaybackThreshold("alertFilters", [event.target.value])}
                  >
                    {playbackAlertFilterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Inactive</strong>
                  <span>Visible</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.inactive}
                    onChange={() => controller.togglePlaybackSetting("inactive")}
                  />
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Fuel</strong>
                  <span>Fuel events</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.fuel}
                    onChange={() => controller.togglePlaybackSetting("fuel")}
                  />
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Route</strong>
                  <span>{Array.isArray(controller.playbackRoutePath) ? controller.playbackRoutePath.length : 0} pts</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.route}
                    onChange={() => controller.togglePlaybackSetting("route")}
                  />
                </div>
              </label>

              <label className="vtp-playback-mobile-setting-row">
                <div>
                  <strong>Seat Belt</strong>
                  <span>Filter</span>
                </div>
                <div className="vtp-playback-mobile-setting-actions">
                  <input
                    type="checkbox"
                    checked={controller.playbackSettings.seatBelt}
                    onChange={() => controller.togglePlaybackSetting("seatBelt")}
                  />
                  <select
                    value={controller.playbackThresholds.seatBeltMode}
                    onChange={(event) => controller.updatePlaybackThreshold("seatBeltMode", event.target.value)}
                  >
                    {playbackSeatBeltOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`vtp-playback-bottombar ${controller.isPlaybackDrawerOpen ? "is-raised" : ""}`}>
      <div className="vtp-playback-dock-shell">
        <button
          type="button"
          className="vtp-playback-icon-btn vtp-playback-icon-btn-primary"
          onClick={() => controller.setPlaybackPaused((current) => !current)}
          title={controller.playbackPaused ? "Play playback" : "Pause playback"}
          aria-label={controller.playbackPaused ? "Play playback" : "Pause playback"}
        >
          {controller.playbackPaused ? <FaPlay size={12} /> : <FaPause size={12} />}
        </button>
        <button
          type="button"
          className="vtp-playback-speed-pill"
          onClick={() => {
            const currentIndex = playbackSpeedOptions.indexOf(controller.playbackSpeedMultiplier);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playbackSpeedOptions.length : 0;
            controller.setPlaybackSpeedMultiplier(playbackSpeedOptions[nextIndex]);
          }}
          title="Change playback speed"
        >
          {controller.playbackSpeedMultiplier}X
        </button>

        <div className="vtp-playback-slider-wrap">
          <div className="vtp-playback-slider-meta">
            <span>{metrics.playbackCurrentTimeLabel || controller.playbackRangeLabel}</span>
          </div>
          <div className="vtp-playback-slider-track">
            <div
              className="vtp-playback-slider-fill"
              style={{ width: `${Math.max(2, Math.round(controller.playbackProgress * 100))}%` }}
            />
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={Math.round(controller.playbackProgress * 1000)}
              className="vtp-playback-slider-input"
              onChange={(event) => controller.handlePlaybackSeek(Number(event.target.value) / 1000)}
              aria-label="Seek playback"
            />
          </div>
        </div>

        <div className="vtp-playback-toolset">
          <button
            type="button"
            className="vtp-playback-icon-btn"
            onClick={() => {
              controller.setPlaybackProgress(0);
              controller.setPlaybackSeekValue(0);
              controller.setPlaybackSeekToken((current) => current + 1);
              controller.setPlaybackRestartToken((current) => current + 1);
            }}
            title="Restart playback"
            aria-label="Restart playback"
          >
            <FaRedoAlt size={12} />
          </button>
          <button
            type="button"
            className={`vtp-playback-icon-btn ${controller.playbackSettings.dataPoints ? "is-active" : ""}`}
            onClick={() => controller.togglePlaybackSetting("dataPoints")}
            title="Toggle data points"
            aria-label="Toggle data points"
          >
            <FaListUl size={12} />
          </button>
          <button
            type="button"
            className={`vtp-playback-icon-btn ${controller.playbackSettings.route ? "is-active" : ""}`}
            onClick={() => controller.togglePlaybackSetting("route")}
            title="Toggle route"
            aria-label="Toggle route"
          >
            <FaRoute size={12} />
          </button>
          <button
            type="button"
            className={`vtp-playback-icon-btn ${controller.playbackSettings.speeding ? "is-active" : ""}`}
            onClick={() => controller.togglePlaybackSetting("speeding")}
            title="Toggle speeding events"
            aria-label="Toggle speeding events"
          >
            <FaBell size={12} />
          </button>
          <button
            type="button"
            className="vtp-playback-icon-btn"
            onClick={focusPlaybackRoute}
            title="Focus route"
            aria-label="Focus route"
          >
            <FaBullseye size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
