"use client";

import React from "react";
import { FaGripLines, FaTimes } from "react-icons/fa";

export default function PlaybackSettingsPanel({
  isCollapsed,
  style,
  onHeaderPointerDown,
  onClose,
  playbackSettings,
  playbackThresholds,
  playbackAlertSummary,
  isAlertMenuOpen,
  onToggleAlertMenu,
  onToggleAlertFilter,
  onToggleSetting,
  onUpdateThreshold,
  calculationOptions,
  minuteOptions,
  speedFilterOptions,
  speedLimitOptions,
  alertFilterOptions,
  seatBeltOptions,
  playbackRoutePointCount,
  playbackProgressPercent,
  distanceLabel,
  durationLabel,
  stopsCount,
  showSettingsPrompt,
  onSaveSettings,
  onRestoreSettings,
}) {
  return (
    <aside
      className={`vtp-playback-settings-panel ${isCollapsed ? "is-collapsed" : ""}`}
      style={style}
    >
      <div className="vtp-playback-settings-head" onPointerDown={onHeaderPointerDown}>
        <div className="vtp-playback-settings-head-main">
          <span className="vtp-playback-settings-drag" aria-hidden="true">
            <FaGripLines />
          </span>
          <strong>Playback Settings</strong>
        </div>
        <div className="vtp-playback-settings-head-actions" data-no-drag="true">
          <button
            type="button"
            className="vtp-playback-settings-icon-btn"
            onClick={onClose}
            aria-label="Close playback settings"
            title="Close playback settings"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="vtp-playback-settings-body">
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-grid" aria-hidden="true">[]</span>
          <input
            type="checkbox"
            checked={playbackSettings.tripCalculation}
            onChange={() => onToggleSetting("tripCalculation")}
          />
          <span>Trip Calculation</span>
          <select
            value={playbackThresholds.calculationMode}
            onChange={(event) => onUpdateThreshold("calculationMode", event.target.value)}
          >
            {calculationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-blue" aria-hidden="true" />
          <input
            type="checkbox"
            checked={playbackSettings.stoppage}
            onChange={() => onToggleSetting("stoppage")}
          />
          <span>Stoppage more than</span>
          <select
            value={String(playbackThresholds.stoppageMinutes)}
            onChange={(event) => onUpdateThreshold("stoppageMinutes", Number(event.target.value))}
          >
            {minuteOptions.map((minutes) => (
              <option key={`stoppage-${minutes}`} value={minutes}>
                {minutes} Min
              </option>
            ))}
          </select>
        </label>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-amber" aria-hidden="true" />
          <input type="checkbox" checked={playbackSettings.idle} onChange={() => onToggleSetting("idle")} />
          <span>Idle more than</span>
          <select
            value={String(playbackThresholds.idleMinutes)}
            onChange={(event) => onUpdateThreshold("idleMinutes", Number(event.target.value))}
          >
            {minuteOptions.map((minutes) => (
              <option key={`idle-${minutes}`} value={minutes}>
                {minutes} Min
              </option>
            ))}
          </select>
        </label>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-speed" aria-hidden="true">S</span>
          <input
            type="checkbox"
            checked={playbackSettings.speeding}
            onChange={() => onToggleSetting("speeding")}
          />
          <span className="vtp-setting-label-accent">Speed</span>
          <div className="vtp-playback-threshold-stack">
            <select
              value={playbackThresholds.speedComparison}
              onChange={(event) => onUpdateThreshold("speedComparison", event.target.value)}
            >
              {speedFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={String(playbackThresholds.speedLimit)}
              onChange={(event) => onUpdateThreshold("speedLimit", Number(event.target.value))}
            >
              {speedLimitOptions.map((speed) => (
                <option key={`speed-${speed}`} value={speed}>
                  {speed} km/hr
                </option>
              ))}
            </select>
          </div>
        </label>
        <div className="vtp-playback-setting-row vtp-playback-setting-row-menu" data-playback-alert-menu="true">
          <span className="vtp-setting-glyph vtp-setting-glyph-triangle" aria-hidden="true" />
          <input
            type="checkbox"
            checked={playbackSettings.alerts}
            onChange={() => onToggleSetting("alerts")}
          />
          <span>Alerts</span>
          <button type="button" className="vtp-playback-setting-menu-trigger" onClick={onToggleAlertMenu}>
            {playbackAlertSummary}
          </button>
          {isAlertMenuOpen ? (
            <div className="vtp-playback-setting-menu">
              {alertFilterOptions.map((option) => {
                const isChecked = (playbackThresholds.alertFilters || []).includes(option);
                return (
                  <label key={option} className="vtp-playback-setting-menu-item">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleAlertFilter(option)}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-sky" aria-hidden="true" />
          <input
            type="checkbox"
            checked={playbackSettings.inactive}
            onChange={() => onToggleSetting("inactive")}
          />
          <span>InActive</span>
          <em>Visible</em>
        </label>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-fuel" aria-hidden="true">F</span>
          <input type="checkbox" checked={playbackSettings.fuel} onChange={() => onToggleSetting("fuel")} />
          <span>Fuel</span>
          <em>Off</em>
        </label>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-route" aria-hidden="true">R</span>
          <input type="checkbox" checked={playbackSettings.route} onChange={() => onToggleSetting("route")} />
          <span>Route</span>
          <em>{playbackRoutePointCount} pts</em>
        </label>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-belt" aria-hidden="true">SB</span>
          <input
            type="checkbox"
            checked={playbackSettings.seatBelt}
            onChange={() => onToggleSetting("seatBelt")}
          />
          <span>Seat Belt</span>
          <select
            value={playbackThresholds.seatBeltMode}
            onChange={(event) => onUpdateThreshold("seatBeltMode", event.target.value)}
          >
            {seatBeltOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-toll" aria-hidden="true">T</span>
          <input
            type="checkbox"
            checked={playbackSettings.tollInformation}
            onChange={() => onToggleSetting("tollInformation")}
          />
          <span>Toll Information</span>
          <input
            type="color"
            className="vtp-setting-color-input"
            value={playbackThresholds.tollColor}
            onChange={(event) => onUpdateThreshold("tollColor", event.target.value)}
            aria-label="Choose toll information color"
            title="Choose toll information color"
          />
        </div>
        <label className="vtp-playback-setting-row">
          <span className="vtp-setting-glyph vtp-setting-glyph-opal" aria-hidden="true">O</span>
          <input
            type="checkbox"
            checked={playbackSettings.opalEvent}
            onChange={() => onToggleSetting("opalEvent")}
          />
          <span>Opal Event</span>
          <em>Off</em>
        </label>
        <label className="vtp-playback-setting-row vtp-playback-setting-row-note">
          <span className="vtp-setting-glyph vtp-setting-glyph-red" aria-hidden="true" />
          <input
            type="checkbox"
            checked={playbackSettings.dataPoints}
            onChange={() => onToggleSetting("dataPoints")}
          />
          <span>
            Data Points
            <small>It may have an impact on responsiveness if the path has many points.</small>
          </span>
          <em>{playbackProgressPercent}%</em>
        </label>

        <div className="vtp-playback-settings-summary">
          <span>Distance {distanceLabel}</span>
          <span>Duration {durationLabel}</span>
          <span>Stops {stopsCount}</span>
        </div>
        {showSettingsPrompt ? (
          <div className="vtp-playback-settings-save">
            <strong>Do you want to save playback settings?</strong>
            <div className="vtp-playback-settings-save-actions">
              <button type="button" onClick={onSaveSettings}>Yes</button>
              <button type="button" onClick={onRestoreSettings}>No</button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
