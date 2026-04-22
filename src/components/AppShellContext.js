"use client";

import React from "react";

export const DEFAULT_APP_HEADER_PROPS = Object.freeze({
  onSearch: undefined,
  onSearchSuggest: undefined,
  onSearchPick: undefined,
  isSearching: false,
  statusFilter: "total",
  onStatusFilterChange: undefined,
  hideAuthActions: false,
});

export const DEFAULT_APP_SIDEBAR_PROPS = Object.freeze({
  isOpen: true,
  hideDashboardToggle: false,
});

const AppShellContext = React.createContext({
  shellActive: false,
  isMobileView: false,
  headerVisible: false,
  headerProps: DEFAULT_APP_HEADER_PROPS,
  sidebarProps: DEFAULT_APP_SIDEBAR_PROPS,
  setHeaderVisible: () => {},
  resetHeaderVisible: () => {},
  setHeaderProps: () => {},
  resetHeaderProps: () => {},
  setSidebarProps: () => {},
  resetSidebarProps: () => {},
});

export function AppShellProvider({ value, children }) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  return React.useContext(AppShellContext);
}

export function useConfigureAppShell({
  headerProps = null,
  sidebarProps = null,
  headerVisible = null,
} = {}) {
  const {
    shellActive,
    setHeaderVisible,
    resetHeaderVisible,
    setHeaderProps,
    resetHeaderProps,
    setSidebarProps,
    resetSidebarProps,
  } = useAppShell();

  React.useEffect(() => {
    if (!shellActive || typeof headerVisible !== "boolean") return undefined;
    setHeaderVisible(headerVisible);
    return () => resetHeaderVisible();
  }, [headerVisible, resetHeaderVisible, setHeaderVisible, shellActive]);

  React.useEffect(() => {
    if (!shellActive || !headerProps) return undefined;
    setHeaderProps(headerProps);
    return () => resetHeaderProps();
  }, [headerProps, resetHeaderProps, setHeaderProps, shellActive]);

  React.useEffect(() => {
    if (!shellActive || !sidebarProps) return undefined;
    setSidebarProps(sidebarProps);
    return () => resetSidebarProps();
  }, [resetSidebarProps, setSidebarProps, shellActive, sidebarProps]);
}
