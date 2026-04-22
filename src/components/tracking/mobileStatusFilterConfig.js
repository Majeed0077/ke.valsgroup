export const MOBILE_STATUS_FILTERS = [
  {
    key: "total",
    label: "All",
    countKey: "all",
    helperText: (summary) => `${summary?.nodata ?? 0} no data`,
    toneClassName: "mobileStatusAll",
  },
  {
    key: "running",
    label: "Active",
    countKey: "running",
    helperText: () => "Running",
    toneClassName: "mobileStatusActive",
  },
  {
    key: "idle",
    label: "Idle",
    countKey: "idle",
    helperText: () => "Standby",
    toneClassName: "mobileStatusIdle",
  },
  {
    key: "stopped",
    label: "Stop",
    countKey: "stopped",
    helperText: () => "Stopped",
    toneClassName: "mobileStatusStop",
  },
  {
    key: "inactive",
    label: "Inactive",
    countKey: "inactive",
    helperText: () => "Offline",
    toneClassName: "mobileStatusInactive",
  },
];
