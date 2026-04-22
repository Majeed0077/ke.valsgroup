"use client";

import React from "react";
import { FaTimes } from "react-icons/fa";

export default function PlaybackShareModal({
  isOpen,
  playbackShareValidity,
  playbackShareEmails,
  playbackShareMobiles,
  playbackShareReason,
  playbackShareFeedback,
  validityOptions,
  onClose,
  onChangeValidity,
  onChangeEmails,
  onChangeMobiles,
  onChangeReason,
  onOpenHistory,
  onGenerateLink,
  onSend,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="vtp-playback-share-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Share Playback"
    >
      <div className="vtp-playback-share-head">
        <strong>Share Playback</strong>
        <button
          type="button"
          className="vtp-playback-share-close"
          onClick={onClose}
          aria-label="Close share playback"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>
      <div className="vtp-playback-share-body">
        <label className="vtp-playback-share-row">
          <span>Validity:</span>
          <select value={playbackShareValidity} onChange={onChangeValidity}>
            {validityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="vtp-playback-share-row is-textarea">
          <span>Email:</span>
          <textarea
            rows={3}
            maxLength={240}
            placeholder="Use Comma(,) for Multiple Email"
            value={playbackShareEmails}
            onChange={onChangeEmails}
          />
        </label>
        <label className="vtp-playback-share-row is-textarea">
          <span>Mobile Number:</span>
          <textarea
            rows={3}
            maxLength={240}
            placeholder="Use Comma(,) for Multiple Mobile Numbers"
            value={playbackShareMobiles}
            onChange={onChangeMobiles}
          />
        </label>
        <label className="vtp-playback-share-row is-textarea">
          <span>Reason:</span>
          <textarea
            rows={3}
            maxLength={200}
            placeholder="Write the reason in 200 letters."
            value={playbackShareReason}
            onChange={onChangeReason}
          />
        </label>
        <div className="vtp-playback-share-actions">
          <button type="button" onClick={onOpenHistory}>
            History
          </button>
          <button type="button" onClick={onGenerateLink}>
            Generate Link
          </button>
          <button type="button" className="is-primary" onClick={onSend}>
            Send
          </button>
        </div>
        {playbackShareFeedback ? (
          <small className="vtp-playback-share-feedback">{playbackShareFeedback}</small>
        ) : null}
      </div>
    </div>
  );
}
