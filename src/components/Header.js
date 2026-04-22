'use client';

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Header.module.css';
import {
  FaBell,
  FaBullhorn,
  FaQuestionCircle,
  FaSearch,
  FaSignOutAlt,
  FaTimes,
  FaUser,
  FaUserCircle,
  FaVolumeMute,
  FaVolumeUp,
} from 'react-icons/fa';
import { useAuth } from '@/app/fleet-dashboard/useAuth';
import { redirectToLogout } from '@/lib/authClient';
import { navigateWithTransition } from '@/lib/navigation';
import { useAlertNotifications } from '@/lib/useAlertNotifications';
import { getCachedAuthSession } from '@/lib/authSessionCache';

const Header = ({
  onSearch,
  onSearchSuggest,
  onSearchPick,
  isSearching,
  hideAuthActions = false,
  deferAuthDataLoad = false,
}) => {
  const AVATAR_CACHE_KEY = 'vtp_profile_avatar_meta_v1';
  const AVATAR_PREVIEW_GLOBAL_KEY = '__vtpProfileAvatarPreviewUrl';
  const RECENT_SEARCHES_KEY = 'vtp_recent_searches_v1';
  const ALERT_SOUND_MUTED_KEY = 'vtp_alert_sound_muted_v1';
  const RECENT_SEARCHES_LIMIT = 8;
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeNotificationLevel, setActiveNotificationLevel] = useState('');
  const [activeNotificationsTab, setActiveNotificationsTab] = useState('notifications');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [authActionLoading, setAuthActionLoading] = useState('');
  const [acknowledgingKey, setAcknowledgingKey] = useState('');
  const [isAlertSoundMuted, setIsAlertSoundMuted] = useState(false);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState([]);
  const { authChecked, isAuthenticated } = useAuth();
  const authActionsEnabled = authChecked && isAuthenticated && !hideAuthActions;
  const authDataEnabled = authActionsEnabled && !deferAuthDataLoad;
  const {
    notifications,
    summary,
    isLoading: isNotificationsLoading,
    isLoadingMore: isNotificationsLoadingMore,
    unreadCount,
    hasMore: hasMoreNotifications,
    loadMore: loadMoreNotifications,
    refresh: refreshNotifications,
  } = useAlertNotifications({
    enabled: authDataEnabled,
    severity: activeNotificationLevel,
    panelOpen: isNotificationsOpen,
  });
  const lastAlertSignatureRef = useRef('');
  const lastBrowserAlertIdRef = useRef('');
  const hasPrimedAlertAudioRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const notificationsRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const notificationsDragRef = useRef({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const isDraggingNotificationsRef = useRef(false);
  const helpRef = useRef(null);
  const searchRef = useRef(null);
  const suggestReqRef = useRef(0);
  const profileRef = useRef(null);
  const [notificationsPanelPosition, setNotificationsPanelPosition] = useState(null);

  const notificationsLayoutKey = (() => {
    const session = getCachedAuthSession();
    const userId = String(session?.userId || '').trim();
    return userId ? `notificationsPanel:${userId}` : 'notificationsPanel:anon';
  })();

  useEffect(() => {
    if (!authDataEnabled || !isNotificationsOpen) return undefined;
    if (notificationsPanelPosition) return undefined;
    let cancelled = false;

    const loadUiLayout = async () => {
      try {
        const response = await fetch('/api/ui-layout', { method: 'GET', cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        const pos = payload?.positions?.[notificationsLayoutKey];
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          setNotificationsPanelPosition({ x: pos.x, y: pos.y });
        }
      } catch {
        // ignore layout fetch failures
      }
    };

    loadUiLayout();
    return () => {
      cancelled = true;
    };
  }, [
    authDataEnabled,
    isNotificationsOpen,
    notificationsLayoutKey,
    notificationsPanelPosition,
  ]);

  const persistNotificationsPanelPosition = useCallback(
    async (position) => {
      try {
        await fetch('/api/ui-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layoutKey: notificationsLayoutKey, position }),
        });
      } catch {
        // ignore persistence failures
      }
    },
    [notificationsLayoutKey]
  );

  const highCount = summary.high;
  const mediumCount = summary.medium;
  const lowCount = summary.low;
  const notificationsPageHref = activeNotificationLevel
    ? `/notifications?severity=${encodeURIComponent(activeNotificationLevel)}`
    : '/notifications';
  const notificationBadgeLabel = unreadCount > 0 ? String(unreadCount) : '';
  const getNotificationKey = useCallback(
    (item) => String(item?.id || `${item?.vehicleName || 'vehicle'}|${item?.time || ''}|${item?.message || ''}`),
    []
  );
  const visibleNotifications = notifications.filter((item) => {
    if (!activeNotificationLevel) return true;
    return String(item.level || '').toUpperCase() === activeNotificationLevel;
  });
  const activeVisibleCount =
    activeNotificationLevel === 'HIGH'
      ? highCount
      : activeNotificationLevel === 'MEDIUM'
      ? mediumCount
      : activeNotificationLevel === 'LOW'
      ? lowCount
      : unreadCount;

  const notificationsDateLabel = (() => {
    try {
      const d = new Date();
      // dd-mm-yyyy like competitor
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear());
      return `${day}-${month}-${year}`;
    } catch {
      return '';
    }
  })();

  const PENDING_TRACK_FOCUS_KEY = 'vtp_pending_track_focus_v1';
  const buildTrackingFocusId = useCallback((item) => {
    const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
    return String(
      raw?.imei_id ||
        raw?.imei ||
        raw?.imeino ||
        raw?.obj_reg_no ||
        raw?.vehicle_no ||
        raw?.obj_name ||
        raw?.vehicle_name ||
        item?.vehicleId ||
        item?.vehicle_id ||
        item?.imei_id ||
        item?.imei ||
        item?.vehicleNo ||
        item?.vehicle_no ||
        item?.vehicleName ||
        item?.vehicle_name ||
        ''
    ).trim();
  }, []);

  const handleTrackFromNotification = useCallback(
    (item, { viewLocation = false } = {}) => {
      const fallbackFocusId = buildTrackingFocusId(item);
      const notificationKey = getNotificationKey(item);
      if (!fallbackFocusId) return;

      const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
      const detail = {
        imeiId: String(raw?.imei_id || raw?.imei || '').trim(),
        vehicleNo: String(raw?.obj_reg_no || raw?.vehicle_no || '').trim(),
        vehicleName: String(raw?.obj_name || raw?.vehicle_name || item?.vehicleName || '').trim(),
        source: 'notification',
        viewLocation: Boolean(viewLocation),
        notificationKey,
      };

      // If we're already on tracking, focus immediately without navigation.
      if (typeof window !== 'undefined' && String(pathname || '') === '/tracking') {
        try {
          window.dispatchEvent(new CustomEvent('vtp:focus-vehicle', { detail }));
        } catch {}
        setIsNotificationsOpen(false);
        return;
      }

      // Otherwise, handoff to tracking page on navigation.
      try {
        window.sessionStorage.setItem(
          PENDING_TRACK_FOCUS_KEY,
          JSON.stringify({
            focusId: detail.imeiId || detail.vehicleNo || detail.vehicleName || fallbackFocusId,
            viewLocation: Boolean(viewLocation),
            issuedAt: Date.now(),
          })
        );
      } catch {}

      setIsNotificationsOpen(false);
      navigateWithTransition(router, '/tracking');
    },
    [buildTrackingFocusId, getNotificationKey, pathname, router]
  );

  const handleAcknowledgeNotification = useCallback(
    async (item) => {
      if (!item?.id) return;
      const notificationKey = getNotificationKey(item);
      setSeenNotificationKeys((prev) =>
        prev.includes(notificationKey) ? prev : [...prev, notificationKey]
      );
      setAcknowledgingKey(notificationKey);

      try {
        const response = await fetch('/api/alerts/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alert_id: item.id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.message || 'Unable to acknowledge alert.');
        }

        await refreshNotifications();
      } catch {
        // Ignore acknowledge failures and keep the panel responsive.
        setSeenNotificationKeys((prev) => prev.filter((key) => key !== notificationKey));
      } finally {
        setAcknowledgingKey('');
      }
    },
    [getNotificationKey, refreshNotifications]
  );

  const handleClearAllVisible = useCallback(async () => {
    if (visibleNotifications.length === 0) return;
    // Mark all visible as seen optimistically; then acknowledge in background.
    const keys = visibleNotifications.map((item) => getNotificationKey(item));
    setSeenNotificationKeys((prev) => Array.from(new Set([...prev, ...keys])));

    // Best-effort: sequential small-batch to avoid spamming API.
    const pending = visibleNotifications.slice(0, 12);
    for (const item of pending) {
      await handleAcknowledgeNotification(item);
    }
  }, [getNotificationKey, handleAcknowledgeNotification, visibleNotifications]);

  useEffect(() => {
    setSeenNotificationKeys((prev) =>
      prev.filter((key) => notifications.some((item) => getNotificationKey(item) === key))
    );
  }, [getNotificationKey, notifications]);

  const handleToggleAlertSound = () => {
    setIsAlertSoundMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ALERT_SOUND_MUTED_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    try {
      setIsAlertSoundMuted(localStorage.getItem(ALERT_SOUND_MUTED_KEY) === '1');
    } catch {
      setIsAlertSoundMuted(false);
    }
  }, []);

  useEffect(() => {
    const signature = notifications
      .slice(0, 5)
      .map((item) => `${item.id}:${item.time}:${item.acknowledged ? 1 : 0}`)
      .join('|');

    if (!signature) return;

    if (!hasPrimedAlertAudioRef.current) {
      hasPrimedAlertAudioRef.current = true;
      lastAlertSignatureRef.current = signature;
      return;
    }

    if (signature === lastAlertSignatureRef.current) return;
    lastAlertSignatureRef.current = signature;

    const newestAlert = notifications[0];
    if (
      newestAlert &&
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible' &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      lastBrowserAlertIdRef.current !== String(newestAlert.id)
    ) {
      lastBrowserAlertIdRef.current = String(newestAlert.id);
      try {
        new Notification(newestAlert.vehicleName || 'New alert', {
          body: newestAlert.message || 'A new live alert was received.',
          tag: `vtp-alert-${newestAlert.id}`,
          silent: false,
        });
      } catch {
        // Ignore browser notification failures.
      }
    }

    if (isAlertSoundMuted) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gainNode.gain.setValueAtTime(0.001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
      oscillator.onended = () => {
        context.close().catch(() => {});
      };
    } catch {
      // Ignore audio playback failures until user interaction unlocks audio.
    }
  }, [isAlertSoundMuted, notifications]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;
    if (!authDataEnabled) return undefined;
    if (Notification.permission !== 'default') return undefined;

    const requestPermission = () => {
      Notification.requestPermission().catch(() => {});
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
    };

    window.addEventListener('pointerdown', requestPermission, { once: true });
    window.addEventListener('keydown', requestPermission, { once: true });

    return () => {
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
    };
  }, [authDataEnabled]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        if (isDraggingNotificationsRef.current) return;
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
      if (helpRef.current && !helpRef.current.contains(event.target)) {
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePointerMove = (event) => {
      if (!notificationsDragRef.current.active) return;
      if (notificationsDragRef.current.pointerId !== event.pointerId) return;
      const panel = notificationsPanelRef.current;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();
      const viewportW = window.innerWidth || 0;
      const viewportH = window.innerHeight || 0;
      const gutter = 8;
      const width = rect.width || 292;
      const height = rect.height || 360;

      const x = event.clientX - notificationsDragRef.current.offsetX;
      const y = event.clientY - notificationsDragRef.current.offsetY;

      const clampedX = Math.max(gutter, Math.min(Math.max(gutter, viewportW - width - gutter), x));
      const clampedY = Math.max(gutter, Math.min(Math.max(gutter, viewportH - height - gutter), y));

      isDraggingNotificationsRef.current = true;
      setNotificationsPanelPosition({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = (event) => {
      if (!notificationsDragRef.current.active) return;
      if (notificationsDragRef.current.pointerId !== event.pointerId) return;
      notificationsDragRef.current.active = false;
      notificationsDragRef.current.pointerId = null;

      const pos = notificationsPanelPosition;
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        persistNotificationsPanelPosition(pos);
      }

      window.setTimeout(() => {
        isDraggingNotificationsRef.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [notificationsPanelPosition, persistNotificationsPanelPosition]);

  const saveRecentSearch = (value) => {
    const term = String(value || '').trim();
    if (!term) return;
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(
        0,
        RECENT_SEARCHES_LIMIT
      );
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.filter(Boolean).map((v) => String(v)).slice(0, RECENT_SEARCHES_LIMIT));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    if (!authActionsEnabled) return;
    router.prefetch('/profile');
  }, [authActionsEnabled, router]);

  useEffect(() => {
    setAuthActionLoading('');
  }, [pathname]);

  useEffect(() => {
    if (!authDataEnabled) {
      setProfilePhotoUrl('');
      return undefined;
    }

    let cancelled = false;

    const applyCachedAvatar = () => {
      try {
        const globalPreviewUrl = String(window[AVATAR_PREVIEW_GLOBAL_KEY] || '').trim();
        if (globalPreviewUrl) {
          setProfilePhotoUrl(globalPreviewUrl);
          return true;
        }
        const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const cachedUpdatedAt = String(parsed?.avatarUpdatedAt || '').trim();
        if (!cachedUpdatedAt || !parsed?.hasAvatar) return false;
        setProfilePhotoUrl(`/api/profile/avatar?v=${encodeURIComponent(cachedUpdatedAt)}`);
        return true;
      } catch {
        return false;
      }
    };

    const syncProfileVisual = async (event) => {
      const detail = event?.detail;
      if (detail && detail.hasAvatar && detail.previewUrl) {
        setProfilePhotoUrl(String(detail.previewUrl));
        return;
      }
      if (detail && detail.hasAvatar === false) {
        setProfilePhotoUrl('');
        return;
      }
      try {
        applyCachedAvatar();
        const response = await fetch('/api/profile/avatar?meta=1', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload?.hasAvatar) {
          window.localStorage.removeItem(AVATAR_CACHE_KEY);
          setProfilePhotoUrl('');
          return;
        }
        const avatarVersion = String(payload?.avatarUpdatedAt || Date.now());
        window.localStorage.setItem(
          AVATAR_CACHE_KEY,
          JSON.stringify({ avatarUpdatedAt: avatarVersion, hasAvatar: true })
        );
        setProfilePhotoUrl(`/api/profile/avatar?v=${encodeURIComponent(avatarVersion)}`);
      } catch {
        if (!cancelled) setProfilePhotoUrl('');
      }
    };

    applyCachedAvatar();
    syncProfileVisual();
    window.addEventListener('storage', syncProfileVisual);
    window.addEventListener('vtp-profile-updated', syncProfileVisual);
    window.addEventListener('focus', syncProfileVisual);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncProfileVisual);
      window.removeEventListener('vtp-profile-updated', syncProfileVisual);
      window.removeEventListener('focus', syncProfileVisual);
    };
  }, [authDataEnabled]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const term = searchTerm.trim();
    if (!isSearching && onSearch && term) {
      setSuppressSuggestions(true);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      saveRecentSearch(term);
      onSearch(term);
    }
  };

  const handleSuggestionPick = (suggestion) => {
    if (!suggestion) return;
    const nextTerm = suggestion.label || suggestion.display_name || '';
    setSearchTerm(nextTerm);
    setSuppressSuggestions(true);
    saveRecentSearch(nextTerm);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    if (onSearchPick) {
      onSearchPick(suggestion);
      return;
    }
    if (onSearch && nextTerm && !isSearching) {
      onSearch(nextTerm);
    }
  };

  useEffect(() => {
    if (!onSearchSuggest) return undefined;
    if (suppressSuggestions) {
      setShowSuggestions(false);
      setIsSuggesting(false);
      setActiveSuggestionIndex(-1);
      return undefined;
    }
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      setActiveSuggestionIndex(-1);
      return undefined;
    }

    const requestId = ++suggestReqRef.current;
    setIsSuggesting(true);
    const timer = setTimeout(async () => {
      try {
        const next = await onSearchSuggest(q);
        if (requestId !== suggestReqRef.current) return;
        setSuggestions(Array.isArray(next) ? next : []);
        setShowSuggestions(true);
        setActiveSuggestionIndex(-1);
      } catch {
        if (requestId !== suggestReqRef.current) return;
        setSuggestions([]);
      } finally {
        if (requestId === suggestReqRef.current) setIsSuggesting(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchSuggest, suppressSuggestions]);

  return (
    <div className={styles.header}>
      <div className={styles.searchWrap} ref={searchRef}>
        <div className={styles.searchContainer}>
          <FaSearch size={16} className={styles.searchIconInternal} />
          <input
            type="text"
            placeholder="Search"
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => {
              if (suppressSuggestions) setSuppressSuggestions(false);
              setSearchTerm(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (suppressSuggestions) return;
              if (suggestions.length > 0 || recentSearches.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && suggestions.length > 0) {
                e.preventDefault();
                setShowSuggestions(true);
                setActiveSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
                return;
              }
              if (e.key === 'ArrowUp' && suggestions.length > 0) {
                e.preventDefault();
                setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
                return;
              }
              if (e.key === 'Escape') {
                setShowSuggestions(false);
                setActiveSuggestionIndex(-1);
                return;
              }
              if (e.key === 'Enter' && !isSearching) {
                if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
                  e.preventDefault();
                  handleSuggestionPick(suggestions[activeSuggestionIndex]);
                  return;
                }
                handleSearchSubmit(e);
              }
            }}
            disabled={isSearching}
          />
          {(isSearching || isSuggesting) && <span className={styles.searchSpinner}>...</span>}
        </div>
        {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
          <div className={styles.suggestionsPanel}>
            {recentSearches.length > 0 && (
              <div className={styles.recentSearchesBlock}>
                <div className={styles.recentSearchesTitle}>Recent</div>
                <div className={styles.recentSearchesChips}>
                  {recentSearches.map((item) => (
                    <button
                      key={`recent-${item}`}
                      className={styles.recentChip}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionPick({ label: item, display_name: item })}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {suggestions.map((item, idx) => (
              <button
                key={item.id || `${item.label}-${idx}`}
                className={`${styles.suggestionItem} ${
                  idx === activeSuggestionIndex ? styles.suggestionItemActive : ''
                }`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionPick(item)}
              >
                <span className={styles.suggestionPrimary}>{item.label || item.display_name}</span>
                {item.subLabel && <span className={styles.suggestionSecondary}>{item.subLabel}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div ref={notificationsRef} className={styles.notificationsWrap}>
          <button
            className={styles.iconButtonWrapper}
            title="Notifications"
            type="button"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
          >
            <FaBell size={18} className={styles.iconButtonIcon} />
            {notificationBadgeLabel ? (
              <span
                className={`${styles.notificationBadge} ${
                  notificationBadgeLabel.length > 6
                    ? styles.notificationBadgeXXL
                    : notificationBadgeLabel.length > 4
                    ? styles.notificationBadgeXL
                    : notificationBadgeLabel.length > 2
                    ? styles.notificationBadgeWide
                    : ''
                }`}
                aria-label={`${unreadCount} unread notifications`}
              >
                {notificationBadgeLabel}
              </span>
            ) : null}
          </button>
          {isNotificationsOpen && (
            <div
              ref={notificationsPanelRef}
              className={styles.notificationsPanel}
              style={
                notificationsPanelPosition &&
                typeof notificationsPanelPosition.x === 'number' &&
                typeof notificationsPanelPosition.y === 'number'
                  ? {
                      position: 'fixed',
                      left: `${Math.round(notificationsPanelPosition.x)}px`,
                      top: `${Math.round(notificationsPanelPosition.y)}px`,
                      right: 'auto',
                    }
                  : undefined
              }
            >
              <div
                className={styles.notificationsTopbar}
              >
                <div className={styles.notificationsTabs} aria-label="Notifications tabs">
                  <button
                    type="button"
                    className={`${styles.notificationsTab} ${
                      activeNotificationsTab === 'notifications' ? styles.notificationsTabActive : ''
                    }`}
                    onClick={() => setActiveNotificationsTab('notifications')}
                    title="Notifications"
                    aria-label="Notifications"
                  >
                    <FaBell size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.notificationsTab} ${
                      activeNotificationsTab === 'announcements' ? styles.notificationsTabActive : ''
                    }`}
                    onClick={() => setActiveNotificationsTab('announcements')}
                    title="Announcements"
                    aria-label="Announcements"
                  >
                    <FaBullhorn size={16} aria-hidden="true" />
                  </button>
                </div>

                <div
                  className={styles.notificationsDragRegion}
                  aria-label="Drag notifications panel"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    const panel = notificationsPanelRef.current;
                    if (!panel) return;

                    const rect = panel.getBoundingClientRect();
                    const baseX =
                      notificationsPanelPosition && typeof notificationsPanelPosition.x === 'number'
                        ? notificationsPanelPosition.x
                        : rect.left;
                    const baseY =
                      notificationsPanelPosition && typeof notificationsPanelPosition.y === 'number'
                        ? notificationsPanelPosition.y
                        : rect.top;

                    // Ensure a fixed-position baseline before drag so math stays stable.
                    setNotificationsPanelPosition({ x: baseX, y: baseY });

                    notificationsDragRef.current = {
                      active: true,
                      pointerId: event.pointerId,
                      offsetX: event.clientX - baseX,
                      offsetY: event.clientY - baseY,
                    };

                    try {
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    } catch {}

                    event.preventDefault();
                  }}
                />
                <div className={styles.notificationsTopActions}>
                  <button
                    type="button"
                    className={styles.notificationSoundToggle}
                    aria-label={isAlertSoundMuted ? 'Unmute alert sound' : 'Mute alert sound'}
                    title={isAlertSoundMuted ? 'Unmute alert sound' : 'Mute alert sound'}
                    onClick={handleToggleAlertSound}
                  >
                    {isAlertSoundMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                  </button>
                  <button
                    type="button"
                    className={styles.notificationsCloseBtn}
                    aria-label="Close notifications"
                    title="Close"
                    onClick={() => setIsNotificationsOpen(false)}
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>

              {activeNotificationsTab === 'announcements' ? (
                <div className={styles.notificationsEmpty}>No announcements</div>
              ) : (
                <>
                  <div className={styles.notificationsHeader}>
                    <div className={styles.notificationsTitleWrap}>
                      <span>Notifications</span>
                      <small>{activeVisibleCount} active</small>
                    </div>
                  </div>

                  <div className={styles.notificationsSummary}>
                    <button
                      type="button"
                      className={`${styles.notificationsFilterBtn} ${styles.high} ${
                        activeNotificationLevel === 'HIGH' ? styles.notificationsFilterBtnActive : ''
                      }`}
                      onClick={() =>
                        setActiveNotificationLevel((prev) => (prev === 'HIGH' ? '' : 'HIGH'))
                      }
                    >
                      <strong>{highCount}</strong>
                      <span>High</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.notificationsFilterBtn} ${styles.medium} ${
                        activeNotificationLevel === 'MEDIUM' ? styles.notificationsFilterBtnActive : ''
                      }`}
                      onClick={() =>
                        setActiveNotificationLevel((prev) => (prev === 'MEDIUM' ? '' : 'MEDIUM'))
                      }
                    >
                      <strong>{mediumCount}</strong>
                      <span>Medium</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.notificationsFilterBtn} ${styles.low} ${
                        activeNotificationLevel === 'LOW' ? styles.notificationsFilterBtnActive : ''
                      }`}
                      onClick={() =>
                        setActiveNotificationLevel((prev) => (prev === 'LOW' ? '' : 'LOW'))
                      }
                    >
                      <strong>{lowCount}</strong>
                      <span>Low</span>
                    </button>
                  </div>

                  <div className={styles.notificationsMetaRow}>
                    <span className={styles.notificationsDate}>{notificationsDateLabel}</span>
                    <button
                      type="button"
                      className={styles.notificationsClearAll}
                      onClick={handleClearAllVisible}
                      disabled={visibleNotifications.length === 0}
                    >
                      Clear All
                    </button>
                  </div>

                  <div
                    className={styles.notificationsList}
                    onScroll={(event) => {
                      if (!hasMoreNotifications || isNotificationsLoadingMore) return;
                      const target = event.currentTarget;
                      const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                      if (distanceToBottom > 48) return;
                      loadMoreNotifications();
                    }}
                  >
                    {isNotificationsLoading && notifications.length === 0 ? (
                      <div className={styles.notificationsEmpty}>Loading alerts...</div>
                    ) : null}
                    {!isNotificationsLoading && notifications.length === 0 ? (
                      <div className={styles.notificationsEmpty}>No active alerts</div>
                    ) : null}
                    {!isNotificationsLoading &&
                    notifications.length > 0 &&
                    visibleNotifications.length === 0 ? (
                      <div className={styles.notificationsEmpty}>
                        No {activeNotificationLevel.toLowerCase()} alerts
                      </div>
                    ) : null}
                    {visibleNotifications.map((item) => {
                      const notificationKey = getNotificationKey(item);
                      const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
                      const vehicleLabel =
                        raw?.obj_reg_no ||
                        raw?.vehicle_no ||
                        raw?.obj_name ||
                        raw?.vehicle_name ||
                        item.vehicleNo ||
                        item.vehicle_no ||
                        item.vehicleName ||
                        'Vehicle';
                      const driverLabel =
                        raw?.driver_name ||
                        raw?.driver ||
                        item.driverName ||
                        item.driver_name ||
                        item.driver ||
                        '';
                      const companyLabel = raw?.company || item.companyName || item.company || '';
                      const branchLabel = raw?.branch || item.branchName || item.branch || '';
                      const canResolveVehicle = Boolean(buildTrackingFocusId(item));

                      return (
                        <div
                          key={notificationKey}
                          className={`${styles.notificationCard} ${
                            item.acknowledged || seenNotificationKeys.includes(notificationKey)
                              ? styles.notificationItemSeen
                              : ''
                          }`}
                        >
                          <div className={styles.notificationCardTop}>
                            <span className={`${styles.levelDot} ${styles[`dot${item.levelClass}`]}`} />
                            <div className={styles.notificationText}>
                              <div className={styles.notificationRowTop}>
                                <div className={styles.notificationVehicleRow}>
                                  <span className={styles.notificationVehicle}>{vehicleLabel}</span>
                                  <span className={styles.notificationTime}>{item.displayTime}</span>
                                </div>
                                <div className={styles.notificationActions}>
                                  {item.acknowledged || seenNotificationKeys.includes(notificationKey) ? (
                                    <span className={styles.notificationSeenBadge}>Seen</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className={styles.notificationSeenBtn}
                                      disabled={acknowledgingKey === notificationKey}
                                      onClick={() => handleAcknowledgeNotification(item)}
                                      title="Mark seen"
                                      aria-label="Mark seen"
                                    >
                                      {acknowledgingKey === notificationKey ? '...' : 'X'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {driverLabel ? <div className={styles.notificationDriver}>{driverLabel}</div> : null}
                              <div className={styles.notificationMessage}>{item.message}</div>
                              {companyLabel || branchLabel ? (
                                <div className={styles.notificationOrgRow}>
                                  {companyLabel ? <span>Company: {companyLabel}</span> : <span />}
                                  {branchLabel ? <span>Branch: {branchLabel}</span> : <span />}
                                </div>
                              ) : null}
                              <div className={styles.notificationButtons}>
                                <button
                                  type="button"
                                  className={styles.notificationBtnPrimary}
                                  onClick={() => handleTrackFromNotification(item, { viewLocation: false })}
                                  disabled={!canResolveVehicle}
                                >
                                  Track
                                </button>
                                <button
                                  type="button"
                                  className={styles.notificationBtnSecondary}
                                  disabled={!canResolveVehicle}
                                  onClick={() => handleTrackFromNotification(item, { viewLocation: true })}
                                >
                                  View Location
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {isNotificationsLoadingMore ? (
                      <div className={styles.notificationsEmpty}>Loading more alerts...</div>
                    ) : null}
                  </div>
                </>
              )}
              <div className={styles.notificationsFooter}>
                <Link
                  href={notificationsPageHref}
                  className={styles.notificationsViewAll}
                  onClick={() => setIsNotificationsOpen(false)}
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        <div ref={helpRef} className={styles.helpWrap}>
          <button
            className={styles.iconButtonWrapper}
            title="Quick Help"
            type="button"
            onClick={() => setIsHelpOpen((prev) => !prev)}
          >
            <FaQuestionCircle size={18} className={styles.iconButtonIcon} />
          </button>
          {isHelpOpen && (
            <div className={styles.helpPanel}>
              <div className={styles.helpHeader}>Quick Help</div>
              <div className={styles.helpSection}>
                <strong>Tracking</strong>
                <p>Vehicle click: telemetry open, blue circle: selected vehicle.</p>
              </div>
              <div className={styles.helpSection}>
                <strong>Search</strong>
                <p>Type 2+ chars for live suggestions. Enter to jump on map.</p>
              </div>
              <div className={styles.helpSection}>
                <strong>Map Controls</strong>
                <p>Locate, traffic, labels, map type, refresh/reset view available on right controls.</p>
              </div>
              <div className={styles.helpFooter}>
                <a href="mailto:support@visualtelematics.com">Contact Support</a>
              </div>
            </div>
          )}
        </div>

        {authChecked && isAuthenticated ? (
          <>
            <div ref={profileRef} className={styles.profileWrap}>
              <button
                className={styles.userIconWrapper}
                title="User Profile"
                onClick={() => setIsProfileOpen((prev) => !prev)}
              >
                {profilePhotoUrl ? (
                  <Image
                    src={profilePhotoUrl}
                    alt="User avatar"
                    width={40}
                    height={40}
                    className={styles.userAvatarImage}
                    unoptimized
                  />
                ) : (
                  <FaUserCircle size={22} className={styles.userIcon} />
                )}
                <span className={styles.statusIndicator}></span>
              </button>
              {isProfileOpen && (
                <div className={styles.profileMenu}>
                  <button
                    className={styles.profileMenuItem}
                    type="button"
                    disabled={authActionLoading === 'profile' || authActionLoading === 'logout'}
                    onMouseEnter={() => router.prefetch('/profile')}
                    onFocus={() => router.prefetch('/profile')}
                    onClick={() => {
                      if (pathname === '/profile') {
                        setIsProfileOpen(false);
                        setAuthActionLoading('');
                        return;
                      }
                      setAuthActionLoading('profile');
                      setIsProfileOpen(false);
                      startTransition(() => {
                        router.push('/profile');
                      });
                    }}
                  >
                    <span className={styles.profileMenuItemInner}>
                      {authActionLoading !== 'profile' ? (
                        <FaUser aria-hidden="true" />
                      ) : null}
                      <span>{authActionLoading === 'profile' ? 'Opening...' : 'Profile'}</span>
                    </span>
                  </button>
                  <button
                    className={styles.profileMenuItem}
                    type="button"
                    disabled={authActionLoading === 'profile' || authActionLoading === 'logout'}
                    onClick={() => {
                      setAuthActionLoading('logout');
                      setIsProfileOpen(false);
                      redirectToLogout('/login');
                    }}
                  >
                    <span className={styles.profileMenuItemInner}>
                      {authActionLoading !== 'logout' ? (
                        <FaSignOutAlt aria-hidden="true" />
                      ) : null}
                      <span>{authActionLoading === 'logout' ? 'Logging out...' : 'Logout'}</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : !authChecked && !hideAuthActions ? (
          <button className={styles.authInlineLoader} type="button" aria-label="Checking authentication" disabled>
            ...
          </button>
        ) : authChecked && !hideAuthActions ? (
          <>
            <Link href="/login" className={styles.signInLink}>
              Sign In
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default Header;
