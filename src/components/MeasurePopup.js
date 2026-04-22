// src/components/MeasurePopup.js
import React, { useState, useEffect } from 'react';
import styles from './MeasurePopup.module.css';
import { FaTimes, FaCheck } from 'react-icons/fa';

const DISTANCE_UNIT_OPTIONS = [
  { value: 'km', label: 'Kilometers' },
  { value: 'm', label: 'Meters' },
  { value: 'mi', label: 'Miles' },
];

const AREA_UNIT_OPTIONS = [
  { value: 'sq_m', label: 'Square meters' },
  { value: 'sq_km', label: 'Square kilometers' },
  { value: 'acres', label: 'Acres' },
];

const MeasurePopup = ({
  isOpen,
  onClose,
  onApply,
  onClear,
  mode = 'distance',
  distanceUnit = 'km',
  areaUnit = 'sq_km',
  summary = null,
  isActive = false,
}) => {
  const [selectedMode, setSelectedMode] = useState(mode);
  const [selectedDistanceUnit, setSelectedDistanceUnit] = useState(distanceUnit);
  const [selectedAreaUnit, setSelectedAreaUnit] = useState(areaUnit);

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(mode || 'distance');
      setSelectedDistanceUnit(distanceUnit || 'km');
      setSelectedAreaUnit(areaUnit || 'sq_km');
    }
  }, [areaUnit, distanceUnit, isOpen, mode]);

  const handleApplyClick = () => {
    if (onApply) {
      onApply({
        mode: selectedMode,
        distanceUnit: selectedDistanceUnit,
        areaUnit: selectedAreaUnit,
      });
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.popupContainer}>
      <div className={styles.popupHeader}>
        <h3 className={styles.popupTitle}>Measure On Map</h3>
        <button onClick={onClose} className={styles.closeButton} title="Close">
          <FaTimes />
        </button>
      </div>
      <div className={styles.popupBody}>
        <div className={styles.formGroup}>
          <label htmlFor="measureMode" className={styles.label}>
            Measurement Type
          </label>
          <select
            id="measureMode"
            className={styles.input}
            value={selectedMode}
            onChange={(event) => setSelectedMode(event.target.value)}
          >
            <option value="distance">Distance</option>
            <option value="area">Area</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="distanceUnit" className={styles.label}>
            Distance Unit
          </label>
          <select
            id="distanceUnit"
            className={styles.input}
            value={selectedDistanceUnit}
            onChange={(event) => setSelectedDistanceUnit(event.target.value)}
          >
            {DISTANCE_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="areaUnit" className={styles.label}>
            Area Unit
          </label>
          <select
            id="areaUnit"
            className={styles.input}
            value={selectedAreaUnit}
            onChange={(event) => setSelectedAreaUnit(event.target.value)}
          >
            {AREA_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span>Current Result</span>
            <strong>{isActive ? 'Active' : 'Idle'}</strong>
          </div>
          {summary?.formattedValue ? (
            <>
              <div className={styles.summaryValue}>{summary.formattedValue}</div>
              {summary.secondaryValue ? (
                <div className={styles.summaryMeta}>{summary.secondaryValue}</div>
              ) : null}
            </>
          ) : (
            <div className={styles.summaryHint}>
              Click apply, then add map points. Right click removes the last point and double click finishes.
            </div>
          )}
        </div>
      </div>
      <div className={styles.popupFooter}>
        {onClear ? (
          <button onClick={() => { onClear(); onClose(); }} className={`${styles.button} ${styles.clearButton}`}>
            Clear
          </button>
        ) : null}
        <button onClick={handleApplyClick} className={`${styles.button} ${styles.applyButton}`}>
          <FaCheck size={12} style={{ marginRight: '5px' }} /> Start
        </button>
        <button onClick={onClose} className={`${styles.button} ${styles.cancelButton}`}>
          <FaTimes size={12} style={{ marginRight: '5px' }}/> Cancel
        </button>
      </div>
    </div>
  );
};

export default MeasurePopup;
