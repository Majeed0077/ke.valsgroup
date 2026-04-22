"use client";

import React from "react";
import {
  FaBullseye,
  FaCalendarAlt,
  FaCog,
  FaPrint,
  FaShareAlt,
  FaTimes,
} from "react-icons/fa";

const PlaybackTopBar = React.forwardRef(function PlaybackTopBar(
  {
    compactCloseOnly = false,
    vehicleLabel,
    playbackRangeLabel,
    isPlaybackSettingsCollapsed,
    onOpenObjectList,
    onTogglePlaybackMenu,
    onPrint,
    onShare,
    onFocus,
    onToggleSettings,
    onClose,
  },
  ref
) {
  if (compactCloseOnly) {
    return (
      <div className="vtp-playback-topbar vtp-playback-topbar-compact">
        <div className="vtp-playback-topbar-actions vtp-playback-topbar-actions-compact">
          <button
            type="button"
            className="vtp-playback-topbar-icon-btn is-danger"
            title="Close playback"
            aria-label="Close playback"
            onClick={onClose}
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vtp-playback-topbar">
      <div className="vtp-playback-topbar-main">
        <div className="vtp-playback-vehicle-chip">{vehicleLabel}</div>
        <button
          type="button"
          className="vtp-playback-topbar-menu"
          ref={ref}
          data-playback-topbar-menu="true"
          onClick={onOpenObjectList}
          aria-label="Open object list"
          title="Open object list"
        >
          <span />
          <span />
          <span />
        </button>
        <button
          type="button"
          className="vtp-playback-range-chip"
          onClick={onTogglePlaybackMenu}
          title="Open playback range menu"
          aria-label="Open playback range menu"
        >
          {playbackRangeLabel}
        </button>
      </div>
      <div className="vtp-playback-topbar-actions">
        <button
          type="button"
          className="vtp-playback-topbar-icon-btn"
          title="Change playback range"
          aria-label="Change playback range"
          onClick={onTogglePlaybackMenu}
        >
          <FaCalendarAlt aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vtp-playback-topbar-icon-btn"
          title="Print playback"
          aria-label="Print playback"
          onClick={onPrint}
        >
          <FaPrint aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vtp-playback-topbar-icon-btn"
          title="Share playback"
          aria-label="Share playback"
          onClick={onShare}
        >
          <FaShareAlt aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vtp-playback-topbar-icon-btn"
          title="Focus playback route"
          aria-label="Focus playback route"
          onClick={onFocus}
        >
          <FaBullseye aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vtp-playback-topbar-icon-btn"
          title={isPlaybackSettingsCollapsed ? "Show playback settings" : "Playback settings"}
          aria-label={isPlaybackSettingsCollapsed ? "Show playback settings" : "Playback settings"}
          onClick={onToggleSettings}
        >
          <FaCog aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vtp-playback-topbar-icon-btn is-danger"
          title="Close playback"
          aria-label="Close playback"
          onClick={onClose}
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

export default PlaybackTopBar;
