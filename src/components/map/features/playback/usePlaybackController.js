import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildDefaultCustomPlaybackRange,
  getPlaybackRangeLabel,
  getPlaybackSamplesForPreset,
  getVehiclePathSamples,
  getVehiclePlaybackImei,
  resolvePlaybackPresetDateRange,
} from "@/components/map/mapHelpers";

export default function usePlaybackController({
  selectedVehicle,
  selectedVehicleId,
  onPlaybackStateChange,
  capturePlaybackCameraSnapshot,
  restorePlaybackCameraSnapshot,
  playbackApiRecordLimit,
  defaultPlaybackSettings,
  defaultPlaybackThresholds,
  playbackSettingsStorageKey,
}) {
  const PLAYBACK_HISTORY_UI_TIMEOUT_MS = 30000;
  const PLAYBACK_HISTORY_MAX_RECORDS_HARD_CAP = 20000;
  const [playbackMenuOpen, setPlaybackMenuOpen] = useState(false);
  const [isPlaybackCustomRangeOpen, setIsPlaybackCustomRangeOpen] = useState(false);
  const [activePlaybackPreset, setActivePlaybackPreset] = useState("");
  const [playbackCustomRangeDraft, setPlaybackCustomRangeDraft] = useState(() => buildDefaultCustomPlaybackRange());
  const [playbackCustomRangeApplied, setPlaybackCustomRangeApplied] = useState(() =>
    buildDefaultCustomPlaybackRange()
  );
  const [playbackApiSamples, setPlaybackApiSamples] = useState([]);
  const [playbackApiLoading, setPlaybackApiLoading] = useState(false);
  const [playbackApiError, setPlaybackApiError] = useState("");
  const [playbackRangeValidationError, setPlaybackRangeValidationError] = useState("");
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackSpeedMultiplier, setPlaybackSpeedMultiplier] = useState(4);
  const [playbackRestartToken, setPlaybackRestartToken] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSeekValue, setPlaybackSeekValue] = useState(0);
  const [playbackSeekToken, setPlaybackSeekToken] = useState(0);
  const [playbackRoutePath, setPlaybackRoutePath] = useState([]);
  const [isPlaybackSettingsCollapsed, setIsPlaybackSettingsCollapsed] = useState(false);
  const [playbackSettings, setPlaybackSettings] = useState(defaultPlaybackSettings);
  const [playbackThresholds, setPlaybackThresholds] = useState(defaultPlaybackThresholds);
  const [isPlaybackAlertMenuOpen, setIsPlaybackAlertMenuOpen] = useState(false);
  const [playbackSettingsSaveMessage, setPlaybackSettingsSaveMessage] = useState("");
  const [showPlaybackSettingsPrompt, setShowPlaybackSettingsPrompt] = useState(true);
  const [isPlaybackDrawerOpen, setIsPlaybackDrawerOpen] = useState(false);
  const [activePlaybackDrawerTab, setActivePlaybackDrawerTab] = useState("trips");
  const [playbackSettingsPosition, setPlaybackSettingsPosition] = useState(null);
  const [isPlaybackPrintModalOpen, setIsPlaybackPrintModalOpen] = useState(false);
  const [isPlaybackShareModalOpen, setIsPlaybackShareModalOpen] = useState(false);
  const [playbackShareValidity, setPlaybackShareValidity] = useState("2 Hours");
  const [playbackShareEmails, setPlaybackShareEmails] = useState("");
  const [playbackShareMobiles, setPlaybackShareMobiles] = useState("");
  const [playbackShareReason, setPlaybackShareReason] = useState("");
  const [playbackShareFeedback, setPlaybackShareFeedback] = useState("");

  const playbackHistoryRequestRef = useRef(0);
  const playbackHistoryAbortRef = useRef(null);

  const getPlaybackHistoryMaxRecords = useCallback(
    (preset, fromDate, toDate) => {
      const requestedFloor = Math.max(100, Number(playbackApiRecordLimit || 0) || 100);
      const parsedFrom = fromDate ? new Date(fromDate) : null;
      const parsedTo = toDate ? new Date(toDate) : null;
      const durationMs =
        parsedFrom && !Number.isNaN(parsedFrom.getTime()) && parsedTo && !Number.isNaN(parsedTo.getTime())
          ? Math.max(0, parsedTo.getTime() - parsedFrom.getTime())
          : 0;

      let recommendedCap = requestedFloor;
      switch (preset) {
        case "Today":
        case "Last 24 Hour":
        case "Yesterday":
          recommendedCap = 4000;
          break;
        case "This Week":
          recommendedCap = 10000;
          break;
        case "This Month":
          recommendedCap = 15000;
          break;
        case "Custom":
          if (durationMs <= 2 * 24 * 60 * 60 * 1000) {
            recommendedCap = 4000;
          } else if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
            recommendedCap = 10000;
          } else {
            recommendedCap = 15000;
          }
          break;
        default:
          recommendedCap = Math.max(requestedFloor, 4000);
          break;
      }

      return Math.max(requestedFloor, Math.min(PLAYBACK_HISTORY_MAX_RECORDS_HARD_CAP, recommendedCap));
    },
    [playbackApiRecordLimit]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(playbackSettingsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.settings && typeof parsed.settings === "object") {
        setPlaybackSettings((current) => ({ ...current, ...parsed.settings }));
      }
      if (parsed?.thresholds && typeof parsed.thresholds === "object") {
        setPlaybackThresholds((current) => ({
          ...current,
          ...parsed.thresholds,
          alertFilters:
            Array.isArray(parsed.thresholds.alertFilters) && parsed.thresholds.alertFilters.length > 0
              ? parsed.thresholds.alertFilters
              : current.alertFilters,
        }));
      }
    } catch {
      // Ignore malformed local playback settings.
    }
  }, [playbackSettingsStorageKey]);

  const invalidatePlaybackHistoryRequest = useCallback(() => {
    playbackHistoryRequestRef.current += 1;
    if (playbackHistoryAbortRef.current) {
      playbackHistoryAbortRef.current.abort();
      playbackHistoryAbortRef.current = null;
    }
  }, []);

  const selectedVehiclePlaybackImei = useMemo(() => getVehiclePlaybackImei(selectedVehicle), [selectedVehicle]);
  const selectedVehiclePlaybackRegNo = useMemo(
    () =>
      String(
        selectedVehicle?.obj_reg_no ||
          selectedVehicle?.vehicle_no ||
          selectedVehicle?.reg_no ||
          selectedVehicle?.registration_no ||
          ""
      ).trim(),
    [selectedVehicle]
  );
  const selectedVehiclePlaybackObjName = useMemo(
    () =>
      String(selectedVehicle?.obj_name || selectedVehicle?.vehicle_name || selectedVehicle?.name || "").trim(),
    [selectedVehicle]
  );
  const selectedVehiclePlaybackActive = Boolean(selectedVehicleId && activePlaybackPreset);
  const playbackSourceSamples = useMemo(() => {
    if (selectedVehiclePlaybackActive) return playbackApiSamples;
    return getVehiclePathSamples(selectedVehicle);
  }, [playbackApiSamples, selectedVehicle, selectedVehiclePlaybackActive]);
  const playbackRangeLabel = useMemo(
    () =>
      getPlaybackRangeLabel(
        activePlaybackPreset,
        selectedVehicle,
        selectedVehiclePlaybackActive ? playbackSourceSamples : null,
        playbackCustomRangeApplied
      ),
    [
      activePlaybackPreset,
      playbackCustomRangeApplied,
      playbackSourceSamples,
      selectedVehicle,
      selectedVehiclePlaybackActive,
    ]
  );
  const selectedPlaybackSamples = useMemo(
    () => getPlaybackSamplesForPreset(playbackSourceSamples, activePlaybackPreset, playbackCustomRangeApplied),
    [activePlaybackPreset, playbackCustomRangeApplied, playbackSourceSamples]
  );
  const rawPlaybackRoutePath = useMemo(
    () =>
      selectedPlaybackSamples
        .map((sample) => [Number(sample?.lat), Number(sample?.lng)])
        .filter(
          (point, index, list) =>
            point.length === 2 &&
            point.every(Number.isFinite) &&
            (index === 0 || point[0] !== list[index - 1]?.[0] || point[1] !== list[index - 1]?.[1])
        ),
    [selectedPlaybackSamples]
  );

  const playbackShareSummary = useMemo(() => {
    const vehicleLabel = selectedVehicle?.vehicle_no || selectedVehicle?.imei_id || selectedVehicle?.id || "Vehicle";
    const driverLabel =
      selectedVehicle?.driver_name ||
      selectedVehicle?.driver ||
      selectedVehicle?.driverName ||
      selectedVehicle?.driver_full_name ||
      "Driver not assigned";
    const validity = playbackShareValidity || "2 Hours";
    const reason = playbackShareReason.trim();
    const emails = playbackShareEmails.trim();
    const mobiles = playbackShareMobiles.trim();

    return [
      `Playback: ${vehicleLabel}`,
      `Range: ${playbackRangeLabel || "Custom"}`,
      `Driver: ${driverLabel}`,
      `Validity: ${validity}`,
      emails ? `Email: ${emails}` : "",
      mobiles ? `Mobile: ${mobiles}` : "",
      reason ? `Reason: ${reason}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    playbackRangeLabel,
    playbackShareEmails,
    playbackShareMobiles,
    playbackShareReason,
    playbackShareValidity,
    selectedVehicle,
  ]);
  const playbackShareLink = useMemo(() => {
    const vehicleIdentity = String(selectedVehicleId || "vehicle");
    const preset = activePlaybackPreset || "custom";
    const rangeLabel = encodeURIComponent(playbackRangeLabel || preset);
    return `playback://${vehicleIdentity}?preset=${encodeURIComponent(preset)}&range=${rangeLabel}`;
  }, [activePlaybackPreset, playbackRangeLabel, selectedVehicleId]);

  useEffect(() => {
    onPlaybackStateChange?.(selectedVehiclePlaybackActive, selectedVehicle || null);
  }, [onPlaybackStateChange, selectedVehiclePlaybackActive, selectedVehicle]);

  useEffect(() => {
    if (!selectedVehiclePlaybackActive) {
      setPlaybackPaused(true);
      setPlaybackProgress(0);
      setPlaybackSeekValue(0);
      setPlaybackSeekToken(0);
      setPlaybackRoutePath([]);
      setPlaybackApiSamples([]);
      setPlaybackApiLoading(false);
      setPlaybackApiError("");
    }
  }, [selectedVehiclePlaybackActive]);

  useEffect(() => {
    const requestId = playbackHistoryRequestRef.current + 1;
    playbackHistoryRequestRef.current = requestId;

    if (!selectedVehiclePlaybackActive || !activePlaybackPreset) {
      if (playbackHistoryAbortRef.current) {
        playbackHistoryAbortRef.current.abort();
        playbackHistoryAbortRef.current = null;
      }
      setPlaybackApiSamples([]);
      setPlaybackRoutePath([]);
      setPlaybackApiLoading(false);
      setPlaybackApiError("");
      return undefined;
    }

    const playbackLookupCandidates = [
      selectedVehiclePlaybackImei ? { key: "imei_id", value: selectedVehiclePlaybackImei } : null,
      selectedVehiclePlaybackRegNo ? { key: "obj_reg_no", value: selectedVehiclePlaybackRegNo } : null,
      selectedVehiclePlaybackObjName ? { key: "obj_name", value: selectedVehiclePlaybackObjName } : null,
    ].filter(Boolean);

    if (playbackLookupCandidates.length === 0) {
      if (playbackHistoryAbortRef.current) {
        playbackHistoryAbortRef.current.abort();
        playbackHistoryAbortRef.current = null;
      }
      setPlaybackApiSamples([]);
      setPlaybackRoutePath([]);
      setPlaybackApiLoading(false);
      setPlaybackApiError("Playback is unavailable because this vehicle has no playback identifiers.");
      return undefined;
    }

    const { fromDate, toDate } = resolvePlaybackPresetDateRange(activePlaybackPreset, playbackCustomRangeApplied);
    if (!fromDate || !toDate) {
      if (playbackHistoryAbortRef.current) {
        playbackHistoryAbortRef.current.abort();
        playbackHistoryAbortRef.current = null;
      }
      setPlaybackApiSamples([]);
      setPlaybackRoutePath([]);
      setPlaybackApiLoading(false);
      setPlaybackApiError("Playback date range is invalid.");
      return undefined;
    }

    const controller = new AbortController();
    playbackHistoryAbortRef.current = controller;
    const requestTimeout = setTimeout(() => {
      controller.abort("timeout");
    }, PLAYBACK_HISTORY_UI_TIMEOUT_MS);

    setPlaybackApiSamples([]);
    setPlaybackRoutePath([]);
    setPlaybackApiLoading(true);
    setPlaybackApiError("");

    const loadPlaybackHistory = async () => {
      const maxRecords = getPlaybackHistoryMaxRecords(activePlaybackPreset, fromDate, toDate);
      for (const candidate of playbackLookupCandidates) {
        const params = new URLSearchParams({
          from_date: fromDate,
          to_date: toDate,
          limit: String(Math.min(500, maxRecords)),
          offset: "0",
          full_range: "1",
          max_records: String(maxRecords),
          [candidate.key]: candidate.value,
        });

        const response = await fetch(`/api/playback/history-replay?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          if (response.status === 404) continue;
          throw new Error(String(payload?.error || payload?.message || "Unable to load playback history."));
        }

        const items = Array.isArray(payload) ? payload : [];
        if (items.length > 0) return items;
      }
      return [];
    };

    loadPlaybackHistory()
      .then((items) => {
        if (controller.signal.aborted || playbackHistoryRequestRef.current !== requestId) return;
        setPlaybackApiSamples(items);
        if (items.length === 0) {
          setPlaybackApiError("No history is available for this vehicle in the selected time range.");
        }
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          if (controller.signal.reason === "timeout" && playbackHistoryRequestRef.current === requestId) {
            setPlaybackApiSamples([]);
            setPlaybackRoutePath([]);
            setPlaybackApiError("Playback history is taking too long to load. No history is available right now.");
          }
          return;
        }
        if (playbackHistoryRequestRef.current !== requestId) return;
        setPlaybackApiSamples([]);
        setPlaybackRoutePath([]);
        setPlaybackApiError(String(error?.message || "Unable to load playback history."));
        console.warn("[MapComponent] Playback history request failed:", error);
      })
      .finally(() => {
        clearTimeout(requestTimeout);
        if (playbackHistoryRequestRef.current === requestId) {
          if (playbackHistoryAbortRef.current === controller) playbackHistoryAbortRef.current = null;
          setPlaybackApiLoading(false);
        }
      });

    return () => {
      clearTimeout(requestTimeout);
      controller.abort();
      if (playbackHistoryAbortRef.current === controller) playbackHistoryAbortRef.current = null;
    };
  }, [
    activePlaybackPreset,
    playbackApiRecordLimit,
    playbackCustomRangeApplied,
    getPlaybackHistoryMaxRecords,
    selectedVehiclePlaybackActive,
    selectedVehiclePlaybackImei,
    selectedVehiclePlaybackObjName,
    selectedVehiclePlaybackRegNo,
  ]);

  useEffect(() => {
    if (!selectedVehiclePlaybackActive) return;
    if (rawPlaybackRoutePath.length < 2) return;

    setPlaybackRoutePath(rawPlaybackRoutePath);
  }, [rawPlaybackRoutePath, selectedVehiclePlaybackActive]);

  const resetPlaybackAnimationState = useCallback(() => {
    invalidatePlaybackHistoryRequest();
    setPlaybackPaused(true);
    setPlaybackProgress(0);
    setPlaybackSeekValue(0);
    setPlaybackSeekToken((current) => current + 1);
    setPlaybackRestartToken((current) => current + 1);
  }, [invalidatePlaybackHistoryRequest]);

  const applyPlaybackPreset = useCallback(
    (preset) => {
      setPlaybackRangeValidationError("");
      setIsPlaybackCustomRangeOpen(false);
      if (!selectedVehiclePlaybackActive) capturePlaybackCameraSnapshot();
      resetPlaybackAnimationState();
      setActivePlaybackPreset((current) => (current === preset ? "" : preset));
      setPlaybackMenuOpen(false);
    },
    [capturePlaybackCameraSnapshot, resetPlaybackAnimationState, selectedVehiclePlaybackActive]
  );

  const applyPlaybackCustomRange = useCallback(() => {
    const start = playbackCustomRangeDraft?.start ? new Date(playbackCustomRangeDraft.start) : null;
    const end = playbackCustomRangeDraft?.end ? new Date(playbackCustomRangeDraft.end) : null;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
      setPlaybackRangeValidationError("Select both start and end date/time.");
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setPlaybackRangeValidationError("End date/time must be after start date/time.");
      return;
    }
    setPlaybackRangeValidationError("");
    setIsPlaybackCustomRangeOpen(false);
    setPlaybackCustomRangeApplied(playbackCustomRangeDraft);
    if (!selectedVehiclePlaybackActive) capturePlaybackCameraSnapshot();
    resetPlaybackAnimationState();
    setActivePlaybackPreset("Custom");
    setPlaybackMenuOpen(false);
  }, [capturePlaybackCameraSnapshot, playbackCustomRangeDraft, resetPlaybackAnimationState, selectedVehiclePlaybackActive]);

  const handlePlaybackClose = useCallback(() => {
    invalidatePlaybackHistoryRequest();
    const nextCustomRange = buildDefaultCustomPlaybackRange();
    setActivePlaybackPreset("");
    setPlaybackPaused(true);
    setPlaybackProgress(0);
    setPlaybackSeekValue(0);
    setPlaybackSeekToken(0);
    setPlaybackRoutePath([]);
    setPlaybackApiSamples([]);
    setPlaybackApiLoading(false);
    setPlaybackApiError("");
    setPlaybackRangeValidationError("");
    setIsPlaybackCustomRangeOpen(false);
    setPlaybackCustomRangeDraft(nextCustomRange);
    setPlaybackCustomRangeApplied(nextCustomRange);
    setIsPlaybackSettingsCollapsed(false);
    setIsPlaybackAlertMenuOpen(false);
    setPlaybackSettingsSaveMessage("");
    setShowPlaybackSettingsPrompt(true);
    setIsPlaybackDrawerOpen(false);
    setActivePlaybackDrawerTab("trips");
    setIsPlaybackPrintModalOpen(false);
    setIsPlaybackShareModalOpen(false);
    setPlaybackShareFeedback("");
    restorePlaybackCameraSnapshot();
  }, [invalidatePlaybackHistoryRequest, restorePlaybackCameraSnapshot]);

  const handleTogglePlaybackMenu = useCallback(() => {
    setPlaybackRangeValidationError("");
    setPlaybackMenuOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        if (activePlaybackPreset === "Custom") {
          setPlaybackCustomRangeDraft(playbackCustomRangeApplied);
        }
        setIsPlaybackCustomRangeOpen(activePlaybackPreset === "Custom");
      } else {
        setIsPlaybackCustomRangeOpen(false);
      }
      return nextOpen;
    });
  }, [activePlaybackPreset, playbackCustomRangeApplied]);

  const togglePlaybackSetting = useCallback((key) => {
    setPlaybackSettings((current) => ({ ...current, [key]: !current[key] }));
    setShowPlaybackSettingsPrompt(true);
    setPlaybackSettingsSaveMessage("");
  }, []);

  const updatePlaybackThreshold = useCallback((key, value) => {
    setPlaybackThresholds((current) => ({ ...current, [key]: value }));
    setShowPlaybackSettingsPrompt(true);
    setPlaybackSettingsSaveMessage("");
  }, []);

  const togglePlaybackAlertFilter = useCallback((option) => {
    setPlaybackThresholds((current) => {
      const currentFilters =
        Array.isArray(current.alertFilters) && current.alertFilters.length > 0 ? current.alertFilters : ["All"];
      if (option === "All") return { ...current, alertFilters: ["All"] };
      const withoutAll = currentFilters.filter((item) => item !== "All");
      const nextFilters = withoutAll.includes(option)
        ? withoutAll.filter((item) => item !== option)
        : [...withoutAll, option];
      return { ...current, alertFilters: nextFilters.length > 0 ? nextFilters : ["All"] };
    });
    setShowPlaybackSettingsPrompt(true);
    setPlaybackSettingsSaveMessage("");
  }, []);

  const playbackAlertSummary = useMemo(() => {
    const filters =
      Array.isArray(playbackThresholds.alertFilters) && playbackThresholds.alertFilters.length > 0
        ? playbackThresholds.alertFilters
        : ["All"];
    if (filters.includes("All")) return "All";
    if (filters.length === 1) return filters[0];
    return `${filters.length} selected`;
  }, [playbackThresholds.alertFilters]);

  const savePlaybackSettings = useCallback(() => {
    setShowPlaybackSettingsPrompt(false);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      playbackSettingsStorageKey,
      JSON.stringify({ settings: playbackSettings, thresholds: playbackThresholds })
    );
    setPlaybackSettingsSaveMessage("");
  }, [playbackSettings, playbackSettingsStorageKey, playbackThresholds]);

  const restorePlaybackSettings = useCallback(() => {
    setShowPlaybackSettingsPrompt(false);
    if (typeof window === "undefined") {
      setPlaybackSettings(defaultPlaybackSettings);
      setPlaybackThresholds(defaultPlaybackThresholds);
      setPlaybackSettingsSaveMessage("");
      return;
    }
    try {
      const raw = window.localStorage.getItem(playbackSettingsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPlaybackSettings({ ...defaultPlaybackSettings, ...(parsed?.settings || {}) });
        setPlaybackThresholds({
          ...defaultPlaybackThresholds,
          ...(parsed?.thresholds || {}),
          alertFilters:
            Array.isArray(parsed?.thresholds?.alertFilters) && parsed.thresholds.alertFilters.length > 0
              ? parsed.thresholds.alertFilters
              : defaultPlaybackThresholds.alertFilters,
        });
        setPlaybackSettingsSaveMessage("");
        setIsPlaybackAlertMenuOpen(false);
        return;
      }
    } catch {}
    setPlaybackSettings(defaultPlaybackSettings);
    setPlaybackThresholds(defaultPlaybackThresholds);
    setPlaybackSettingsSaveMessage("");
    setIsPlaybackAlertMenuOpen(false);
  }, [defaultPlaybackSettings, defaultPlaybackThresholds, playbackSettingsStorageKey]);

  const handlePlaybackSeek = useCallback((nextValue) => {
    const clamped = Math.max(0, Math.min(1, Number(nextValue) || 0));
    setPlaybackProgress(clamped);
    setPlaybackSeekValue(clamped);
    setPlaybackSeekToken((current) => current + 1);
  }, []);

  const openPlaybackDrawerTab = useCallback((tabId) => {
    setActivePlaybackDrawerTab(tabId);
    setIsPlaybackDrawerOpen(true);
  }, []);

  const handlePlaybackShare = useCallback(() => {
    setPlaybackShareFeedback("");
    setIsPlaybackShareModalOpen(true);
  }, []);

  const handlePlaybackGenerateLink = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(playbackShareLink);
        setPlaybackShareFeedback("Link copied");
        return;
      }
      setPlaybackShareFeedback(playbackShareLink);
    } catch {
      setPlaybackShareFeedback("Unable to copy link");
    }
  }, [playbackShareLink]);

  const handlePlaybackShareSend = useCallback(async () => {
    try {
      if (navigator?.share) {
        await navigator.share({ title: "Share Playback", text: playbackShareSummary, url: playbackShareLink });
        setPlaybackShareFeedback("Share opened");
        return;
      }
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${playbackShareSummary}\n${playbackShareLink}`);
        setPlaybackShareFeedback("Share details copied");
        return;
      }
      setPlaybackShareFeedback("Sharing unavailable");
    } catch {
      setPlaybackShareFeedback("Share cancelled");
    }
  }, [playbackShareLink, playbackShareSummary]);

  const handlePlaybackShareHistory = useCallback(() => {
    setActivePlaybackDrawerTab("trips");
    setIsPlaybackDrawerOpen(true);
    setIsPlaybackShareModalOpen(false);
  }, []);

  const handlePlaybackPrint = useCallback(() => {
    setIsPlaybackPrintModalOpen(true);
  }, []);

  const handlePlaybackPrintAction = useCallback((mode) => {
    if (mode === "report" || mode === "map-report") {
      setActivePlaybackDrawerTab("trips");
      setIsPlaybackDrawerOpen(true);
    }
    if (typeof window !== "undefined") window.print();
  }, []);

  return {
    playbackMenuOpen,
    setPlaybackMenuOpen,
    isPlaybackCustomRangeOpen,
    setIsPlaybackCustomRangeOpen,
    activePlaybackPreset,
    setActivePlaybackPreset,
    playbackCustomRangeDraft,
    setPlaybackCustomRangeDraft,
    playbackCustomRangeApplied,
    setPlaybackCustomRangeApplied,
    playbackApiSamples,
    setPlaybackApiSamples,
    playbackApiLoading,
    setPlaybackApiLoading,
    playbackApiError,
    setPlaybackApiError,
    playbackRangeValidationError,
    setPlaybackRangeValidationError,
    playbackPaused,
    setPlaybackPaused,
    playbackSpeedMultiplier,
    setPlaybackSpeedMultiplier,
    playbackRestartToken,
    setPlaybackRestartToken,
    playbackProgress,
    setPlaybackProgress,
    playbackSeekValue,
    setPlaybackSeekValue,
    playbackSeekToken,
    setPlaybackSeekToken,
    playbackRoutePath,
    setPlaybackRoutePath,
    isPlaybackSettingsCollapsed,
    setIsPlaybackSettingsCollapsed,
    playbackSettings,
    setPlaybackSettings,
    playbackThresholds,
    setPlaybackThresholds,
    isPlaybackAlertMenuOpen,
    setIsPlaybackAlertMenuOpen,
    playbackSettingsSaveMessage,
    setPlaybackSettingsSaveMessage,
    showPlaybackSettingsPrompt,
    setShowPlaybackSettingsPrompt,
    isPlaybackDrawerOpen,
    setIsPlaybackDrawerOpen,
    activePlaybackDrawerTab,
    setActivePlaybackDrawerTab,
    playbackSettingsPosition,
    setPlaybackSettingsPosition,
    isPlaybackPrintModalOpen,
    setIsPlaybackPrintModalOpen,
    isPlaybackShareModalOpen,
    setIsPlaybackShareModalOpen,
    playbackShareValidity,
    setPlaybackShareValidity,
    playbackShareEmails,
    setPlaybackShareEmails,
    playbackShareMobiles,
    setPlaybackShareMobiles,
    playbackShareReason,
    setPlaybackShareReason,
    playbackShareFeedback,
    setPlaybackShareFeedback,
    selectedVehiclePlaybackActive,
    playbackSourceSamples,
    playbackRangeLabel,
    selectedPlaybackSamples,
    rawPlaybackRoutePath,
    invalidatePlaybackHistoryRequest,
    resetPlaybackAnimationState,
    applyPlaybackPreset,
    applyPlaybackCustomRange,
    handlePlaybackClose,
    handleTogglePlaybackMenu,
    togglePlaybackSetting,
    updatePlaybackThreshold,
    togglePlaybackAlertFilter,
    playbackAlertSummary,
    savePlaybackSettings,
    restorePlaybackSettings,
    handlePlaybackSeek,
    openPlaybackDrawerTab,
    handlePlaybackShare,
    handlePlaybackGenerateLink,
    handlePlaybackShareSend,
    handlePlaybackShareHistory,
    handlePlaybackPrint,
    handlePlaybackPrintAction,
  };
}
