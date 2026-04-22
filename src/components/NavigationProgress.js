"use client";

import React from "react";
import CenteredCarLoader from "@/components/CenteredCarLoader";

const NAVIGATION_START_EVENT = "vtp:navigation-start";
const NAVIGATION_END_EVENT = "vtp:navigation-end";
const MIN_VISIBLE_MS = 280;
const MAX_VISIBLE_MS = 15000;

export function announceNavigationStart(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail }));
}

export function announceNavigationEnd(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATION_END_EVENT, { detail }));
}

export function NavigationProgressProvider({ children }) {
  const [isNavigating, setIsNavigating] = React.useState(false);
  const startedAtRef = React.useRef(0);
  const hideTimerRef = React.useRef(null);
  const watchdogTimerRef = React.useRef(null);

  const clearTimers = React.useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const beginNavigation = React.useCallback(() => {
    clearTimers();
    startedAtRef.current = Date.now();
    setIsNavigating(true);
    watchdogTimerRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      clearTimers();
    }, MAX_VISIBLE_MS);
  }, [clearTimers]);

  const endNavigation = React.useCallback(() => {
    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);
    clearTimers();
    hideTimerRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      clearTimers();
    }, remaining);
  }, [clearTimers]);

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (isNavigating) {
      document.body.setAttribute("data-navigation-pending", "true");
    } else {
      document.body.removeAttribute("data-navigation-pending");
    }
    return () => {
      document.body.removeAttribute("data-navigation-pending");
    };
  }, [isNavigating]);

  React.useEffect(() => {
    const handleStart = () => beginNavigation();
    const handleEnd = () => endNavigation();
    window.addEventListener(NAVIGATION_START_EVENT, handleStart);
    window.addEventListener(NAVIGATION_END_EVENT, handleEnd);
    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, handleStart);
      window.removeEventListener(NAVIGATION_END_EVENT, handleEnd);
      clearTimers();
    };
  }, [beginNavigation, clearTimers, endNavigation]);

  const value = React.useMemo(
    () => ({
      isNavigating,
      beginNavigation,
      endNavigation,
    }),
    [beginNavigation, endNavigation, isNavigating]
  );

  return (
    <NavigationProgressContext.Provider value={value}>
      {children}
      {isNavigating ? <CenteredCarLoader fixed scope="navigation" /> : null}
    </NavigationProgressContext.Provider>
  );
}

const NavigationProgressContext = React.createContext({
  isNavigating: false,
  beginNavigation: () => {},
  endNavigation: () => {},
});

export function useNavigationProgress() {
  return React.useContext(NavigationProgressContext);
}
