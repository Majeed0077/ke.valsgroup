import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './MapControls.module.css';
import {
  FaMapMarkerAlt, FaStar, FaMap, FaTrafficLight,
  FaLocationArrow, FaCrosshairs, FaTag, FaArrowsAltV, FaPlus, FaMinus, FaRedoAlt, FaExchangeAlt, FaSlidersH
} from 'react-icons/fa';

const mainControlsConfig = [
  { id: 'locate',        icon: FaMapMarkerAlt,    label: 'Locate Me' },
  { id: 'favorites',     icon: FaStar,            label: 'Favorites' },
  { id: 'layers',        icon: FaMap,             label: 'Layers' },
  { id: 'traffic',       icon: FaTrafficLight,    label: 'Traffic' },
  { id: 'send',          icon: FaLocationArrow,   label: 'Toggle Vehicles / Navigate' },
  { id: 'gps',           icon: FaCrosshairs,      label: 'Center on GPS' },
  { id: 'measure',       icon: FaArrowsAltV,      label: 'Measurement Units' },
  { id: 'labels',        icon: FaTag,             label: 'Toggle Labels' },
  { id: 'refresh',       icon: FaRedoAlt,         label: 'Refresh / Reset View' },
  { id: 'swap',          icon: FaExchangeAlt,     label: 'Swap / Compare View' },
];

const PANEL_WIDTH = 214;

const MapControls = React.memo(({
  onControlClick,
  onZoomIn,
  onZoomOut,
  isMobileView = false,
  isPanelOpen = false,
}) => {
  const controls = useMemo(() => mainControlsConfig, []);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const mobileControlsRef = useRef(null);

  const handleMainClick = useCallback((id) => {
    if (onControlClick) {
      onControlClick(id);
    }
  }, [onControlClick]);

  const handleZoomInClick = useCallback(() => {
    if (onZoomIn) {
      onZoomIn();
    } else {
      handleMainClick('zoomIn');
    }
  }, [onZoomIn, handleMainClick]);

  const handleZoomOutClick = useCallback(() => {
    if (onZoomOut) {
      onZoomOut();
    } else {
      handleMainClick('zoomOut');
    }
  }, [onZoomOut, handleMainClick]);

  useEffect(() => {
    if (!isMobileView) {
      setIsMobileControlsOpen(false);
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!mobileControlsRef.current?.contains(event.target)) {
        setIsMobileControlsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isMobileView]);

  const handleMobileMainClick = useCallback((id) => {
    handleMainClick(id);
    setIsMobileControlsOpen(false);
  }, [handleMainClick]);

  if (isMobileView) {
    return (
      <>
        <div ref={mobileControlsRef} className={styles.mobileControlsDock}>
          <button
            type="button"
            className={`${styles.mobileControlsTrigger} ${isMobileControlsOpen ? styles.mobileControlsTriggerActive : ''}`}
            onClick={() => setIsMobileControlsOpen((prev) => !prev)}
            aria-label="Open map controls"
            title="Map controls"
          >
            <FaSlidersH size={18} />
          </button>

          {isMobileControlsOpen ? (
            <div className={styles.mobileControlsPanel}>
              <div className={styles.mobileControlsGrid}>
                {controls.map((control) => {
                  const IconComponent = control.icon;
                  return (
                    <button
                      key={control.id}
                      className={styles.mobileControlButton}
                      onClick={() => handleMobileMainClick(control.id)}
                      title={control.label}
                      aria-label={control.label}
                    >
                      <IconComponent size={16} />
                      <span>{control.label}</span>
                    </button>
                  );
                })}
              </div>

            </div>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className={`${styles.mainControlsContainer} ${isPanelOpen ? styles.panelOpen : ''}`}
        style={{
          '--telemetry-panel-width': `${PANEL_WIDTH}px`,
          '--telemetry-panel-gap': '28px',
        }}
      >
        {controls.map((control) => {
          const IconComponent = control.icon;
          return (
            <button
              key={control.id}
              className={styles.mainControlButton}
              onClick={() => handleMainClick(control.id)}
              title={control.label}
              aria-label={control.label}
              tabIndex={0}
            >
              <IconComponent size={18} />
            </button>
          );
        })}

        <div className={styles.zoomControlsInline}>
          <button
            className={`${styles.zoomButton} ${styles.zoomButtonIn}`}
            onClick={handleZoomInClick}
            title="Zoom In"
            aria-label="Zoom In"
            tabIndex={0}
          >
            <FaPlus size={16} />
          </button>
          <button
            className={`${styles.zoomButton} ${styles.zoomButtonOut}`}
            onClick={handleZoomOutClick}
            title="Zoom Out"
            aria-label="Zoom Out"
            tabIndex={0}
          >
            <FaMinus size={16} />
          </button>
        </div>
      </div>
    </>
  );
});

MapControls.displayName = "MapControls";

export default MapControls;
