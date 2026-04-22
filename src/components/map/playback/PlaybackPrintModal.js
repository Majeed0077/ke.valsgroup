"use client";

import React from "react";
import { FaTimes } from "react-icons/fa";

export default function PlaybackPrintModal({
  isOpen,
  onClose,
  onPrintMap,
  onPrintReport,
  onPrintMapWithReport,
  previewMap,
}) {
  if (!isOpen) return null;

  return (
    <div className="vtp-playback-print-modal" role="dialog" aria-modal="true" aria-label="Print">
      <div className="vtp-playback-print-head">
        <strong>Print</strong>
        <button
          type="button"
          className="vtp-playback-print-close"
          onClick={onClose}
          aria-label="Close print"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>
      <div className="vtp-playback-print-map-shell">{previewMap}</div>
      <div className="vtp-playback-print-note">
        Note : Data point information is excluded from the report to ensure optimal performance and
        readability.
      </div>
      <div className="vtp-playback-print-actions">
        <button type="button" onClick={onPrintMap}>
          Print Map
        </button>
        <button type="button" onClick={onPrintReport}>
          Print Report
        </button>
        <button type="button" onClick={onPrintMapWithReport}>
          Print Map with Report
        </button>
      </div>
    </div>
  );
}
