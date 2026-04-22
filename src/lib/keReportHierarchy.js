export const KE_REPORT_HIERARCHY_COLUMNS = [
  { key: "group", label: "Group" },
  { key: "region", label: "Region" },
  { key: "cluster", label: "Cluster" },
  { key: "ibc", label: "IBC" },
  { key: "subDepartment", label: "Sub department" },
  { key: "vehicleNo", label: "Vehicle no." },
];

export const KE_REPORT_HIERARCHY_HEADERS = KE_REPORT_HIERARCHY_COLUMNS.map((column) => column.label);

function pickFirstValue(...values) {
  for (const value of values) {
    if (value === 0) return 0;
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return value;
  }
  return "-";
}

export function getKeReportHierarchyValue(row, key) {
  switch (key) {
    case "group":
      return pickFirstValue(row?.group, row?.vehicleGroup, row?.groupName);
    case "region":
      return pickFirstValue(row?.region, row?.regionName);
    case "cluster":
      return pickFirstValue(row?.cluster, row?.clusterName);
    case "ibc":
      return pickFirstValue(row?.ibc, row?.ibcName);
    case "subDepartment":
      return pickFirstValue(row?.subDepartment, row?.sub_department, row?.subdepartment, row?.department);
    case "vehicleNo":
      return pickFirstValue(row?.vehicleNo, row?.vehicle_no, row?.vehicleNumber, row?.object);
    default:
      return "-";
  }
}

export function getKeReportHierarchyRowValues(row) {
  return KE_REPORT_HIERARCHY_COLUMNS.map((column) => getKeReportHierarchyValue(row, column.key));
}
