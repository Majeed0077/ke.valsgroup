"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useUILayout } from "./UILayoutContext";

const isInteractiveTarget = (target) =>
  !!target.closest("input, textarea, select, button, a, [data-no-drag]");

export default function Draggable({
  layoutKey,
  defaultPos = { x: 0, y: 0 },
  boundsSelector,
  handleSelector,
  className,
  children,
}) {
  const { positions, setPosition } = useUILayout();
  const [pos, setPos] = useState(defaultPos);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const nodeRef = useRef(null);

  useEffect(() => {
    if (positions[layoutKey]) {
      setPos(positions[layoutKey]);
    }
  }, [layoutKey, positions]);

  useEffect(() => {
    setPos((prev) => prev || defaultPos);
  }, [defaultPos]);

  useEffect(() => {
    if (positions[layoutKey]) return;
    setPos(defaultPos);
  }, [defaultPos, layoutKey, positions]);

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (isInteractiveTarget(target)) return;
    if (handleSelector && !target.closest(handleSelector)) return;

    const node = nodeRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    offsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    draggingRef.current = true;
    node.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!draggingRef.current) return;
    const node = nodeRef.current;
    if (!node) return;

    const boundsEl = boundsSelector ? document.querySelector(boundsSelector) : null;
    const containerRect = boundsEl?.getBoundingClientRect();
    const maxWidth = containerRect ? containerRect.width : window.innerWidth;
    const maxHeight = containerRect ? containerRect.height : window.innerHeight;
    const leftBound = containerRect ? containerRect.left : 0;
    const topBound = containerRect ? containerRect.top : 0;

    const nextX = Math.min(
      Math.max(event.clientX - offsetRef.current.x - leftBound, 0),
      Math.max(maxWidth - node.offsetWidth, 0)
    );
    const nextY = Math.min(
      Math.max(event.clientY - offsetRef.current.y - topBound, 0),
      Math.max(maxHeight - node.offsetHeight, 0)
    );

    setPos({ x: nextX, y: nextY });
  };

  const onPointerUp = (event) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const node = nodeRef.current;
    if (node) {
      node.releasePointerCapture(event.pointerId);
    }
    setPosition(layoutKey, pos);
  };

  return (
    <div
      ref={nodeRef}
      className={className}
      style={{ position: "absolute", left: pos.x, top: pos.y, touchAction: "none", pointerEvents: "auto" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  );
}
