'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Panels.module.css';
import { parseExternalTimestampMs } from '@/lib/externalDateTime';
import { getVehicleStatusKey } from '@/lib/vehicleStatus';
import {
  FaCog,
  FaCamera,
  FaCar,
  FaEdit,
  FaRegDotCircle,
  FaSatellite,
  FaEllipsisV,
  FaFilter,
  FaGripVertical,
  FaLock,
  FaMapMarkerAlt,
  FaPlayCircle,
  FaSearch,
  FaSignal,
  FaSlidersH,
  FaSyncAlt,
  FaTrash,
  FaExpand,
  FaVideo,
  FaThumbsUp,
  FaWifi,
  FaBriefcase,
  FaSortAmountDown,
  FaKey,
  FaBatteryHalf,
  FaMinus,
  FaPlus,
  FaTimes,
  FaTruck,
} from 'react-icons/fa';

const statusCards = [
  { id: 'running', label: 'Running', className: 'running' },
  { id: 'idle', label: 'Idle', className: 'idle' },
  { id: 'inactive', label: 'Inactive', className: 'inactive' },
  { id: 'stopped', label: 'Stopped', className: 'stopped' },
  { id: 'nodata', label: 'No Data', className: 'nodata' },
  { id: 'total', label: 'Total', className: 'total' },
];

const demoLocationRows = [
  'The Indus Logistics',
  'Dawlance (DPL) Parking Area Landhi Karachi',
  'Farhan Petroleum Service - Fuel filling',
  'Near Quetta Lucky Green Hotel, Looni',
  'Pepsico Plant Multan - Parking',
  'Pepsico WH Hyd - Parking',
  'R - Customer Address',
  'Shabbir Tiles Multan WH - Warehouse',
  'Shabbir Tiles Unit 2 Karachi - Parking',
];

const tabs = [
  { id: 'vehical', label: 'Vehical', Icon: FaCar },
  { id: 'driver', label: 'Driver', Icon: FaRegDotCircle },
  { id: 'location', label: 'Location', Icon: FaMapMarkerAlt },
  { id: 'geofence', label: 'Geofence', Icon: FaSatellite },
];

const vehicleEditorTabs = [
  { id: 'general', label: 'General', mode: 'editable' },
  { id: 'profile', label: 'Profile', mode: 'editable' },
  { id: 'sensors', label: 'Sensors', mode: 'static' },
  { id: 'document', label: 'Document', mode: 'static' },
  { id: 'allocate', label: 'Allocate On Floor', mode: 'static' },
];

const objectListColumnGroups = [
  {
    title: 'Sensors',
    checked: true,
    items: [
      { label: 'Ignition', checked: true },
      { label: 'Power', checked: true },
      { label: 'GSM', checked: true },
      { label: 'GPS', checked: true },
      { label: 'External voltage', checked: false },
      { label: 'OBD', checked: false },
      { label: 'SOC', checked: false },
      { label: 'Charging Status', checked: false },
      { label: 'SOH', checked: false },
      { label: 'Battery Temperature', checked: false },
      { label: 'Passenger Seat', checked: false },
      { label: 'Beacon', checked: false },
      { label: 'Taximeter', checked: false },
    ],
  },
  {
    title: 'Address',
    checked: true,
    items: [{ label: 'Address', checked: true }],
  },
  {
    title: 'Object Activity',
    checked: true,
    items: [
      { label: 'Last Updated', checked: true, hasOptions: true },
      { label: 'Mode', checked: true },
      { label: 'Driver', checked: false },
      { label: 'Driver Mobile Number', checked: false },
      { label: 'TimeLine Chart', checked: false },
      { label: 'Number of passenger seat', checked: false },
      { label: 'Reminder', checked: false },
      { label: 'Notes', checked: false },
      { label: 'Reports', checked: false, hasOptions: true },
      { label: 'Object Health', checked: false },
      { label: 'Expiry Date', checked: false },
      { label: 'VIN', checked: false },
    ],
  },
  {
    title: 'Video Telematics',
    checked: true,
    items: [
      { label: 'Live Streaming', checked: true },
      { label: 'Snapshot', checked: true },
      { label: 'Video Playback', checked: true },
      { label: 'Intercom Mic', checked: true },
    ],
  },
];

const initialObjectNameFields = {
  objectNumber: true,
  objectName: false,
};

const initialItemOptions = {
  'Object Activity::Last Updated': { mode: 'datetime' },
  'Object Activity::Reports': { mode: 'basic' },
};
const PANEL_SETTINGS_KEY = 'vtp_panel_settings_v2';
const REVERSE_GEOCODE_CACHE_KEY = 'vtp_reverse_geocode_cache_v2';
const REVERSE_GEOCODE_BATCH_SIZE = 1;
const REVERSE_GEOCODE_REQUEST_DELAY_MS = 900;
const REVERSE_GEOCODE_CACHE_LIMIT = 400;
const COMPANY_ROW_HEIGHT = 30;
const VEHICLE_ROW_HEIGHT = 34;
const VEHICLE_LIST_OVERSCAN = 12;
export const PANEL_VEHICLE_FOCUS_EVENT = 'vtp:focus-vehicle';
export const PANEL_MOBILE_STATUS_FILTER_EVENT = 'vtp:mobile-status-filter';
const PANEL_STATUS_DEBUG = String(process.env.NEXT_PUBLIC_VTP_STATUS_DEBUG || '') === '1';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildCoordinateKey = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
};

const createVehicleEditorDraft = () => ({
  vehicleNo: '',
  imei: '',
  vehicleType: '',
  organizationId: '',
  branchId: '',
  vehicleGroupId: '',
  status: 'Active',
});

const extractReferenceId = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value?._id != null) return String(value._id);
    if (value?.id != null) return String(value.id);
    return '';
  }
  return String(value);
};

const normalizeMatchText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const matchSelectOptionByLabel = (options, label) => {
  const normalizedLabel = normalizeMatchText(label);
  if (!normalizedLabel) return null;
  return (options || []).find((option) => normalizeMatchText(option?.label) === normalizedLabel) || null;
};

const filterEditorOptions = (options, dependencies = {}) => {
  const entries = Object.entries(dependencies).filter(([, value]) => String(value || '').trim());
  if (!entries.length) return options || [];
  return (options || []).filter((option) =>
    entries.every(([key, value]) => String(option?.[key] || '') === String(value))
  );
};

const fetchJson = async (url, init) => {
  const response = await fetch(url, { cache: 'no-store', ...(init || {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed for ${url}`);
  }
  return payload;
};

const COORDINATE_LABEL_PATTERN =
  /^loc\s+at\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/i;

const parseCoordinateLabel = (value) => {
  const match = String(value || '').trim().match(COORDINATE_LABEL_PATTERN);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
};

const mergeReverseGeocodeCache = (previousCache, nextEntries) => {
  const merged = { ...(previousCache || {}) };
  Object.entries(nextEntries || {}).forEach(([key, value]) => {
    if (!key || !value) return;
    merged[key] = value;
  });

  const entries = Object.entries(merged);
  if (entries.length <= REVERSE_GEOCODE_CACHE_LIMIT) return merged;

  return Object.fromEntries(entries.slice(entries.length - REVERSE_GEOCODE_CACHE_LIMIT));
};

const isPlaceholderDisplayValue = (value) => {
  const normalized = String(value).trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === '-' ||
    normalized === '--' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'null' ||
    normalized === 'undefined'
  );
};

const readDisplayString = (row, keys, fallback = '', options = {}) => {
  const { ignorePlaceholders = false } = options;
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null) {
      const normalized = String(value).trim();
      if (normalized === '') continue;
      if (ignorePlaceholders && isPlaceholderDisplayValue(normalized)) continue;
      return normalized;
    }
  }
  return fallback;
};

const readDisplayNumber = (row, keys, fallback = null) => {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const isTruthySensorValue = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['y', 'yes', '1', 'true', 'on', 'fix', 'fixed', 'connected'].includes(normalized);
};

const isIgnitionOn = (row) => {
  return isTruthySensorValue(
    readDisplayString(row, ['ignition_status', 'ignitionStatus', 'acc', 'acc_status'], '')
  );
};

const buildSensorState = (state, label) => ({
  state,
  title: `${label} ${state === 'on' ? 'On' : state === 'weak' ? 'Weak' : 'Off'}`,
});

const getPowerState = (row, voltage) => {
  if (
    isTruthySensorValue(
      readDisplayString(row, ['external_power', 'externalPower', 'power_status', 'powerStatus'], '')
    )
  ) {
    return buildSensorState('on', 'Power');
  }
  const numericVoltage = Number(voltage);
  return buildSensorState(Number.isFinite(numericVoltage) && numericVoltage > 0 ? 'on' : 'off', 'Power');
};

const getGsmState = (row) => {
  const gsmSignal = readDisplayNumber(
    row,
    ['gsm_signal', 'gsmSignal', 'gsm_signal_level', 'signal_strength', 'signalStrength', 'network_rank'],
    null
  );
  if (Number.isFinite(gsmSignal)) {
    if (gsmSignal <= 0) return buildSensorState('off', 'GSM');
    if (gsmSignal <= 5) {
      return buildSensorState(gsmSignal <= 2 ? 'weak' : 'on', 'GSM');
    }
    return buildSensorState(gsmSignal < 60 ? 'weak' : 'on', 'GSM');
  }
  return buildSensorState(
    isTruthySensorValue(readDisplayString(row, ['gsm_status', 'gsmStatus', 'network_status', 'networkStatus'], ''))
      ? 'on'
      : 'off',
    'GSM'
  );
};

const getGpsState = (row) => {
  const gpsFix = readDisplayString(row, ['gps_fix_status', 'gpsFixStatus', 'gps_status', 'gpsStatus'], '');
  if (gpsFix) {
    const normalized = gpsFix.trim().toLowerCase();
    if (['nofix', 'no fix', 'invalid', 'lost', 'n', 'no', 'off'].includes(normalized)) {
      return buildSensorState('off', 'GPS');
    }
    if (['fix', 'fixed', '3d', '2d', 'a', 'valid', 'y', 'yes', 'on'].includes(normalized)) {
      const satellites = readDisplayNumber(row, ['satellite_count', 'satellites', 'gps_satellites'], null);
      const hdop = readDisplayNumber(row, ['hdop'], null);
      if ((Number.isFinite(satellites) && satellites > 0 && satellites < 4) || (Number.isFinite(hdop) && hdop > 5)) {
        return buildSensorState('weak', 'GPS');
      }
      return buildSensorState('on', 'GPS');
    }
  }
  return buildSensorState(
    isTruthySensorValue(readDisplayString(row, ['gnss_state', 'gnssState'], '')) ? 'on' : 'off',
    'GPS'
  );
};

const haveSameObjectShapeAndValues = (left, right) => {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const haveSameSetValues = (left, right) => {
  if (left === right) return true;
  if (!left || !right || left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const readVehicleTimestampMs = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null || value === '') continue;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;

    const parsedValue = parseExternalTimestampMs(value);
    if (Number.isFinite(parsedValue) && parsedValue > 0) return parsedValue;
  }

  return 0;
};

const readVehicleDirectPacketTimestampMs = (row) => {
  return readVehicleTimestampMs(row, [
    'sourceTimestamp',
    'lastPacketTime',
    'last_packet_time',
    'last_packet',
    'lastPacket',
    'packetTime',
    'packet_time',
    'device_datetime',
    'deviceDateTime',
    'device_time',
    'deviceTime',
    'gps_time',
    'gpsTime',
    'gpstime',
    'server_datetime',
    'serverDateTime',
    'server_time',
    'serverTime',
    'servertime',
    'timestamp',
    'updatedAt',
    'updated_at',
  ]);
};

const formatPakistanDateTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
};

const formatVehiclePacketTimeLabel = (row) => {
  const timestamp = readVehicleDirectPacketTimestampMs(row);
  if (!timestamp) return '';
  return formatPakistanDateTime(timestamp);
};

const formatVehiclePacketTimeExact = (row) => formatVehiclePacketTimeLabel(row);

const buildVehicleLocationState = (row) => {
  const primary = readDisplayString(row, [
    'location_name',
    'address',
    'address_text',
    'address_desc',
    'location',
    'location_desc',
    'last_address',
    'display_address',
  ], '', { ignorePlaceholders: true });
  if (primary) {
    const parsedCoordinates = parseCoordinateLabel(primary);
    if (parsedCoordinates) {
      return {
        text: `Loc at ${parsedCoordinates.latitude.toFixed(5)}, ${parsedCoordinates.longitude.toFixed(5)}`,
        source: 'coordinates',
        coordinateKey: buildCoordinateKey(parsedCoordinates.latitude, parsedCoordinates.longitude),
      };
    }
    return { text: primary, source: 'address' };
  }

  const landmarkDistance = readDisplayString(row, [
    'distance_label',
    'distance',
    'distance_from_landmark',
    'distance_from_reference',
  ], '', { ignorePlaceholders: true });
  if (landmarkDistance) return { text: landmarkDistance, source: 'distance' };

  const latitude = readDisplayNumber(row, ['latitude', 'lat']);
  const longitude = readDisplayNumber(row, ['longitude', 'lng', 'lon']);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      text: `Loc at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      source: 'coordinates',
      coordinateKey: buildCoordinateKey(latitude, longitude),
    };
  }

  return { text: 'Location unavailable', source: 'unavailable', coordinateKey: '' };
};

const buildVehicleMetaLine = () => {
  return '';
};

const getHealthLabel = (row, sensorStates = {}) => {
  const powerConnected = sensorStates.powerState?.state === 'on' || sensorStates.powerState?.state === 'weak';
  const gpsConnected = sensorStates.gpsState?.state === 'on' || sensorStates.gpsState?.state === 'weak';
  const gsmConnected = sensorStates.gsmState?.state === 'on' || sensorStates.gsmState?.state === 'weak';
  if (powerConnected && gpsConnected && gsmConnected) return 'Good';
  if (powerConnected || gpsConnected || gsmConnected) return 'Fair';
  return readDisplayString(row, ['object_health', 'health_status', 'health'], 'Poor');
};

const buildExtraFieldValue = (value, fallback = '--') => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const normalizeVehicleRow = (row) => {
  if (row?.companyKey && row?.companyLabel && row?.status) {
    return row;
  }

  const normalizeComparableText = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[,\u2022|]+/g, " ");

  const id =
    readDisplayString(row, ['vehicle_no', 'obj_reg_no', 'vehicle_name', 'obj_name', 'imei_id']) ||
    `vehicle-${readDisplayNumber(row, ['latitude', 'lat'], 0)}-${readDisplayNumber(row, ['longitude', 'lng', 'lon'], 0)}`;
  const speed = readDisplayNumber(row, ['speed', 'speed_kmh'], 0);
  const voltage = readDisplayString(row, ['external_voltage', 'voltage', 'battery_voltage', 'battery']);
  const companyLabel =
    readDisplayString(row, ['organizations', 'company', 'branch', 'group1', 'group']) || 'Other Vehicles';
  const companyKey = companyLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const locationState = buildVehicleLocationState(row);
  const address = locationState.text;
  let distance = buildVehicleMetaLine(row);
  const displayTimestamp = formatVehiclePacketTimeLabel(row);
  const serverDatetime = readDisplayString(row, ['server_datetime', 'serverDateTime']);
  const deviceDatetime = readDisplayString(row, ['device_datetime', 'deviceDateTime']);
  const ignitionOn = isIgnitionOn(row);
  const powerState = getPowerState(row, voltage);
  const gsmState = getGsmState(row);
  const gpsState = getGpsState(row);
  const sensorStates = { powerState, gsmState, gpsState };

  if (
    address &&
    distance &&
    normalizeComparableText(address) === normalizeComparableText(distance)
  ) {
    distance = "";
  }

  return {
    raw: row,
    id,
    reactKey: String(
      readDisplayString(row, ["imei_id", "imei", "device_id", "deviceId", "id"]) ||
        `${companyKey}|${id}|${readDisplayNumber(row, ["latitude", "lat"], 0)}|${readDisplayNumber(
          row,
          ["longitude", "lng", "lon"],
          0
        )}`
    ),
    time: displayTimestamp,
    timeExact: formatVehiclePacketTimeExact(row),
    displayTimestamp,
    serverDatetime,
    deviceDatetime,
    address,
    distance,
    speed: String(Number.isFinite(speed) ? Math.round(speed) : 0),
    voltage: voltage || '--',
    ignitionOn,
    powerState,
    gsmState,
    gpsState,
    driverName: readDisplayString(row, ['driver_name', 'driver', 'driverName'], '--'),
    driverMobile: readDisplayString(row, ['driver_mobile', 'driver_mobile_no', 'driverMobile', 'mobile'], '--'),
    objectModel: readDisplayString(row, ['model', 'object_model', 'objectModel'], '--'),
    simNumber: readDisplayString(row, ['sim_no', 'sim_number', 'simNumber'], '--'),
    obd: readDisplayString(row, ['obd', 'obd_status', 'obdStatus'], '--'),
    soc: readDisplayString(row, ['soc', 'battery_soc'], '--'),
    chargingStatus: readDisplayString(row, ['charging_status', 'chargingStatus'], '--'),
    soh: readDisplayString(row, ['soh', 'battery_soh'], '--'),
    batteryTemperature: readDisplayString(row, ['battery_temperature', 'battery_temp', 'batteryTemperature'], '--'),
    passengerSeat: readDisplayString(row, ['passenger_seat', 'passengerSeat', 'passenger_seats'], '--'),
    beacon: readDisplayString(row, ['beacon', 'beacon_status', 'beaconStatus'], '--'),
    taximeter: readDisplayString(row, ['taximeter', 'taximeter_status', 'taximeterStatus'], '--'),
    timeline: readDisplayString(row, ['timeline', 'timeline_chart', 'timeLineChart'], '--'),
    reminder: readDisplayString(row, ['reminder', 'reminders'], '--'),
    notes: readDisplayString(row, ['notes', 'note'], '--'),
    reports: readDisplayString(row, ['reports', 'report_mode', 'reportMode'], '--'),
    objectHealth: getHealthLabel(row, sensorStates),
    expiryDate: readDisplayString(row, ['expiry_date', 'expiryDate', 'registration_expiry'], '--'),
    vin: readDisplayString(row, ['vin', 'chassis_no', 'chassis'], '--'),
    status: getVehicleStatusKey(row),
    statusLabel: getVehicleStatusKey(row),
    server_datetime: serverDatetime,
    companyKey,
    companyLabel,
    objectName: readDisplayString(row, ['obj_name', 'vehicle_name', 'name']),
    latitude: readDisplayNumber(row, ['latitude', 'lat']),
    longitude: readDisplayNumber(row, ['longitude', 'lng', 'lon']),
    addressSource: locationState.source,
    coordinateKey: locationState.coordinateKey || '',
    searchText: `${id} ${readDisplayString(row, ['obj_name', 'vehicle_name', 'name']) || ''} ${address} ${distance} ${voltage || '--'}`.toLowerCase(),
  };
};

const matchMasterVehicleRecord = (row, records) => {
  const vehicleKeys = new Set(
    [
      row?.id,
      row?.raw?.vehicle_no,
      row?.raw?.obj_reg_no,
      row?.raw?.vehicleNo,
      row?.objectName,
      row?.raw?.obj_name,
    ]
      .map((value) => normalizeMatchText(value))
      .filter(Boolean)
  );

  const imeiKeys = new Set(
    [row?.raw?.imei_id, row?.raw?.imei, row?.raw?.imeiId]
      .map((value) => normalizeMatchText(value))
      .filter(Boolean)
  );

  return (
    (records || []).find((record) => {
      const recordVehicleNo = normalizeMatchText(record?.vehicleNo);
      const recordImei = normalizeMatchText(record?.imei);
      return (
        (recordVehicleNo && vehicleKeys.has(recordVehicleNo)) ||
        (recordImei && imeiKeys.has(recordImei))
      );
    }) || null
  );
};

const buildVehicleEditorDraft = (row, record, optionSets) => {
  const organizationOption =
    matchSelectOptionByLabel(optionSets?.organizations, row?.raw?.organizations || row?.raw?.organization || row?.companyLabel) || null;
  const branchOption =
    matchSelectOptionByLabel(optionSets?.branches, row?.raw?.branch) || null;
  const vehicleGroupOption =
    matchSelectOptionByLabel(optionSets?.vehicleGroups, row?.raw?.group1 || row?.raw?.group) || null;

  return {
    vehicleNo:
      String(
        record?.vehicleNo ||
          row?.raw?.vehicle_no ||
          row?.raw?.obj_reg_no ||
          row?.id ||
          ''
      ).trim(),
    imei: String(record?.imei || row?.raw?.imei_id || row?.raw?.imei || '').trim(),
    vehicleType: String(record?.vehicleType || row?.raw?.vehicle_type || row?.raw?.vehicleType || '').trim(),
    organizationId:
      extractReferenceId(record?.organizationId) || extractReferenceId(organizationOption?.value),
    branchId: extractReferenceId(record?.branchId) || extractReferenceId(branchOption?.value),
    vehicleGroupId:
      extractReferenceId(record?.vehicleGroupId) || extractReferenceId(vehicleGroupOption?.value),
    status: String(record?.status || 'Active') === 'Inactive' ? 'Inactive' : 'Active',
  };
};

const tracePanelVehicle = (row) => {
  if (!PANEL_STATUS_DEBUG) return;
  console.debug('[Panels] vehicle row', {
    vehicle: row?.id || row?.reactKey || row?.objectName || 'unknown-vehicle',
    rawSourceTimestamp: row?.raw?.sourceTimestamp || null,
    rawLastPacketTime: row?.raw?.lastPacketTime || row?.raw?.last_packet_time || null,
    rawStatusChangedAt: row?.raw?.statusChangedAt || null,
    rawDeviceDatetime: row?.raw?.device_datetime || row?.raw?.deviceDateTime || null,
    rawServerDatetime: row?.raw?.server_datetime || row?.raw?.serverDateTime || null,
    normalizedDisplayTimestamp: row?.displayTimestamp || null,
    normalizedDeviceDatetime: row?.deviceDatetime || null,
    normalizedServerDatetime: row?.serverDatetime || null,
  });
};

const getVehicleRowReactKey = (row, index = 0) => {
  if (!row) return `vehicle-row-${index}`;
  const base = String(row.reactKey || row.id || `row-${index}`);
  // Guard against duplicates even when upstream data repeats the same vehicle_no.
  return index ? `${base}#${index}` : base;
};

const stopPanelTouchPropagation = (event) => {
  event.stopPropagation();
};

const stopPanelMousePropagation = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const handlePanelStatusInteraction = (event, nextFilter, setActiveStatusFilter) => {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }
  setActiveStatusFilter(nextFilter);
};

const Panels = ({
  isSettingsOpen: controlledSettingsOpen,
  onSettingsToggle,
  onPanelWidthChange,
  vehicles,
  isVehiclesLoading = false,
  isVehiclesRefreshing = false,
  vehiclesError = null,
  onRefreshVehicles,
  onStatusFilterChange = null,
  isUsingFallbackSnapshot = false,
}) => {
  const [activeTab, setActiveTab] = useState('vehical');
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [objectNameFields, setObjectNameFields] = useState(initialObjectNameFields);
  const [columnGroups, setColumnGroups] = useState(objectListColumnGroups);
  const [itemOptions, setItemOptions] = useState(initialItemOptions);
  const [searchTerm, setSearchTerm] = useState('');
  const [settingsSearchTerm, setSettingsSearchTerm] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('total');
  const [sortAscending, setSortAscending] = useState(true);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(new Set());
  const [companySelection, setCompanySelection] = useState({});
  const [collapsedCompanies, setCollapsedCompanies] = useState({});
  const [panelNotice, setPanelNotice] = useState('');
  const [resolvedAddresses, setResolvedAddresses] = useState({});
  const [geofenceRows, setGeofenceRows] = useState([]);
  const [isGeofenceRowsLoading, setIsGeofenceRowsLoading] = useState(false);
  const [geofenceRowsError, setGeofenceRowsError] = useState('');
  const [hasFetchedGeofenceRows, setHasFetchedGeofenceRows] = useState(false);
  const [isVehicleEditorOpen, setIsVehicleEditorOpen] = useState(false);
  const [vehicleEditorLoading, setVehicleEditorLoading] = useState(false);
  const [vehicleEditorSaving, setVehicleEditorSaving] = useState(false);
  const [vehicleEditorError, setVehicleEditorError] = useState('');
  const [vehicleEditorMessage, setVehicleEditorMessage] = useState('');
  const [vehicleEditorTab, setVehicleEditorTab] = useState('general');
  const [vehicleEditorTargetRow, setVehicleEditorTargetRow] = useState(null);
  const [vehicleEditorRecordId, setVehicleEditorRecordId] = useState('');
  const [vehicleEditorDraft, setVehicleEditorDraft] = useState(createVehicleEditorDraft);
  const [vehicleEditorFieldErrors, setVehicleEditorFieldErrors] = useState({});
  const [vehicleEditorOptionSets, setVehicleEditorOptionSets] = useState({
    organizations: [],
    branches: [],
    vehicleGroups: [],
  });
  const searchInputRef = useRef(null);
  const tableWrapRef = useRef(null);
  const reverseGeocodeLoadedRef = useRef(false);
  const reverseGeocodeInFlightRef = useRef(new Set());
  const vehicleEditorOptionsRef = useRef(null);
  const vehicleEditorRequestRef = useRef(0);
  const [vehicleScrollTop, setVehicleScrollTop] = useState(0);
  const [vehicleViewportHeight, setVehicleViewportHeight] = useState(420);

  const hasVehicleSource = Array.isArray(vehicles);
  const baseVehicleRows = useMemo(
    () =>
      (hasVehicleSource ? vehicles : []).map((row, index) => {
        const normalized = normalizeVehicleRow(row);
        if (PANEL_STATUS_DEBUG && index === 0) {
          tracePanelVehicle(normalized);
        }
        return normalized;
      }),
    [hasVehicleSource, vehicles]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || reverseGeocodeLoadedRef.current) return;
    reverseGeocodeLoadedRef.current = true;

    try {
      const raw = window.localStorage.getItem(REVERSE_GEOCODE_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      setResolvedAddresses(parsed);
    } catch {
      // Ignore invalid client cache.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !reverseGeocodeLoadedRef.current) return;
    try {
      window.localStorage.setItem(REVERSE_GEOCODE_CACHE_KEY, JSON.stringify(resolvedAddresses));
    } catch {
      // Ignore cache write failures.
    }
  }, [resolvedAddresses]);

  useEffect(() => {
    if (activeTab !== 'geofence') return undefined;
    if (hasFetchedGeofenceRows || isGeofenceRowsLoading) return undefined;

    let cancelled = false;

    const loadGeofences = async () => {
      setIsGeofenceRowsLoading(true);
      setGeofenceRowsError('');

      try {
        const response = await fetch('/api/geofences', { cache: 'no-store' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load geofences.');
        }

        const payload = await response.json();
        if (cancelled) return;

        setGeofenceRows(Array.isArray(payload) ? payload : []);
        setHasFetchedGeofenceRows(true);
      } catch (error) {
        if (cancelled) return;
        setGeofenceRowsError(error?.message || 'Failed to load geofences.');
      } finally {
        if (!cancelled) {
          setIsGeofenceRowsLoading(false);
        }
      }
    };

    loadGeofences();

    return () => {
      cancelled = true;
    };
  }, [activeTab, hasFetchedGeofenceRows, isGeofenceRowsLoading]);

  const vehicleRows = useMemo(
    () =>
      baseVehicleRows.map((row) => {
        if (row.addressSource !== 'coordinates' || !row.coordinateKey) return row;

        const resolvedAddress = resolvedAddresses[row.coordinateKey];
        if (!resolvedAddress) return row;

        const distance = row.distance && row.distance !== row.address ? row.distance : '';
        return {
          ...row,
          address: resolvedAddress,
          addressSource: 'reverse-geocode',
          searchText: `${row.id} ${row.objectName || ''} ${resolvedAddress} ${distance} ${row.voltage || '--'}`.toLowerCase(),
        };
      }),
    [baseVehicleRows, resolvedAddresses]
  );

  const driverRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const rows = vehicleRows
      .map((row) => {
        const directDriverName = readDisplayString(row.raw, ['driver_name'], '', {
          ignorePlaceholders: true,
        });
        const firstDriverName = readDisplayString(row.raw, ['driver_first_name'], '', {
          ignorePlaceholders: true,
        });
        const lastDriverName = readDisplayString(row.raw, ['driver_last_name'], '', {
          ignorePlaceholders: true,
        });
        const driverName =
          directDriverName ||
          [firstDriverName, lastDriverName].filter(Boolean).join(' ').trim();

        if (!driverName) return null;

        const driverMobile = readDisplayString(
          row.raw,
          ['driver_mobile', 'mobile_no', 'mobile'],
          '--',
          { ignorePlaceholders: true }
        );

        return {
          key: `${driverName}|${row.id}`,
          name: driverName,
          id: row.id,
          status: 'Allocated',
          role: driverMobile || '--',
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

    if (!normalizedSearch) return rows;

    return rows.filter((row) =>
      `${row.name} ${row.id} ${row.status} ${row.role}`.toLowerCase().includes(normalizedSearch)
    );
  }, [searchTerm, vehicleRows]);

  const companyRows = useMemo(
    () =>
      vehicleRows.reduce((acc, row) => {
        if (!acc[row.companyKey]) {
          acc[row.companyKey] = {
            label: row.companyLabel,
            rows: [],
          };
        }
        acc[row.companyKey].rows.push(row);
        return acc;
      }, {}),
    [vehicleRows]
  );

  const companyEntries = useMemo(
    () =>
      Object.entries(companyRows).sort(([, a], [, b]) => {
        if (b.rows.length !== a.rows.length) return b.rows.length - a.rows.length;
        return a.label.localeCompare(b.label);
      }),
    [companyRows]
  );

  const liveLocationRows = useMemo(() => {
    const uniqueLocations = new Map();

    vehicleRows.forEach((row) => {
      const locationName = String(row.address || '').trim();
      if (!locationName) return;

      const existing = uniqueLocations.get(locationName);
      if (existing) {
        existing.count += 1;
        existing.vehicles.push(row.id);
        if (row.companyLabel && !existing.companies.includes(row.companyLabel)) {
          existing.companies.push(row.companyLabel);
        }
        return;
      }

      uniqueLocations.set(locationName, {
        name: locationName,
        count: 1,
        vehicles: [row.id],
        companies: row.companyLabel ? [row.companyLabel] : [],
      });
    });

    return Array.from(uniqueLocations.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [vehicleRows]);

  const statusCounts = useMemo(() => {
    const counts = {
      running: 0,
      idle: 0,
      inactive: 0,
      stopped: 0,
      nodata: 0,
      total: vehicleRows.length,
    };
    vehicleRows.forEach((row) => {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    return counts;
  }, [vehicleRows]);

  const isSettingsOpen = typeof controlledSettingsOpen === 'boolean' ? controlledSettingsOpen : internalSettingsOpen;

  const isItemChecked = (groupTitle, itemLabel) =>
    !!columnGroups
      .find((group) => group.title === groupTitle)
      ?.items.find((item) => item.label === itemLabel)?.checked;

  const showObjectNumber = objectNameFields.objectNumber;
  const showObjectName = objectNameFields.objectName;
  const showMode = isItemChecked('Object Activity', 'Mode');
  const showLastUpdated = isItemChecked('Object Activity', 'Last Updated');
  const lastUpdatedMode = itemOptions['Object Activity::Last Updated']?.mode || 'datetime';
  const addressSelection = isItemChecked('Address', 'Address');
  const showAddress = addressSelection;
  const showIgnition = isItemChecked('Sensors', 'Ignition');
  const showPower = isItemChecked('Sensors', 'Power');
  const showGsm = isItemChecked('Sensors', 'GSM');
  const showGps = isItemChecked('Sensors', 'GPS');
  const showExternalVoltage = isItemChecked('Sensors', 'External voltage');
  const showObd = isItemChecked('Sensors', 'OBD');
  const showSoc = isItemChecked('Sensors', 'SOC');
  const showChargingStatus = isItemChecked('Sensors', 'Charging Status');
  const showSoh = isItemChecked('Sensors', 'SOH');
  const showBatteryTemperature = isItemChecked('Sensors', 'Battery Temperature');
  const showPassengerSeat = isItemChecked('Sensors', 'Passenger Seat');
  const showBeacon = isItemChecked('Sensors', 'Beacon');
  const showTaximeter = isItemChecked('Sensors', 'Taximeter');
  const showDriver = isItemChecked('Object Activity', 'Driver');
  const showDriverMobile = isItemChecked('Object Activity', 'Driver Mobile Number');
  const showTimelineChart = isItemChecked('Object Activity', 'TimeLine Chart');
  const showPassengerSeatCount = isItemChecked('Object Activity', 'Number of passenger seat');
  const showReminder = isItemChecked('Object Activity', 'Reminder');
  const showNotes = isItemChecked('Object Activity', 'Notes');
  const showReports = isItemChecked('Object Activity', 'Reports');
  const reportMode = itemOptions['Object Activity::Reports']?.mode || 'basic';
  const showObjectHealth = isItemChecked('Object Activity', 'Object Health');
  const showExpiryDate = isItemChecked('Object Activity', 'Expiry Date');
  const showVin = isItemChecked('Object Activity', 'VIN');
  const showLiveStreaming = isItemChecked('Video Telematics', 'Live Streaming');
  const showSnapshot = isItemChecked('Video Telematics', 'Snapshot');
  const showVideoPlayback = isItemChecked('Video Telematics', 'Video Playback');
  const showIntercomMic = isItemChecked('Video Telematics', 'Intercom Mic');

  const extraVehicleColumns = useMemo(
    () =>
      [
        showObd ? { key: 'obd', label: 'OBD', width: 56, value: (row) => buildExtraFieldValue(row.obd) } : null,
        showSoc ? { key: 'soc', label: 'SOC', width: 56, value: (row) => buildExtraFieldValue(row.soc) } : null,
        showChargingStatus
          ? { key: 'chargingStatus', label: 'Charge', width: 72, value: (row) => buildExtraFieldValue(row.chargingStatus) }
          : null,
        showSoh ? { key: 'soh', label: 'SOH', width: 56, value: (row) => buildExtraFieldValue(row.soh) } : null,
        showBatteryTemperature
          ? { key: 'batteryTemperature', label: 'Temp', width: 68, value: (row) => buildExtraFieldValue(row.batteryTemperature) }
          : null,
        showPassengerSeat
          ? { key: 'passengerSeat', label: 'Seat', width: 60, value: (row) => buildExtraFieldValue(row.passengerSeat) }
          : null,
        showBeacon ? { key: 'beacon', label: 'Beacon', width: 70, value: (row) => buildExtraFieldValue(row.beacon) } : null,
        showTaximeter
          ? { key: 'taximeter', label: 'Taxi', width: 66, value: (row) => buildExtraFieldValue(row.taximeter) }
          : null,
        showDriver ? { key: 'driver', label: 'Driver', width: 110, value: (row) => buildExtraFieldValue(row.driverName) } : null,
        showDriverMobile
          ? { key: 'driverMobile', label: 'Mobile', width: 108, value: (row) => buildExtraFieldValue(row.driverMobile) }
          : null,
        showTimelineChart
          ? { key: 'timeline', label: 'Timeline', width: 76, value: (row) => buildExtraFieldValue(row.timeline) }
          : null,
        showPassengerSeatCount
          ? { key: 'passengerSeatCount', label: 'Passengers', width: 86, value: (row) => buildExtraFieldValue(row.passengerSeat) }
          : null,
        showReminder
          ? { key: 'reminder', label: 'Reminder', width: 86, value: (row) => buildExtraFieldValue(row.reminder) }
          : null,
        showNotes ? { key: 'notes', label: 'Notes', width: 94, value: (row) => buildExtraFieldValue(row.notes) } : null,
        showReports
          ? {
              key: 'reports',
              label: 'Reports',
              width: reportMode === 'advanced' ? 84 : 74,
              value: (row) => buildExtraFieldValue(row.reports !== '--' ? row.reports : reportMode === 'advanced' ? 'Advanced' : 'Basic'),
            }
          : null,
        showObjectHealth
          ? { key: 'objectHealth', label: 'Health', width: 78, value: (row) => buildExtraFieldValue(row.objectHealth) }
          : null,
        showExpiryDate
          ? { key: 'expiryDate', label: 'Expiry', width: 92, value: (row) => buildExtraFieldValue(row.expiryDate) }
          : null,
        showVin ? { key: 'vin', label: 'VIN', width: 116, value: (row) => buildExtraFieldValue(row.vin) } : null,
      ].filter(Boolean),
    [
      reportMode,
      showBatteryTemperature,
      showBeacon,
      showChargingStatus,
      showDriver,
      showDriverMobile,
      showExpiryDate,
      showNotes,
      showObjectHealth,
      showObd,
      showPassengerSeat,
      showPassengerSeatCount,
      showReminder,
      showReports,
      showSoc,
      showSoh,
      showTaximeter,
      showTimelineChart,
      showVin,
    ]
  );

  const rightActionCount = [
    showLiveStreaming,
    showSnapshot,
    showVideoPlayback,
    showIntercomMic,
  ].filter(Boolean).length;
  const rightActionWidth =
    rightActionCount > 0 ? rightActionCount * 16 + Math.max(0, rightActionCount - 1) * 6 : 0;

  const vehicleGridTemplate = [
    '16px',
    '10px',
    showObjectNumber || showObjectName || showLastUpdated ? '150px' : null,
    showMode ? '26px' : null,
    showIgnition ? '18px' : null,
    showPower ? '18px' : null,
    showGsm ? '18px' : null,
    showGps ? '18px' : null,
    showExternalVoltage ? '50px' : null,
    ...extraVehicleColumns.map((column) => `${column.width}px`),
    showAddress ? 'minmax(170px, 1fr)' : null,
    '18px',
    rightActionWidth > 0 ? `${rightActionWidth}px` : null,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    const companyKeys = companyEntries.map(([key]) => key);
    setCompanySelection((prev) => {
      const next = {};
      companyKeys.forEach((key) => {
        next[key] = prev[key] ?? true;
      });
      return haveSameObjectShapeAndValues(prev, next) ? prev : next;
    });
    setCollapsedCompanies((prev) => {
      const next = {};
      companyKeys.forEach((key) => {
        next[key] = prev[key] ?? false;
      });
      return haveSameObjectShapeAndValues(prev, next) ? prev : next;
    });
  }, [companyEntries]);

  useEffect(() => {
    const ids = vehicleRows.map((row) => row.id);
    setSelectedVehicleIds((prev) => {
      const next = new Set();
      const hadSelection = prev.size > 0;
      ids.forEach((id) => {
        if (!hadSelection || prev.has(id)) next.add(id);
      });
      return haveSameSetValues(prev, next) ? prev : next;
    });
  }, [vehicleRows]);

  useEffect(() => {
    if (!onPanelWidthChange) return;

    const getTargetWidth = () => {
      const columns = [
        16, // row checkbox
        10, // status dot
        showObjectNumber || showObjectName || showLastUpdated ? (showObjectName ? 190 : 160) : 0,
        showMode ? 30 : 0,
        showIgnition ? 18 : 0,
        showPower ? 18 : 0,
        showGsm ? 18 : 0,
        showGps ? 18 : 0,
        showExternalVoltage ? 64 : 0,
        ...extraVehicleColumns.map((column) => column.width),
        showAddress ? 240 : 0,
        18, // like icon
        rightActionWidth > 0 ? rightActionWidth : 0, // video telematics icons
      ].filter((value) => value > 0);

      const columnsWidth = columns.reduce((sum, value) => sum + value, 0);
      const gapWidth = Math.max(0, columns.length - 1) * 6;
      const rowPadding = 12;
      const framePadding = 24;
      const calculatedWidth = columnsWidth + gapWidth + rowPadding + framePadding;

      const viewportWidth =
        typeof window !== 'undefined' ? window.innerWidth : 1600;
      const rightSettingsOffset = isSettingsOpen ? 218 : 0;
      const availableWidth = Math.max(520, viewportWidth - 70 - rightSettingsOffset - 60);
      const maxWidth = Math.min(700, availableWidth);
      return clamp(calculatedWidth, 520, maxWidth);
    };

    const applyWidth = () => {
      onPanelWidthChange(getTargetWidth());
    };

    applyWidth();
    window.addEventListener('resize', applyWidth);
    return () => window.removeEventListener('resize', applyWidth);
  }, [
    onPanelWidthChange,
    isSettingsOpen,
    showObjectNumber,
    showObjectName,
    showLastUpdated,
    showMode,
    showIgnition,
    showPower,
    showGsm,
    showGps,
    showExternalVoltage,
    extraVehicleColumns,
    showAddress,
    rightActionWidth,
  ]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    setSettingsSearchTerm('');
  }, [isSettingsOpen]);

  useEffect(() => {
    const node = tableWrapRef.current;
    if (!node) return undefined;

    const syncViewportHeight = () => {
      setVehicleViewportHeight(node.clientHeight || 420);
    };

    syncViewportHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncViewportHeight);
      return () => window.removeEventListener('resize', syncViewportHeight);
    }

    const observer = new ResizeObserver(syncViewportHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeTab, isSettingsOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.objectNameFields) setObjectNameFields(parsed.objectNameFields);
      if (Array.isArray(parsed?.columnGroups)) setColumnGroups(parsed.columnGroups);
      if (parsed?.itemOptions) setItemOptions(parsed.itemOptions);
    } catch {
      // ignore broken saved state
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PANEL_SETTINGS_KEY,
        JSON.stringify({
          objectNameFields,
          columnGroups,
          itemOptions,
        })
      );
    } catch {
      // ignore storage write issues
    }
  }, [objectNameFields, columnGroups, itemOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const nextFilter = activeTab === 'vehical' ? activeStatusFilter : 'total';
    if (typeof onStatusFilterChange === 'function') {
      onStatusFilterChange(nextFilter);
    }
    window.dispatchEvent(
      new CustomEvent(PANEL_MOBILE_STATUS_FILTER_EVENT, {
        detail: { filter: nextFilter },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent(PANEL_MOBILE_STATUS_FILTER_EVENT, {
          detail: { filter: 'total' },
        })
      );
      if (typeof onStatusFilterChange === 'function') {
        onStatusFilterChange('total');
      }
    };
  }, [activeStatusFilter, activeTab, onStatusFilterChange]);

  const showNotice = (message) => {
    setPanelNotice(message);
    window.setTimeout(() => setPanelNotice(''), 1400);
  };

  const downloadText = (fileName, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const toggleObjectNameField = (field) => {
    setObjectNameFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleGroup = (groupTitle) => {
    setColumnGroups((prev) =>
      prev.map((group) => {
        if (group.title !== groupTitle) return group;
        const nextChecked = !group.checked;
        return {
          ...group,
          checked: nextChecked,
          items: group.items.map((item) => ({ ...item, checked: nextChecked })),
        };
      })
    );
  };

  const toggleGroupItem = (groupTitle, itemLabel) => {
    setColumnGroups((prev) =>
      prev.map((group) => {
        if (group.title !== groupTitle) return group;
        const nextItems = group.items.map((item) =>
          item.label === itemLabel ? { ...item, checked: !item.checked } : item
        );
        return {
          ...group,
          items: nextItems,
          checked: nextItems.every((item) => item.checked),
        };
      })
    );
  };

  const moveGroupOrder = (groupTitle) => {
    setColumnGroups((prev) => {
      const idx = prev.findIndex((g) => g.title === groupTitle);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const toggleItemOptions = (groupTitle, itemLabel) => {
    const key = `${groupTitle}::${itemLabel}`;
    setItemOptions((prev) => {
      const current = prev[key]?.mode || 'basic';
      const nextMode =
        itemLabel === 'Last Updated'
          ? current === 'datetime'
            ? 'time'
            : 'datetime'
          : current === 'basic'
          ? 'advanced'
          : 'basic';
      return { ...prev, [key]: { mode: nextMode } };
    });
  };

  const toggleSettings = () => {
    if (onSettingsToggle) {
      onSettingsToggle(!isSettingsOpen);
      return;
    }
    setInternalSettingsOpen((prev) => !prev);
  };

  const closeVehicleEditor = useCallback(() => {
    if (vehicleEditorSaving) return;
    vehicleEditorRequestRef.current += 1;
    setIsVehicleEditorOpen(false);
    setVehicleEditorLoading(false);
    setVehicleEditorSaving(false);
    setVehicleEditorError('');
    setVehicleEditorMessage('');
    setVehicleEditorFieldErrors({});
    setVehicleEditorRecordId('');
    setVehicleEditorTargetRow(null);
    setVehicleEditorDraft(createVehicleEditorDraft());
    setVehicleEditorTab('general');
  }, [vehicleEditorSaving]);

  const ensureVehicleEditorOptions = async () => {
    if (vehicleEditorOptionsRef.current) return vehicleEditorOptionsRef.current;

    const [organizations, branches, vehicleGroups] = await Promise.all([
      fetchJson('/api/organizations'),
      fetchJson('/api/branches'),
      fetchJson('/api/vehicle-groups'),
    ]);

    const nextOptions = {
      organizations: Array.isArray(organizations)
        ? organizations.map((item) => ({
            value: extractReferenceId(item?._id ?? item?.id),
            label: String(item?.name || ''),
          }))
        : [],
      branches: Array.isArray(branches)
        ? branches.map((item) => ({
            value: extractReferenceId(item?._id ?? item?.id),
            label: String(item?.name || ''),
            organizationId: extractReferenceId(item?.organizationId),
          }))
        : [],
      vehicleGroups: Array.isArray(vehicleGroups)
        ? vehicleGroups.map((item) => ({
            value: extractReferenceId(item?._id ?? item?.id),
            label: String(item?.name || ''),
            organizationId: extractReferenceId(item?.organizationId),
            branchId: extractReferenceId(item?.branchId),
          }))
        : [],
    };

    vehicleEditorOptionsRef.current = nextOptions;
    setVehicleEditorOptionSets(nextOptions);
    return nextOptions;
  };

  const openVehicleEditor = async (row) => {
    const requestId = vehicleEditorRequestRef.current + 1;
    vehicleEditorRequestRef.current = requestId;
    setIsVehicleEditorOpen(true);
    setVehicleEditorLoading(true);
    setVehicleEditorSaving(false);
    setVehicleEditorError('');
    setVehicleEditorMessage('');
    setVehicleEditorFieldErrors({});
    setVehicleEditorTargetRow(row);
    setVehicleEditorRecordId('');
    setVehicleEditorDraft(createVehicleEditorDraft());
    setVehicleEditorTab('general');

    try {
      const [optionSets, masterVehicles] = await Promise.all([
        ensureVehicleEditorOptions(),
        fetchJson('/api/master-vehicles'),
      ]);

      if (vehicleEditorRequestRef.current !== requestId) return;

      const matchedRecord = matchMasterVehicleRecord(row, Array.isArray(masterVehicles) ? masterVehicles : []);
      setVehicleEditorRecordId(String(matchedRecord?._id || matchedRecord?.id || ''));
      setVehicleEditorDraft(buildVehicleEditorDraft(row, matchedRecord, optionSets));
      if (!matchedRecord) {
        setVehicleEditorMessage('Linked master vehicle record not found. Review mode only.');
      }
    } catch (error) {
      if (vehicleEditorRequestRef.current !== requestId) return;
      setVehicleEditorError(error?.message || 'Unable to load vehicle editor.');
    } finally {
      if (vehicleEditorRequestRef.current === requestId) {
        setVehicleEditorLoading(false);
      }
    }
  };

  const handleVehicleEditorFieldChange = (name, value) => {
    setVehicleEditorDraft((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'organizationId') {
        next.branchId = '';
        next.vehicleGroupId = '';
      } else if (name === 'branchId') {
        next.vehicleGroupId = '';
      }
      return next;
    });
    setVehicleEditorFieldErrors((prev) => {
      if (!prev[name] && name !== 'organizationId' && name !== 'branchId' && name !== 'vehicleGroupId') {
        return prev;
      }
      const next = { ...prev };
      delete next[name];
      if (name === 'organizationId') {
        delete next.branchId;
        delete next.vehicleGroupId;
      } else if (name === 'branchId') {
        delete next.vehicleGroupId;
      }
      return next;
    });
    if (vehicleEditorMessage) setVehicleEditorMessage('');
  };

  const handleVehicleEditorSave = async () => {
    const trimmedVehicleNo = String(vehicleEditorDraft.vehicleNo || '').trim();
    const trimmedVehicleType = String(vehicleEditorDraft.vehicleType || '').trim();
    const trimmedImei = String(vehicleEditorDraft.imei || '').trim();
    const nextErrors = {};

    if (!vehicleEditorRecordId) {
      setVehicleEditorError('No linked master vehicle record found for this live object.');
      return;
    }
    if (!/^[A-Za-z0-9-]{3,20}$/.test(trimmedVehicleNo)) {
      nextErrors.vehicleNo = 'Vehicle No must be 3-20 chars using letters, numbers, or -.';
    }
    if (!trimmedVehicleType || trimmedVehicleType.length < 2) {
      nextErrors.vehicleType = 'Vehicle Type must be at least 2 characters.';
    }
    if (trimmedImei && !/^\d{10,20}$/.test(trimmedImei)) {
      nextErrors.imei = 'IMEI must be 10-20 digits.';
    }
    if (!String(vehicleEditorDraft.organizationId || '').trim()) nextErrors.organizationId = 'Organization is required.';
    if (!String(vehicleEditorDraft.branchId || '').trim()) nextErrors.branchId = 'Branch is required.';
    if (!String(vehicleEditorDraft.vehicleGroupId || '').trim()) nextErrors.vehicleGroupId = 'Vehicle Group is required.';

    setVehicleEditorFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const requestId = vehicleEditorRequestRef.current + 1;
    vehicleEditorRequestRef.current = requestId;
    setVehicleEditorSaving(true);
    setVehicleEditorError('');
    setVehicleEditorMessage('');

    try {
      await fetchJson(`/api/master-vehicles/${vehicleEditorRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleNo: trimmedVehicleNo,
          imei: trimmedImei,
          vehicleType: trimmedVehicleType,
          organizationId: vehicleEditorDraft.organizationId,
          branchId: vehicleEditorDraft.branchId,
          vehicleGroupId: vehicleEditorDraft.vehicleGroupId,
          status: vehicleEditorDraft.status === 'Inactive' ? 'Inactive' : 'Active',
        }),
      });

      if (vehicleEditorRequestRef.current !== requestId) return;

      setVehicleEditorMessage('Vehicle master updated successfully.');
      showNotice('Vehicle master updated');
    } catch (error) {
      if (vehicleEditorRequestRef.current !== requestId) return;
      setVehicleEditorError(error?.message || 'Unable to save vehicle changes.');
    } finally {
      if (vehicleEditorRequestRef.current === requestId) {
        setVehicleEditorSaving(false);
      }
    }
  };

  useEffect(() => {
    if (!isVehicleEditorOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeVehicleEditor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeVehicleEditor, isVehicleEditorOpen]);

  const matchingVehicleRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let rows = vehicleRows.filter((row) => companySelection[row.companyKey] ?? true);

    if (activeStatusFilter !== 'total') {
      rows = rows.filter((row) => row.status === activeStatusFilter);
    }

    if (showSelectedOnly) {
      rows = rows.filter((row) => selectedVehicleIds.has(row.id));
    }

    if (normalizedSearch) {
      rows = rows.filter((row) => row.searchText.includes(normalizedSearch));
    }

    rows = [...rows].sort((a, b) => {
      const aNum = Number(a.id.replace(/\D/g, ''));
      const bNum = Number(b.id.replace(/\D/g, ''));
      if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
        return sortAscending ? aNum - bNum : bNum - aNum;
      }
      return sortAscending ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
    });

    return rows;
  }, [activeStatusFilter, companySelection, searchTerm, selectedVehicleIds, showSelectedOnly, sortAscending, vehicleRows]);

  const matchingRowsByCompany = useMemo(
    () =>
      matchingVehicleRows.reduce((acc, row) => {
        if (!acc[row.companyKey]) acc[row.companyKey] = [];
        acc[row.companyKey].push(row);
        return acc;
      }, {}),
    [matchingVehicleRows]
  );

  const visibleVehicleRows = useMemo(
    () =>
      companyEntries.flatMap(([companyKey]) =>
        collapsedCompanies[companyKey] ? [] : matchingRowsByCompany[companyKey] || []
      ),
    [collapsedCompanies, companyEntries, matchingRowsByCompany]
  );

  const filteredSettingsGroups = useMemo(() => {
    const normalized = settingsSearchTerm.trim().toLowerCase();
    if (!normalized) return columnGroups;
    return columnGroups
      .map((group) => {
        const groupMatch = group.title.toLowerCase().includes(normalized);
        const items = group.items.filter((item) => item.label.toLowerCase().includes(normalized));
        if (!groupMatch && items.length === 0) return null;
        return { ...group, items: groupMatch ? group.items : items };
      })
      .filter(Boolean);
  }, [columnGroups, settingsSearchTerm]);

  const filteredIds = visibleVehicleRows.map((row) => row.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedVehicleIds.has(id));

  const filteredLocationRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return liveLocationRows;

    return liveLocationRows.filter((row) =>
      `${row.name} ${row.vehicles.join(' ')} ${row.companies.join(' ')}`.toLowerCase().includes(normalizedSearch)
    );
  }, [liveLocationRows, searchTerm]);

  const locationSummary = useMemo(() => {
    const visibleLocations = filteredLocationRows.length;
    const totalLocations = liveLocationRows.length;
    const vehiclesInView = filteredLocationRows.reduce((sum, row) => sum + Number(row?.count || 0), 0);
    const companies = new Set();

    filteredLocationRows.forEach((row) => {
      (row?.companies || []).forEach((company) => {
        const value = String(company || '').trim();
        if (value) companies.add(value);
      });
    });

    return {
      visibleLocations,
      totalLocations,
      vehiclesInView,
      companiesInView: companies.size,
    };
  }, [filteredLocationRows, liveLocationRows]);

  const filteredGeofenceRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return geofenceRows;

    return geofenceRows.filter((row) =>
      `${row?.name || ''} ${row?.type || ''} ${row?.description || ''}`.toLowerCase().includes(normalizedSearch)
    );
  }, [geofenceRows, searchTerm]);

  const flattenedVehicleItems = useMemo(() => {
    const items = [];

    companyEntries.forEach(([companyKey, companyData]) => {
      const isCollapsed = collapsedCompanies[companyKey] ?? false;
      const companyRowsToShow = matchingRowsByCompany[companyKey] || [];

      items.push({
        type: 'company',
        key: `company-${companyKey}`,
        companyKey,
        companyData,
        isCollapsed,
        height: COMPANY_ROW_HEIGHT,
      });

      if (!isCollapsed) {
        companyRowsToShow.forEach((row, index) => {
          items.push({
            type: 'vehicle',
            key: getVehicleRowReactKey(row, index),
            row,
            height: VEHICLE_ROW_HEIGHT,
          });
        });
      }
    });

    let offset = 0;
    return items.map((item) => {
      const nextItem = {
        ...item,
        top: offset,
      };
      offset += item.height;
      return nextItem;
    });
  }, [collapsedCompanies, companyEntries, matchingRowsByCompany]);

  const vehicleListTotalHeight =
    flattenedVehicleItems.length > 0
      ? flattenedVehicleItems[flattenedVehicleItems.length - 1].top +
        flattenedVehicleItems[flattenedVehicleItems.length - 1].height
      : 0;

  const visibleVehicleItems = useMemo(() => {
    const overscanPx = VEHICLE_LIST_OVERSCAN * VEHICLE_ROW_HEIGHT;
    const start = Math.max(0, vehicleScrollTop - overscanPx);
    const end = vehicleScrollTop + vehicleViewportHeight + overscanPx;

    return flattenedVehicleItems.filter(
      (item) => item.top + item.height >= start && item.top <= end
    );
  }, [flattenedVehicleItems, vehicleScrollTop, vehicleViewportHeight]);

  const pendingReverseGeocodeKeys = useMemo(() => {
    const priorityKeys = [];
    const seen = new Set();

    const addRow = (row) => {
      if (!row || row.addressSource !== 'coordinates' || !row.coordinateKey) return;
      if (resolvedAddresses[row.coordinateKey] || seen.has(row.coordinateKey)) return;
      seen.add(row.coordinateKey);
      priorityKeys.push({
        key: row.coordinateKey,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    };

    const addLocationRow = (row) => {
      const parsedCoordinates = parseCoordinateLabel(row?.name);
      if (!parsedCoordinates) return;

      const key = buildCoordinateKey(parsedCoordinates.latitude, parsedCoordinates.longitude);
      if (!key || resolvedAddresses[key] || seen.has(key)) return;

      seen.add(key);
      priorityKeys.push({
        key,
        latitude: parsedCoordinates.latitude,
        longitude: parsedCoordinates.longitude,
      });
    };

    if (activeTab === 'location') {
      filteredLocationRows.forEach(addLocationRow);
    }

    visibleVehicleItems.forEach((item) => {
      if (item.type === 'vehicle') addRow(item.row);
    });

    if (activeTab !== 'location') {
      vehicleRows.forEach((row) => addRow(row));
    }

    return priorityKeys;
  }, [activeTab, filteredLocationRows, resolvedAddresses, vehicleRows, visibleVehicleItems]);

  useEffect(() => {
    if (pendingReverseGeocodeKeys.length === 0) return undefined;

    const batch = pendingReverseGeocodeKeys
      .filter((entry) => !reverseGeocodeInFlightRef.current.has(entry.key))
      .slice(0, REVERSE_GEOCODE_BATCH_SIZE);

    if (batch.length === 0) return undefined;

    let cancelled = false;

    const runBatch = async () => {
      const resolvedEntries = {};

      await Promise.all(
        batch.map(async ({ key, latitude, longitude }) => {
          reverseGeocodeInFlightRef.current.add(key);
          try {
            const response = await fetch(
              `/api/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
              { cache: 'no-store' }
            );
            if (!response.ok) return;

            const payload = await response.json();
            const address = readDisplayString(payload, ['address', 'display_name'], '', {
              ignorePlaceholders: true,
            });
            if (address) {
              resolvedEntries[key] = address;
            }
          } catch {
            // Ignore transient lookup failures.
          } finally {
            reverseGeocodeInFlightRef.current.delete(key);
          }
        })
      );

      if (cancelled || Object.keys(resolvedEntries).length === 0) return;
      setResolvedAddresses((prev) => mergeReverseGeocodeCache(prev, resolvedEntries));
    };

    const timer = window.setTimeout(runBatch, REVERSE_GEOCODE_REQUEST_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pendingReverseGeocodeKeys]);

  const toggleVehicleSelection = (vehicleId) => {
    setSelectedVehicleIds((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked) => {
    setSelectedVehicleIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const focusVehicleFromPanel = (row) => {
    if (typeof window === 'undefined' || !row) return;

    window.dispatchEvent(
      new CustomEvent(PANEL_VEHICLE_FOCUS_EVENT, {
        detail: {
          vehicleId: row.id,
          imeiId: row.raw?.imei_id,
          vehicleNo: row.raw?.vehicle_no,
          vehicleName: row.objectName,
          latitude: row.raw?.latitude,
          longitude: row.raw?.longitude,
        },
      })
    );
  };

  const vehicleEditorBranchOptions = useMemo(
    () =>
      filterEditorOptions(vehicleEditorOptionSets.branches, {
        organizationId: vehicleEditorDraft.organizationId,
      }),
    [vehicleEditorDraft.organizationId, vehicleEditorOptionSets.branches]
  );

  const vehicleEditorGroupOptions = useMemo(
    () =>
      filterEditorOptions(vehicleEditorOptionSets.vehicleGroups, {
        organizationId: vehicleEditorDraft.organizationId,
        branchId: vehicleEditorDraft.branchId,
      }),
    [vehicleEditorDraft.branchId, vehicleEditorDraft.organizationId, vehicleEditorOptionSets.vehicleGroups]
  );

  const vehicleEditorProfileRows = useMemo(() => {
    const raw = vehicleEditorTargetRow?.raw || {};
    return [
      { label: 'Live Vehicle', value: vehicleEditorTargetRow?.id || '--' },
      { label: 'Object Name', value: vehicleEditorTargetRow?.objectName || '--' },
      { label: 'Packet Time', value: vehicleEditorTargetRow?.timeExact || '--' },
      { label: 'Location', value: vehicleEditorTargetRow?.address || '--' },
      { label: 'Company', value: raw?.company || raw?.organizations || '--' },
      { label: 'Branch', value: raw?.branch || '--' },
      { label: 'Vehicle Group', value: raw?.group1 || raw?.group || '--' },
      { label: 'Speed', value: `${vehicleEditorTargetRow?.speed || '0'} km/hr` },
      { label: 'Coordinates', value: Number.isFinite(vehicleEditorTargetRow?.latitude) && Number.isFinite(vehicleEditorTargetRow?.longitude) ? `${vehicleEditorTargetRow.latitude.toFixed(5)}, ${vehicleEditorTargetRow.longitude.toFixed(5)}` : '--' },
      { label: 'IMEI', value: raw?.imei_id || raw?.imei || '--' },
    ];
  }, [vehicleEditorTargetRow]);

  const vehicleEditorProfilePreview = useMemo(() => {
    const raw = vehicleEditorTargetRow?.raw || {};
    const plateNumber = vehicleEditorDraft.vehicleNo || vehicleEditorTargetRow?.id || '--';
    const objectType = vehicleEditorDraft.vehicleType || readDisplayString(raw, ['vehicle_type', 'vehicleType'], 'Truck');
    const objectBrand = readDisplayString(raw, ['brand', 'object_brand', 'make'], '--');
    const objectModel = readDisplayString(raw, ['model', 'object_model'], '--');
    const installationDate = vehicleEditorTargetRow?.timeExact || '--';

    return {
      primary: [
        { label: 'Plate Number', value: plateNumber },
        { label: 'Object Type', value: objectType, icon: 'truck', action: 'Swap' },
        {
          label: 'Object Category',
          choices: [
            { label: 'Movable', active: true },
            { label: 'Immovable', active: false },
          ],
        },
        { label: 'Color', value: readDisplayString(raw, ['color'], '--') },
        { label: 'Update Color', value: '' },
        { label: 'Object Brand', value: objectBrand },
        { label: 'Object Model', value: objectModel },
        { label: 'Object Axle', value: readDisplayString(raw, ['axle', 'object_axle'], 'Not Defined') },
        { label: 'DVIR Template', value: '--Select--' },
        { label: 'Manufacture Date', value: '', action: 'Clear Date' },
        { label: 'Disposal Date', value: '', action: 'Clear Date' },
        { label: 'Purchase Date', value: '', action: 'Clear Date' },
        { label: 'Purchase Amount', value: '0' },
        { label: 'Weight Capacity', value: '0' },
        { label: 'GPS Warranty', value: '0.0' },
        { label: 'Installation Date', value: installationDate, action: 'Clear Date' },
        { label: 'Measurement Tolerance', value: '' },
        { label: 'Registration Number', value: plateNumber || '0' },
        { label: 'Company Average', value: 'Enter company claimed average' },
        { label: 'Permit', value: '--Select--' },
        { label: 'Fuel Type', value: '--Select--' },
        { label: 'National Registry of Motor Objects', value: '' },
        {
          label: 'Distance based Fuel Consumption',
          compact: { enabled: false, value: '0.0', unit: 'Kilometer' },
        },
        {
          label: 'Duration based Fuel Consumption',
          compact: { enabled: false, value: '0', unit: 'MM' },
        },
      ],
      secondary: [
        { label: 'Fuel Idling Consumption', value: '1.89', trailing: 'Liter / Hr' },
        { label: 'Consumption Tolerance [+/-]', value: '0.0', trailing: '(%)' },
        { label: 'VIN(Chassis) Number', value: '' },
        { label: 'Engine Number', value: '' },
        { label: 'Odometer', value: 'Show', inlineAction: true },
        { label: 'LBS Detection Radius', value: '0', trailing: '(meter)' },
        { label: 'Engine Hour', value: 'Show', inlineAction: true },
        { label: 'Max Load Capacity', value: '0' },
        {
          label: 'Object Category Type',
          choices: [
            { label: 'Solid', active: true },
            { label: 'Liquid', active: false },
            { label: 'GAS', active: false },
          ],
        },
        { label: 'Object Length', value: '' },
        { label: 'Loading Unit', value: 'kg' },
        {
          label: 'Object Loading Type',
          choices: [
            { label: 'Single Load', active: false },
            { label: 'Multiple Load', active: true },
          ],
        },
        {
          label: 'Cost Based On',
          choices: [
            { label: 'Distance', active: false, checkbox: true },
            { label: 'Duration', active: false, checkbox: true },
          ],
        },
        { label: 'RFID Timeout Duration', value: '120', trailing: '(Seconds)' },
        { label: 'Sleep Mode Duration', value: '0', trailing: '(Min)' },
        { label: 'Minimum Working Hours', value: '' },
        { label: 'Minimum Distance Traveled', value: '' },
        {
          label: 'Weight Sensor',
          choices: [{ label: '', active: false, checkbox: true }],
        },
        {
          label: 'Fuel Sensor',
          choices: [
            { label: 'Single', active: true },
            { label: 'Multiple', active: false },
          ],
        },
        {
          label: 'G-Sensor',
          choices: [{ label: '', active: false, checkbox: true }],
        },
      ],
    };
  }, [vehicleEditorDraft.vehicleNo, vehicleEditorDraft.vehicleType, vehicleEditorTargetRow]);

  const vehicleEditorSensorsPreview = useMemo(() => {
    const powerConnected = vehicleEditorTargetRow?.powerState?.state === 'on' || vehicleEditorTargetRow?.powerState?.state === 'weak';
    const gpsConnected = vehicleEditorTargetRow?.gpsState?.state === 'on' || vehicleEditorTargetRow?.gpsState?.state === 'weak';
    const gsmConnected = vehicleEditorTargetRow?.gsmState?.state === 'on' || vehicleEditorTargetRow?.gsmState?.state === 'weak';

    return [
      {
        name: 'Ac/door',
        active: false,
        connectedSensor: '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'ACC(Ignition)',
        active: !!vehicleEditorTargetRow?.ignitionOn,
        connectedSensor: 'Ignition/ACC',
        readingType: 'Direct',
        workHour: !!vehicleEditorTargetRow?.ignitionOn,
        calibration: '--',
      },
      {
        name: 'Battery',
        active: powerConnected,
        connectedSensor: powerConnected ? 'Battery' : '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'Defence',
        active: false,
        connectedSensor: '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'ExternalVolt ( Analog )',
        active: powerConnected,
        connectedSensor: powerConnected ? 'ExternalVolt' : '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: 'Map',
      },
      {
        name: 'Petrol connect (immobilize)',
        active: false,
        connectedSensor: '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'Power',
        active: powerConnected,
        connectedSensor: powerConnected ? 'Power' : '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'SOS',
        active: false,
        connectedSensor: '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'Temperature',
        active: false,
        connectedSensor: '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: 'Map',
      },
      {
        name: 'GPS',
        active: gpsConnected,
        connectedSensor: gpsConnected ? 'GPS' : '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
      {
        name: 'GSM',
        active: gsmConnected,
        connectedSensor: gsmConnected ? 'GSM' : '--Select--',
        readingType: 'Direct',
        workHour: false,
        calibration: '--',
      },
    ];
  }, [vehicleEditorTargetRow]);

  const renderVehicleCompanyItem = (item) => (
    <div
      key={item.key}
      className={styles.companyRow}
      style={{ position: 'absolute', top: item.top, left: 0, right: 0, height: item.height }}
    >
      <label>
        <input
          type="checkbox"
          checked={companySelection[item.companyKey] ?? true}
          onChange={(event) =>
            setCompanySelection((prev) => ({ ...prev, [item.companyKey]: event.target.checked }))
          }
        />
        <span>{item.companyData.label}</span>
      </label>
      <span className={styles.companyMeta}>[ {item.companyData.rows.length} ]</span>
      <button
        type="button"
        className={styles.companyCollapse}
        aria-label={item.isCollapsed ? 'Expand company row' : 'Collapse company row'}
        onClick={() =>
          setCollapsedCompanies((prev) => ({ ...prev, [item.companyKey]: !prev[item.companyKey] }))
        }
      >
        {item.isCollapsed ? <FaPlus /> : <FaMinus />}
      </button>
    </div>
  );

  const renderVehicleRowItem = (item) => {
    const row = item.row;
    return (
      <div
        key={item.key}
        className={`${styles.dataRow} ${styles.vehicleRow}`}
        style={{
          gridTemplateColumns: vehicleGridTemplate,
          position: 'absolute',
          top: item.top,
          left: 0,
          right: 0,
          height: item.height,
        }}
      >
        <label className={styles.rowTick}>
          <input
            type="checkbox"
            checked={selectedVehicleIds.has(row.id)}
            onChange={() => toggleVehicleSelection(row.id)}
          />
        </label>
        <span
          className={`${styles.dot} ${
            row.status === 'stopped'
              ? styles.dotStop
              : row.status === 'running'
              ? styles.dotRun
              : row.status === 'inactive'
              ? styles.dotInactive
              : row.status === 'nodata'
              ? styles.dotNoData
              : styles.dotIdle
          }`}
        />
        {(showObjectNumber || showObjectName || showLastUpdated) && (
          <button
            type="button"
            className={`${styles.leftBlock} ${styles.vehicleIdentityButton}`}
            onClick={() => focusVehicleFromPanel(row)}
            title={`Track ${row.id} on map`}
          >
            {showObjectNumber ? <strong>{row.id}</strong> : null}
            {showObjectName ? <small>{row.objectName || `Object ${row.id}`}</small> : null}
            {showLastUpdated ? (
              <small
                title={row.timeExact || 'Packet time unavailable'}
              >
                {lastUpdatedMode === 'time'
                  ? String(row.displayTimestamp || '').split(', ').slice(-1)[0] || row.displayTimestamp
                  : row.displayTimestamp}
              </small>
            ) : null}
          </button>
        )}
        {showMode ? (
          <span className={styles.metricCell} title={`${row.speed} km/hr`}>
            {row.speed}
          </span>
        ) : null}
        {showIgnition ? (
          <FaKey
            title={row.ignitionOn ? 'Ignition On' : 'Ignition Off'}
            className={`${styles.metricIcon} ${row.ignitionOn ? styles.iconOk : styles.iconDanger}`}
          />
        ) : null}
        {showPower ? (
          <FaBatteryHalf
            title={row.powerState?.title || 'Power Off'}
            className={`${styles.metricIcon} ${
              row.powerState?.state === 'weak'
                ? styles.iconWarn
                : row.powerState?.state === 'on'
                ? styles.iconOk
                : styles.iconDanger
            }`}
          />
        ) : null}
        {showGsm ? (
          <FaSignal
            title={row.gsmState?.title || 'GSM Off'}
            className={`${styles.metricIcon} ${
              row.gsmState?.state === 'weak'
                ? styles.iconWarn
                : row.gsmState?.state === 'on'
                ? styles.iconOk
                : styles.iconDanger
            }`}
          />
        ) : null}
        {showGps ? (
          <FaWifi
            title={row.gpsState?.title || 'GPS Off'}
            className={`${styles.metricIcon} ${
              row.gpsState?.state === 'weak'
                ? styles.iconWarn
                : row.gpsState?.state === 'on'
                ? styles.iconOk
                : styles.iconDanger
            }`}
          />
        ) : null}
        {showExternalVoltage ? <span className={styles.voltageCell}>{row.voltage}</span> : null}
        {extraVehicleColumns.map((column) => (
          <span
            key={`${row.id}-${column.key}`}
            className={styles.extraDataCell}
            title={`${column.label}: ${column.value(row)}`}
          >
            <span className={styles.extraDataLabel}>{column.label}</span>
            <span className={styles.extraDataValue}>{column.value(row)}</span>
          </span>
        ))}
        {showAddress ? (
          <div className={styles.middleBlock}>
            <span>{row.address}</span>
            {row.distance ? <span>{row.distance}</span> : null}
          </div>
        ) : null}
        <div className={styles.endIcons}>
          <button
            type="button"
            className={styles.rowActionButton}
            aria-label={`Edit ${row.id}`}
            title={`Edit ${row.id}`}
            onClick={() => openVehicleEditor(row)}
          >
            <FaEdit />
          </button>
          <FaThumbsUp />
        </div>
        {rightActionCount > 0 ? (
          <div className={styles.rightIcons}>
            {showLiveStreaming ? <FaVideo /> : null}
            {showSnapshot ? <FaCamera /> : null}
            {showVideoPlayback ? <FaPlayCircle /> : null}
            {showIntercomMic ? <FaLock /> : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderVehicleEditorProfileField = (field) => {
    if (!field) return null;

    return (
      <div key={field.label} className={styles.vehicleEditorProfileField}>
        <label>{field.label}</label>
        {field.choices ? (
          <div className={styles.vehicleEditorProfileChoices}>
            {field.choices.map((choice, index) => (
              <span
                key={`${field.label}-${choice.label || 'choice'}-${index}`}
                className={`${styles.vehicleEditorProfileChoice} ${
                  choice.active ? styles.vehicleEditorProfileChoiceActive : ''
                } ${choice.checkbox ? styles.vehicleEditorProfileChoiceCheckbox : ''}`}
              >
                {choice.label || ' '}
              </span>
            ))}
          </div>
        ) : field.compact ? (
          <div className={styles.vehicleEditorProfileCompactRow}>
            <span
              className={`${styles.vehicleEditorProfileChoice} ${styles.vehicleEditorProfileChoiceCheckbox}`}
            >
              {field.compact.enabled ? 'On' : 'Off'}
            </span>
            <span className={styles.vehicleEditorProfileValue}>{field.compact.value}</span>
            <span className={styles.vehicleEditorProfileTrailing}>{field.compact.unit}</span>
          </div>
        ) : (
          <div className={styles.vehicleEditorProfileValueRow}>
            <span
              className={`${styles.vehicleEditorProfileValue} ${
                field.inlineAction ? styles.vehicleEditorProfileInlineAction : ''
              }`}
            >
              {field.icon === 'truck' ? <FaTruck className={styles.vehicleEditorProfileIcon} /> : null}
              {field.value || '\u00A0'}
            </span>
            {field.trailing ? <span className={styles.vehicleEditorProfileTrailing}>{field.trailing}</span> : null}
            {field.action ? <span className={styles.vehicleEditorProfileAction}>{field.action}</span> : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panelRoot}>
      <div className={styles.navbar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : styles.tabInactive}`}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            title={tab.label}
          >
            <tab.Icon size={12} className={styles.tabIcon} />
            {activeTab === tab.id ? <span className={styles.tabText}>{tab.label}</span> : null}
          </button>
        ))}
        <button
          type="button"
          className={styles.settingsToggle}
          aria-label="Open object list settings"
          title="Object List Settings"
          onClick={toggleSettings}
        >
          <FaCog size={14} />
        </button>
      </div>

      <div className={styles.statusBar}>
        {statusCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`${styles.statusCard} ${styles.statusCardButton} ${styles[card.className]} ${
              activeStatusFilter === card.id ? styles.statusCardActive : ''
            }`}
            onMouseDown={(event) => handlePanelStatusInteraction(event, card.id, setActiveStatusFilter)}
            onTouchStart={(event) => handlePanelStatusInteraction(event, card.id, setActiveStatusFilter)}
            onPointerDown={(event) => handlePanelStatusInteraction(event, card.id, setActiveStatusFilter)}
            onClick={(event) => handlePanelStatusInteraction(event, card.id, setActiveStatusFilter)}
          >
            <span className={styles.statusCardInner}>
              <span className={styles.statusValue}>{String(statusCounts[card.id]).padStart(2, '0')}</span>
              <span className={styles.statusLabel}>{card.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.searchRow}>
        <label className={styles.iconCheck}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={(event) => toggleSelectAllFiltered(event.target.checked)}
          />
        </label>
        <div className={styles.searchWrap}>
          <FaSearch size={12} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by IMEI, Registration, Object Model, SIM Number, etc."
          />
        </div>
        <div className={styles.searchActions}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Search"
            onClick={() => searchInputRef.current?.focus()}
          >
            <FaSearch />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Refresh"
            onClick={() => {
              setSearchTerm('');
              if (activeTab === 'vehical') {
                setActiveStatusFilter('total');
                setCompanySelection((prev) =>
                  Object.fromEntries(Object.keys(prev).map((key) => [key, true]))
                );
                if (onRefreshVehicles) onRefreshVehicles();
                return;
              }

              if (activeTab === 'geofence') {
                setHasFetchedGeofenceRows(false);
                setGeofenceRowsError('');
              }
            }}
          >
            <FaSyncAlt className={isVehiclesRefreshing ? styles.refreshSpin : ''} />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${showSelectedOnly ? styles.iconBtnActive : ''}`}
            aria-label="Filter selected"
            onClick={() => setShowSelectedOnly((prev) => !prev)}
          >
            <FaFilter />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Sort"
            onClick={() => setSortAscending((prev) => !prev)}
          >
            <FaSortAmountDown />
          </button>
        </div>
      </div>

      {activeTab === 'location' ? (
        <div className={styles.locationSummaryBar}>
          <div className={styles.locationSummaryCard}>
            <span className={styles.locationSummaryLabel}>Locations</span>
            <strong>{locationSummary.visibleLocations}</strong>
            <small>of {locationSummary.totalLocations}</small>
          </div>
          <div className={styles.locationSummaryCard}>
            <span className={styles.locationSummaryLabel}>Vehicles</span>
            <strong>{locationSummary.vehiclesInView}</strong>
            <small>in current view</small>
          </div>
          <div className={styles.locationSummaryCard}>
            <span className={styles.locationSummaryLabel}>Companies</span>
            <strong>{locationSummary.companiesInView}</strong>
            <small>mapped groups</small>
          </div>
        </div>
      ) : null}

      <div
        ref={tableWrapRef}
        className={styles.tableWrap}
        onScroll={activeTab === 'vehical' ? (event) => setVehicleScrollTop(event.currentTarget.scrollTop) : undefined}
      >
        {activeTab === 'vehical' && vehiclesError ? (
          <div className={styles.panelHelperState}>{vehiclesError}</div>
        ) : null}

        {activeTab === 'vehical' && isVehiclesLoading && vehicleRows.length === 0 ? (
          <div className={styles.panelHelperState}>Loading live vehicles...</div>
        ) : null}

        {activeTab === 'vehical' && !isVehiclesLoading && matchingVehicleRows.length === 0 ? (
          <div className={styles.panelHelperState}>
            {hasVehicleSource ? 'No vehicles available.' : 'No vehicles available.'}
          </div>
        ) : null}

        {activeTab === 'vehical' && matchingVehicleRows.length > 0 ? (
          <div style={{ position: 'relative', height: vehicleListTotalHeight }}>
            {visibleVehicleItems.map((item) =>
              item.type === 'company' ? renderVehicleCompanyItem(item) : renderVehicleRowItem(item)
            )}
          </div>
        ) : null}

        {activeTab === 'driver' && driverRows.length === 0 ? (
          <div className={styles.panelHelperState}>No driver data available.</div>
        ) : null}

        {activeTab === 'driver' &&
          driverRows.map((row, index) => (
            <div key={row.key || getVehicleRowReactKey(row, index)} className={`${styles.dataRow} ${styles.driverRow}`}>
              <span className={`${styles.dot} ${styles.blueDot}`} />
              <div className={styles.driverName}>
                <strong>{row.name}</strong>
                <small>{row.id}</small>
              </div>
              <div className={styles.driverStatus}>{row.status}</div>
              <div className={styles.driverRole}>{row.role}</div>
              <div className={styles.rightIcons}>
                <FaEllipsisV />
              </div>
            </div>
          ))}

        {activeTab === 'location' &&
          filteredLocationRows.map((row) => (
            <div key={row.name} className={`${styles.dataRow} ${styles.listRow} ${styles.locationCardRow}`}>
              <label className={`${styles.rowCheck} ${styles.locationRowCheck}`}>
                <input type="checkbox" defaultChecked />
                <span className={`${styles.listTextWrap} ${styles.locationTextWrap}`}>
                  <span className={styles.locationTopline}>
                    <span className={styles.listName}>{row.name}</span>
                  </span>
                  <span className={styles.locationMetaRow}>
                    <small className={styles.locationMetaBadge}>
                      {row.count} vehicle{row.count === 1 ? '' : 's'}
                    </small>
                    <small
                      className={styles.listMeta}
                      data-companies={
                        row.companies.length > 0
                          ? row.companies.length > 2
                            ? `${row.companies.slice(0, 2).join(', ')} +${row.companies.length - 2}`
                            : row.companies.join(', ')
                          : 'No company tags'
                      }
                    >
                      <span className={styles.locationMetaVisible}>
                      {row.companies.length > 0
                        ? row.companies.length > 2
                          ? `${row.companies.slice(0, 2).join(', ')} +${row.companies.length - 2}`
                          : row.companies.join(', ')
                        : 'No company tags'}
                    {row.companies.length > 0 ? ` • ${row.companies.join(', ')}` : ''}
                      </span>
                    </small>
                  </span>
                </span>
              </label>
              <div className={`${styles.rightIcons} ${styles.locationSide}`}>
                <span className={styles.locationPinWrap}>
                  <FaMapMarkerAlt />
                </span>
                <span className={styles.listBadge}>{row.count}</span>
              </div>
            </div>
          ))}

        {activeTab === 'geofence' && geofenceRowsError ? (
          <div className={styles.panelHelperState}>{geofenceRowsError}</div>
        ) : null}

        {activeTab === 'geofence' && isGeofenceRowsLoading ? (
          <div className={styles.panelHelperState}>Loading geofences...</div>
        ) : null}

        {activeTab === 'geofence' &&
        !isGeofenceRowsLoading &&
        !geofenceRowsError &&
        filteredGeofenceRows.length === 0 ? (
          <div className={styles.panelHelperState}>No geofences available.</div>
        ) : null}

        {activeTab === 'geofence' &&
          filteredGeofenceRows.map((row) => (
            <div key={String(row?._id || row?.name || 'geofence-row')} className={`${styles.dataRow} ${styles.listRow}`}>
              <label className={styles.rowCheck}>
                <input type="checkbox" defaultChecked />
                <span className={styles.listName}>{row.name || 'Unnamed geofence'}</span>
              </label>
              <div className={styles.rightIcons}>
                <FaMapMarkerAlt />
                <FaTrash />
                <FaExpand />
              </div>
            </div>
          ))}
      </div>

      <div className={styles.footer}>
        {activeTab === 'vehical' && (
          <>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('vtp_selected_vehicles', JSON.stringify(Array.from(selectedVehicleIds)));
                showNotice(`${selectedVehicleIds.size} vehicles saved`);
              }}
            >
              Save Selection
            </button>
            <button
              type="button"
              onClick={() => {
                const firstId = Array.from(selectedVehicleIds)[0];
                showNotice(firstId ? `Live stream opened for ${firstId}` : 'Select at least one vehicle');
              }}
            >
              Live Streaming
            </button>
          </>
        )}
        {activeTab === 'driver' && (
          <>
            <button type="button" onClick={() => downloadText('drivers.xls', JSON.stringify(driverRows, null, 2))}>XLS</button>
            <button type="button" onClick={() => downloadText('drivers.pdf.txt', JSON.stringify(driverRows, null, 2))}>PDF</button>
          </>
        )}
        {activeTab === 'location' && (
          <>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  'locations.xls',
                  (liveLocationRows.length > 0 ? liveLocationRows : demoLocationRows)
                    .map((row) => (typeof row === 'string' ? row : `${row.name} (${row.count})`))
                    .join('\n')
                )
              }
            >
              XLS
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  'locations.pdf.txt',
                  (liveLocationRows.length > 0 ? liveLocationRows : demoLocationRows)
                    .map((row) => (typeof row === 'string' ? row : `${row.name} (${row.count})`))
                    .join('\n')
                )
              }
            >
              PDF
            </button>
          </>
        )}
        {activeTab === 'geofence' && (
          <>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  'geofences.kml',
                  filteredGeofenceRows.map((row) => row?.name || 'Unnamed geofence').join('\n')
                )
              }
            >
              KML
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  'geofences.xls',
                  JSON.stringify(filteredGeofenceRows, null, 2)
                )
              }
            >
              XLS
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  'geofences.pdf.txt',
                  filteredGeofenceRows
                    .map((row) => `${row?.name || 'Unnamed geofence'}${row?.type ? ` (${row.type})` : ''}`)
                    .join('\n')
                )
              }
            >
              PDF
            </button>
          </>
        )}
      </div>
      {panelNotice ? <div className={styles.panelNotice}>{panelNotice}</div> : null}

      {isVehicleEditorOpen ? (
        <div className={styles.vehicleEditorOverlay} onMouseDown={closeVehicleEditor}>
          <div
            className={styles.vehicleEditorDialog}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-editor-title"
          >
            <div className={styles.vehicleEditorHeader}>
              <div>
                <p className={styles.vehicleEditorEyebrow}>Vehicle Master</p>
                <h3 id="vehicle-editor-title">Edit Object</h3>
                <p className={styles.vehicleEditorSubhead}>
                  {vehicleEditorTargetRow?.id || 'Vehicle'}{vehicleEditorRecordId ? '' : ' - review only'}
                </p>
              </div>
              <button
                type="button"
                className={styles.vehicleEditorClose}
                aria-label="Close vehicle editor"
                onClick={closeVehicleEditor}
              >
                <FaTimes />
              </button>
            </div>

            <div className={styles.vehicleEditorTabs} role="tablist" aria-label="Vehicle editor tabs">
              {vehicleEditorTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={vehicleEditorTab === tab.id}
                  className={`${styles.vehicleEditorTab} ${vehicleEditorTab === tab.id ? styles.vehicleEditorTabActive : ''}`}
                  onClick={() => setVehicleEditorTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.vehicleEditorBody}>
              {vehicleEditorLoading ? (
                <div className={styles.vehicleEditorState}>
                  <FaSyncAlt className={styles.refreshSpin} />
                  <span>Loading vehicle editor...</span>
                </div>
              ) : (
                <>
                  {vehicleEditorError ? <div className={styles.vehicleEditorError}>{vehicleEditorError}</div> : null}
                  {vehicleEditorMessage ? <div className={styles.vehicleEditorInfo}>{vehicleEditorMessage}</div> : null}

                  {vehicleEditorTab === 'general' && (
                    <div className={styles.vehicleEditorGrid}>
                      <label className={styles.vehicleEditorField}>
                        <span>Vehicle No</span>
                        <input
                          type="text"
                          value={vehicleEditorDraft.vehicleNo}
                          onChange={(event) => handleVehicleEditorFieldChange('vehicleNo', event.target.value)}
                          placeholder="Vehicle No"
                        />
                        {vehicleEditorFieldErrors.vehicleNo ? (
                          <small>{vehicleEditorFieldErrors.vehicleNo}</small>
                        ) : null}
                      </label>

                      <label className={styles.vehicleEditorField}>
                        <span>IMEI</span>
                        <input
                          type="text"
                          value={vehicleEditorDraft.imei}
                          onChange={(event) => handleVehicleEditorFieldChange('imei', event.target.value)}
                          placeholder="IMEI"
                        />
                        {vehicleEditorFieldErrors.imei ? <small>{vehicleEditorFieldErrors.imei}</small> : null}
                      </label>

                      <label className={styles.vehicleEditorField}>
                        <span>Vehicle Type</span>
                        <input
                          type="text"
                          value={vehicleEditorDraft.vehicleType}
                          onChange={(event) => handleVehicleEditorFieldChange('vehicleType', event.target.value)}
                          placeholder="Vehicle Type"
                        />
                        {vehicleEditorFieldErrors.vehicleType ? (
                          <small>{vehicleEditorFieldErrors.vehicleType}</small>
                        ) : null}
                      </label>

                      <label className={styles.vehicleEditorField}>
                        <span>Status</span>
                        <select
                          value={vehicleEditorDraft.status}
                          onChange={(event) => handleVehicleEditorFieldChange('status', event.target.value)}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </label>

                      <label className={styles.vehicleEditorField}>
                        <span>Organization</span>
                        <select
                          value={vehicleEditorDraft.organizationId}
                          onChange={(event) => handleVehicleEditorFieldChange('organizationId', event.target.value)}
                        >
                          <option value="">Select organization</option>
                          {vehicleEditorOptionSets.organizations.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {vehicleEditorFieldErrors.organizationId ? (
                          <small>{vehicleEditorFieldErrors.organizationId}</small>
                        ) : null}
                      </label>

                      <label className={styles.vehicleEditorField}>
                        <span>Branch</span>
                        <select
                          value={vehicleEditorDraft.branchId}
                          onChange={(event) => handleVehicleEditorFieldChange('branchId', event.target.value)}
                          disabled={!vehicleEditorDraft.organizationId}
                        >
                          <option value="">Select branch</option>
                          {vehicleEditorBranchOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {vehicleEditorFieldErrors.branchId ? <small>{vehicleEditorFieldErrors.branchId}</small> : null}
                      </label>

                      <label className={styles.vehicleEditorField}>
                        <span>Vehicle Group</span>
                        <select
                          value={vehicleEditorDraft.vehicleGroupId}
                          onChange={(event) => handleVehicleEditorFieldChange('vehicleGroupId', event.target.value)}
                          disabled={!vehicleEditorDraft.organizationId || !vehicleEditorDraft.branchId}
                        >
                          <option value="">Select vehicle group</option>
                          {vehicleEditorGroupOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {vehicleEditorFieldErrors.vehicleGroupId ? (
                          <small>{vehicleEditorFieldErrors.vehicleGroupId}</small>
                        ) : null}
                      </label>

                      <div className={styles.vehicleEditorSummaryCard}>
                        <strong>Live Snapshot</strong>
                        <div className={styles.vehicleEditorSummaryList}>
                          {vehicleEditorProfileRows.map((row) => (
                            <div key={row.label} className={styles.vehicleEditorSummaryRow}>
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {vehicleEditorTab === 'profile' && (
                    <div className={styles.vehicleEditorProfileLayout}>
                      <section className={styles.vehicleEditorProfileCard}>
                        <div className={styles.vehicleEditorProfileCardHeader}>
                          <strong>Profile</strong>
                          <span>Static design preview</span>
                        </div>
                        <div className={styles.vehicleEditorProfileForm}>
                          {vehicleEditorProfilePreview.primary.map(renderVehicleEditorProfileField)}
                        </div>
                      </section>

                      <section className={styles.vehicleEditorProfileCard}>
                        <div className={styles.vehicleEditorProfileCardHeader}>
                          <strong>Usage & Capacity</strong>
                          <span>Read-only until backend support is available</span>
                        </div>
                        <div className={styles.vehicleEditorProfileForm}>
                          {vehicleEditorProfilePreview.secondary.map(renderVehicleEditorProfileField)}
                        </div>
                      </section>
                    </div>
                  )}

                  {vehicleEditorTab === 'sensors' && (
                    <div className={styles.vehicleEditorSensorsCard}>
                      <div className={styles.vehicleEditorProfileCardHeader}>
                        <strong>Sensors</strong>
                        <span>Static wiring preview with live hints where available</span>
                      </div>
                      <div className={styles.vehicleEditorSensorsTableWrap}>
                        <table className={styles.vehicleEditorSensorsTable}>
                          <thead>
                            <tr>
                              <th>Active</th>
                              <th>Connection Type</th>
                              <th>Connected Sensor</th>
                              <th>Reading Type</th>
                              <th>Work Hour Calculation</th>
                              <th>Calibration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vehicleEditorSensorsPreview.map((sensor) => (
                              <tr key={sensor.name}>
                                <td>
                                  <span
                                    className={`${styles.vehicleEditorSensorCheck} ${
                                      sensor.active ? styles.vehicleEditorSensorCheckActive : ''
                                    }`}
                                  />
                                </td>
                                <td>{sensor.name}</td>
                                <td>{sensor.connectedSensor}</td>
                                <td>{sensor.readingType}</td>
                                <td>
                                  <span
                                    className={`${styles.vehicleEditorSensorCheck} ${
                                      sensor.workHour ? styles.vehicleEditorSensorCheckActive : ''
                                    }`}
                                  />
                                </td>
                                <td>
                                  {sensor.calibration === 'Map' ? (
                                    <span className={styles.vehicleEditorSensorMap}>Map</span>
                                  ) : (
                                    sensor.calibration
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(vehicleEditorTab === 'document' || vehicleEditorTab === 'allocate') && (
                    <div className={styles.vehicleEditorStaticCard}>
                      <strong>{vehicleEditorTabs.find((tab) => tab.id === vehicleEditorTab)?.label}</strong>
                      <p>
                        This section is reserved in the design, but the current customer panel backend does not expose
                        editable data for it yet.
                      </p>
                      <ul className={styles.vehicleEditorStaticList}>
                        <li>Brand styling and layout are kept ready for future expansion.</li>
                        <li>Save is limited to General and Profile fields backed by current APIs.</li>
                        <li>No fake persistence is being used here.</li>
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={styles.vehicleEditorFooter}>
              <div className={styles.vehicleEditorFooterText}>
                {vehicleEditorRecordId
                  ? 'Safe mode: only supported vehicle master fields will be saved.'
                  : 'Review mode: no linked master vehicle record was found for this live object.'}
              </div>
              <div className={styles.vehicleEditorFooterActions}>
                <button type="button" className={styles.vehicleEditorSecondaryBtn} onClick={closeVehicleEditor}>
                  Close
                </button>
                <button
                  type="button"
                  className={styles.vehicleEditorPrimaryBtn}
                  onClick={handleVehicleEditorSave}
                  disabled={
                    vehicleEditorLoading ||
                    vehicleEditorSaving ||
                    !vehicleEditorRecordId ||
                    vehicleEditorTab !== 'general'
                  }
                >
                  {vehicleEditorSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <aside className={`${styles.settingsDrawer} ${isSettingsOpen ? styles.settingsDrawerOpen : ''}`}>
        <div className={styles.settingsDrawerHead}>
          <strong>Object List</strong>
        </div>
        <div className={styles.settingsDrawerBody}>
          <div className={styles.settingsSearchWrap}>
            <FaSearch size={12} />
            <input
              type="text"
              placeholder="Search"
              value={settingsSearchTerm}
              onChange={(event) => setSettingsSearchTerm(event.target.value)}
            />
            <button type="button" className={styles.settingsIconBtn} onClick={() => setSettingsSearchTerm('')}>
              <FaSyncAlt size={11} />
            </button>
          </div>
          <p className={styles.settingsHint}>*If no space available, remove some widgets to add new ones.</p>

          <h5 className={styles.settingsSectionTitle}>Object Name</h5>
          <div className={styles.settingsSimpleCard}>
            <label className={styles.settingsCheckRow}>
              <input
                type="checkbox"
                checked={objectNameFields.objectNumber}
                onChange={() => toggleObjectNameField('objectNumber')}
              />
              <span className={styles.settingsText}>Object Number</span>
            </label>
            <label className={styles.settingsCheckRow}>
              <input
                type="checkbox"
                checked={objectNameFields.objectName}
                onChange={() => toggleObjectNameField('objectName')}
              />
              <span className={styles.settingsText}>Object Name</span>
            </label>
          </div>

          <h5 className={styles.settingsSectionTitle}>Choose Columns</h5>
          <div className={styles.settingsColumnsWrap}>
            {filteredSettingsGroups.map((group) => (
              <section key={group.title} className={styles.settingsGroup}>
                <header>
                  <label className={styles.settingsCheckRow}>
                    <input
                      type="checkbox"
                      checked={!!columnGroups.find((g) => g.title === group.title)?.checked}
                      onChange={() => toggleGroup(group.title)}
                    />
                    <span className={styles.settingsText}>{group.title}</span>
                  </label>
                  <button
                    type="button"
                    className={styles.settingsDragBtn}
                    aria-label={`Move ${group.title}`}
                    onClick={() => moveGroupOrder(group.title)}
                  >
                    <FaGripVertical />
                  </button>
                </header>
                <div className={styles.settingsItems}>
                  {(group.items || []).map((item) => (
                    <div key={`${group.title}-${item.label}`} className={styles.settingsItemRow}>
                      <label className={styles.settingsCheckRow}>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleGroupItem(group.title, item.label)}
                        />
                        <span className={styles.settingsText} title={item.label}>
                          {item.label}
                        </span>
                      </label>
                      {item.hasOptions ? (
                        <button
                          type="button"
                          className={`${styles.settingsItemAction} ${
                            itemOptions[`${group.title}::${item.label}`]?.mode ? styles.settingsItemActionActive : ''
                          }`}
                          aria-label={`${item.label} options`}
                          onClick={() => toggleItemOptions(group.title, item.label)}
                        >
                          <FaSlidersH />
                        </button>
                      ) : (
                        <span className={styles.settingsItemActionSpacer} aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default React.memo(Panels);
