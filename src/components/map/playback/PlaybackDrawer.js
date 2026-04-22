"use client";

import React from "react";
import {
  FaBell,
  FaCamera,
  FaChevronDown,
  FaChevronUp,
  FaGasPump,
  FaListUl,
  FaRoute,
  FaTachometerAlt,
  FaThermometerHalf,
} from "react-icons/fa";

const PLAYBACK_DRAWER_TABS = [
  { id: "trips", label: "Trips" },
  { id: "events", label: "Events" },
  { id: "dataPoints", label: "Data Points" },
  { id: "speed", label: "Speed" },
  { id: "fuel", label: "Fuel" },
  { id: "temperature", label: "Temperature" },
  { id: "gallery", label: "Image Gallery" },
];

function renderPlaybackDrawerIcon(tabId) {
  switch (tabId) {
    case "trips":
      return <FaRoute size={11} />;
    case "events":
      return <FaBell size={11} />;
    case "dataPoints":
      return <FaListUl size={11} />;
    case "speed":
      return <FaTachometerAlt size={11} />;
    case "fuel":
      return <FaGasPump size={11} />;
    case "temperature":
      return <FaThermometerHalf size={11} />;
    case "gallery":
      return <FaCamera size={11} />;
    default:
      return <FaListUl size={11} />;
  }
}

function PlaybackEmptyState({ message }) {
  return (
    <div className="vtp-playback-empty-state">
      <strong>No Record Found</strong>
      <span>{message}</span>
    </div>
  );
}

function displayValue(value, fallback = "N/A") {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized ? normalized : fallback;
}

export default function PlaybackDrawer({
  isOpen,
  activeTab,
  onOpenTab,
  onToggleOpen,
  playbackTrips,
  playbackEventRows,
  playbackSampleMetrics,
  selectedVehicle,
  formatPlaybackStamp,
  formatPlaybackSpeed,
  playbackSpeedChart,
  playbackFuelChart,
  playbackTemperatureChart,
  hasSpeedHistory,
  hasFuelHistory,
  hasTemperatureHistory,
  playbackSettings,
  playbackTemperatureSeries,
  activeTemperatureSensor,
  onSetActiveTemperatureSensor,
}) {
  return (
    <div className={`vtp-playback-drawer ${isOpen ? "is-open" : ""}`}>
      <div className="vtp-playback-drawer-strip">
        <div className="vtp-playback-drawer-tabs">
          {PLAYBACK_DRAWER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`vtp-playback-drawer-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => onOpenTab(tab.id)}
            >
              {renderPlaybackDrawerIcon(tab.id)}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="vtp-playback-drawer-toggle"
          onClick={onToggleOpen}
          title={isOpen ? "Collapse playback panel" : "Expand playback panel"}
          aria-label={isOpen ? "Collapse playback panel" : "Expand playback panel"}
        >
          {isOpen ? <FaChevronDown size={12} /> : <FaChevronUp size={12} />}
        </button>
      </div>

      {isOpen ? (
        <div className="vtp-playback-drawer-body">
          {activeTab === "trips" ? (
            playbackTrips.length > 0 ? (
              <div className="vtp-playback-table-shell">
                <table className="vtp-playback-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Reg No</th>
                      <th>IMEI</th>
                      <th>Start Time</th>
                      <th>Start Location</th>
                      <th>End Time</th>
                      <th>End Location</th>
                      <th>Running</th>
                      <th>Distance</th>
                      <th>Avg Speed</th>
                      <th>Max Speed</th>
                      <th>Alerts</th>
                      <th>Driver</th>
                      <th>Movement</th>
                      <th>Ignition</th>
                      <th>GPS Fix</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playbackTrips.map((trip) => (
                      <tr key={trip.id}>
                        <td>{displayValue(trip.objName)}</td>
                        <td>{displayValue(trip.objRegNo)}</td>
                        <td>{displayValue(trip.imeiId)}</td>
                        <td>{trip.startTime}</td>
                        <td>{trip.startLocation}</td>
                        <td>{trip.endTime}</td>
                        <td>{trip.endLocation}</td>
                        <td>{trip.running}</td>
                        <td>{trip.distance} km</td>
                        <td>{trip.avgSpeed}</td>
                        <td>{trip.maxSpeed}</td>
                        <td>{trip.alerts}</td>
                        <td>{trip.driver}</td>
                        <td>{displayValue(trip.movementStatus)}</td>
                        <td>{displayValue(trip.ignitionStatus)}</td>
                        <td>{displayValue(trip.gpsFixStatus)}</td>
                        <td>{trip.tripStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlaybackEmptyState message="Trips will appear here when history rows are available." />
            )
          ) : null}

          {activeTab === "events" ? (
            playbackEventRows.length > 0 ? (
              <div className="vtp-playback-table-shell">
                <table className="vtp-playback-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Reg No</th>
                      <th>IMEI</th>
                      <th>Event</th>
                      <th>Time</th>
                      <th>Speed</th>
                      <th>Movement</th>
                      <th>Ignition</th>
                      <th>GPS Fix</th>
                      <th>Address</th>
                      <th>Driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playbackEventRows.map((row) => (
                      <tr key={row.id}>
                        <td>{displayValue(row.objName)}</td>
                        <td>{displayValue(row.objRegNo)}</td>
                        <td>{displayValue(row.imeiId)}</td>
                        <td>{row.event}</td>
                        <td>{row.time}</td>
                        <td>{Number.isFinite(Number(row.speed)) ? formatPlaybackSpeed(row.speed) : "N/A"}</td>
                        <td>{displayValue(row.movementStatus)}</td>
                        <td>{displayValue(row.ignitionStatus)}</td>
                        <td>{displayValue(row.gpsFixStatus)}</td>
                        <td>{row.address}</td>
                        <td>{row.driver}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlaybackEmptyState message="Events need history rows or backend event fields to render here." />
            )
          ) : null}

          {activeTab === "dataPoints" ? (
            playbackSampleMetrics.length > 0 ? (
              <div className="vtp-playback-table-shell">
                <table className="vtp-playback-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Reg No</th>
                      <th>IMEI</th>
                      <th>Status</th>
                      <th>Movement</th>
                      <th>Ignition</th>
                      <th>GPS Fix</th>
                      <th>Event</th>
                      <th>Time</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Heading</th>
                      <th>Speed</th>
                      <th>Distance</th>
                      <th>Address</th>
                      <th>Driver</th>
                      <th>Battery</th>
                      <th>Fuel</th>
                      <th>Temperature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playbackSampleMetrics.map((sample) => (
                      <tr key={`point-${sample.index}`}>
                        <td>{displayValue(sample.obj_name)}</td>
                        <td>{displayValue(sample.obj_reg_no)}</td>
                        <td>{displayValue(sample.imei_id)}</td>
                        <td>{sample.statusLabel}</td>
                        <td>{displayValue(sample.movement_status)}</td>
                        <td>{displayValue(sample.ignition_status)}</td>
                        <td>{displayValue(sample.gps_fix_status)}</td>
                        <td>{displayValue(sample.rawEventName)}</td>
                        <td>{formatPlaybackStamp(sample.timestamp)}</td>
                        <td>{Number(sample.lat).toFixed(5)}</td>
                        <td>{Number(sample.lng).toFixed(5)}</td>
                        <td>
                          {Number.isFinite(Number(sample.heading))
                            ? `${Math.round(Number(sample.heading))}°`
                            : "N/A"}
                        </td>
                        <td>{formatPlaybackSpeed(sample.derivedSpeed)}</td>
                        <td>{(sample.cumulativeDistanceMeters / 1000).toFixed(2)} km</td>
                        <td>{sample.addressLabel}</td>
                        <td>
                          {sample.driver_name ||
                            selectedVehicle?.driver_name ||
                            selectedVehicle?.driver ||
                            selectedVehicle?.driverName ||
                            "Unassigned"}
                        </td>
                        <td>{sample.batteryVoltage === "N/A" ? "N/A" : `${sample.batteryVoltage} V`}</td>
                        <td>
                          {Number.isFinite(Number(sample.fuel_level))
                            ? `${Number(sample.fuel_level).toFixed(1)}%`
                            : "N/A"}
                        </td>
                        <td>
                          {Number.isFinite(Number(sample.temperature))
                            ? `${Number(sample.temperature).toFixed(1)} C`
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlaybackEmptyState message="Data points will appear here when history rows are available." />
            )
          ) : null}

          {activeTab === "speed" ? (
            hasSpeedHistory ? (
              <div className="vtp-playback-chart-shell">
                <div className="vtp-playback-chart-header">
                  <strong>Speed</strong>
                  <span>km/hr</span>
                </div>
                <svg viewBox="0 0 1040 188" className="vtp-playback-chart">
                  <polyline points={playbackSpeedChart} />
                </svg>
              </div>
            ) : (
              <PlaybackEmptyState message="Speed graph needs playback history rows." />
            )
          ) : null}

          {activeTab === "fuel" ? (
            playbackSettings.fuel && hasFuelHistory ? (
              <div className="vtp-playback-chart-shell">
                <div className="vtp-playback-chart-header">
                  <strong>Fuel</strong>
                  <span>Level %</span>
                </div>
                <svg viewBox="0 0 1040 188" className="vtp-playback-chart is-fuel">
                  <polyline points={playbackFuelChart} />
                </svg>
              </div>
            ) : (
              <PlaybackEmptyState message="Fuel panel needs fuel values in playback history rows." />
            )
          ) : null}

          {activeTab === "temperature" ? (
            hasTemperatureHistory ? (
              <div className="vtp-playback-temperature-shell">
                <aside className="vtp-playback-sensor-list">
                  <strong>Select sensor</strong>
                  {Object.keys(playbackTemperatureSeries).map((sensor) => (
                    <button
                      key={sensor}
                      type="button"
                      className={activeTemperatureSensor === sensor ? "is-active" : ""}
                      onClick={() => onSetActiveTemperatureSensor(sensor)}
                    >
                      {sensor}
                    </button>
                  ))}
                </aside>
                <div className="vtp-playback-chart-shell">
                  <div className="vtp-playback-chart-header">
                    <strong>{activeTemperatureSensor}</strong>
                    <span>Temperature (C)</span>
                  </div>
                  <svg viewBox="0 0 1040 188" className="vtp-playback-chart is-temperature">
                    <polyline points={playbackTemperatureChart} />
                  </svg>
                </div>
              </div>
            ) : (
              <PlaybackEmptyState message="Temperature panel needs temperature values in playback history rows." />
            )
          ) : null}

          {activeTab === "gallery" ? (
            <PlaybackEmptyState message="Image gallery will appear here when camera snapshots are available." />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
