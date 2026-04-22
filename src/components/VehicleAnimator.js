'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const AnimatedMarker = dynamic(() => import('./AnimatedMarker'), { ssr: false });

const lerp = (a, b, t) => a + (b - a) * t;

const interpolatePosition = (start, end, t) => [
  lerp(start[0], end[0], t),
  lerp(start[1], end[1], t),
];

const VehicleAnimator = ({ vehicle }) => {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [previousPosition, setPreviousPosition] = useState(null);

  const animationFrameRef = useRef(null);
  const pathRef = useRef([]);
  const lastStepRef = useRef(0);

  useEffect(() => {
    if (!vehicle?.path?.length) return;

    const path = vehicle.path.map(p => [p.latitude, p.longitude]);
    pathRef.current = path;

    let startTime = null;
    const totalAnimationTime = 50000;
    const stepDuration = totalAnimationTime / (path.length - 1);

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const step = Math.floor(elapsed / stepDuration);

      if (step >= path.length - 1) {
        setPreviousPosition(path[path.length - 2]);
        setCurrentPosition(path[path.length - 1]);
        cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      // Interpolate between current and next point
      const t = (elapsed % stepDuration) / stepDuration;
      const start = path[step];
      const end = path[step + 1];
      const interpolated = interpolatePosition(start, end, t);

      setPreviousPosition(start);
      setCurrentPosition(interpolated);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Initialize positions
    setCurrentPosition(path[0]);
    setPreviousPosition(null);
    lastStepRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [vehicle.path]);

  if (!currentPosition) return null;

  return (
    <AnimatedMarker
      vehicle={vehicle}
      position={currentPosition}
      previousPosition={previousPosition}
    />
  );
};

export default VehicleAnimator;