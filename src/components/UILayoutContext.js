"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const UILayoutContext = createContext({
  positions: {},
  setPosition: () => {},
});

export function UILayoutProvider({ children }) {
  const [positions, setPositions] = useState({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ui-layout");
        const data = await res.json();
        if (active && data?.positions) {
          setPositions(data.positions);
        }
      } catch (err) {
        console.error("Failed to load UI layout", err);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const setPosition = useCallback((layoutKey, position) => {
    setPositions((prev) => ({ ...prev, [layoutKey]: position }));
    fetch("/api/ui-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layoutKey, position }),
    }).catch((err) => console.error("Failed to save UI layout", err));
  }, []);

  const value = useMemo(() => ({ positions, setPosition }), [positions, setPosition]);

  return <UILayoutContext.Provider value={value}>{children}</UILayoutContext.Provider>;
}

export function useUILayout() {
  return useContext(UILayoutContext);
}
