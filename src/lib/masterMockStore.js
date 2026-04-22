const MODE = (process.env.MASTER_DATA_MODE || "mock").toLowerCase();

export function shouldUseMasterMockData() {
  return MODE !== "db";
}

function seedStore() {
  const organizations = [
    { _id: "org-1", name: "Orange VTP", code: "ORG-001", status: "Active" },
    { _id: "org-2", name: "Blue Logistics", code: "ORG-002", status: "Active" },
  ];

  const companies = [
    {
      _id: "cmp-1",
      name: "Orange Transport Co",
      code: "CMP-001",
      organizationId: "org-1",
      status: "Active",
    },
    {
      _id: "cmp-2",
      name: "Blue Cargo Co",
      code: "CMP-002",
      organizationId: "org-2",
      status: "Active",
    },
  ];

  const branches = [
    {
      _id: "br-1",
      name: "Karachi Branch",
      code: "BR-001",
      organizationId: "org-1",
      companyId: "cmp-1",
      location: "Shahrah-e-Faisal",
      status: "Active",
    },
    {
      _id: "br-2",
      name: "Lahore Branch",
      code: "BR-002",
      organizationId: "org-1",
      companyId: "cmp-1",
      location: "Johar Town",
      status: "Active",
    },
  ];

  const vehicleGroups = [
    {
      _id: "vg-1",
      name: "Long Route Fleet",
      code: "VG-001",
      organizationId: "org-1",
      branchId: "br-1",
      description: "Highway route vehicles",
      status: "Active",
    },
    {
      _id: "vg-2",
      name: "City Delivery Fleet",
      code: "VG-002",
      organizationId: "org-1",
      branchId: "br-2",
      description: "In-city delivery units",
      status: "Active",
    },
  ];

  const masterVehicles = [
    {
      _id: "veh-1",
      vehicleNo: "KHI-1234",
      imei: "359339080000111",
      vehicleType: "Truck",
      organizationId: "org-1",
      branchId: "br-1",
      vehicleGroupId: "vg-1",
      status: "Active",
    },
    {
      _id: "veh-2",
      vehicleNo: "LHR-8899",
      imei: "359339080000222",
      vehicleType: "Van",
      organizationId: "org-1",
      branchId: "br-2",
      vehicleGroupId: "vg-2",
      status: "Active",
    },
  ];

  return {
    organizations,
    companies,
    branches,
    vehicleGroups,
    masterVehicles,
    counters: {
      organizations: 3,
      companies: 3,
      branches: 3,
      vehicleGroups: 3,
      masterVehicles: 3,
    },
  };
}

function getStore() {
  if (!globalThis.__masterMockStore) {
    globalThis.__masterMockStore = seedStore();
  }
  return globalThis.__masterMockStore;
}

const idPrefixes = {
  organizations: "org",
  companies: "cmp",
  branches: "br",
  vehicleGroups: "vg",
  masterVehicles: "veh",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDuplicateError(field) {
  const error = new Error(`${field} already exists.`);
  error.code = "DUPLICATE";
  return error;
}

function ensureUnique(rows, field, value, excludingId = null) {
  if (value == null) return;
  if (typeof value === "string" && value.trim() === "") return;
  const normalized = String(value || "").trim().toLowerCase();
  const exists = rows.some((row) => {
    if (excludingId && String(row._id) === String(excludingId)) return false;
    return String(row[field] || "").trim().toLowerCase() === normalized;
  });
  if (exists) throw createDuplicateError(field);
}

function nextId(entity) {
  const store = getStore();
  const next = store.counters[entity] || 1;
  store.counters[entity] = next + 1;
  return `${idPrefixes[entity]}-${next}`;
}

export function listMock(entity) {
  const store = getStore();
  return clone(store[entity] || []);
}

export function createMock(entity, payload, uniqueFields = []) {
  const store = getStore();
  const rows = store[entity] || [];
  uniqueFields.forEach((field) => ensureUnique(rows, field, payload[field]));
  const next = { _id: nextId(entity), ...payload };
  rows.unshift(next);
  return clone(next);
}

export function updateMock(entity, id, payload, uniqueFields = []) {
  const store = getStore();
  const rows = store[entity] || [];
  const index = rows.findIndex((row) => String(row._id) === String(id));
  if (index < 0) return null;
  uniqueFields.forEach((field) => ensureUnique(rows, field, payload[field], id));
  rows[index] = { ...rows[index], ...payload };
  return clone(rows[index]);
}

export function removeMock(entity, id) {
  const store = getStore();
  const rows = store[entity] || [];
  const index = rows.findIndex((row) => String(row._id) === String(id));
  if (index < 0) return false;
  rows.splice(index, 1);
  return true;
}

export function getBranchMockRows() {
  const store = getStore();
  const orgById = new Map(store.organizations.map((org) => [String(org._id), org]));
  const companyById = new Map(store.companies.map((company) => [String(company._id), company]));
  return clone(
    store.branches.map((row) => ({
      ...row,
      organizationName: orgById.get(String(row.organizationId))?.name || "",
      companyName: companyById.get(String(row.companyId))?.name || "",
    }))
  );
}

export function getCompanyMockRows() {
  const store = getStore();
  const orgById = new Map(store.organizations.map((org) => [String(org._id), org]));
  return clone(
    store.companies.map((row) => ({
      ...row,
      organizationName: orgById.get(String(row.organizationId))?.name || "",
    }))
  );
}

export function getVehicleGroupMockRows() {
  const store = getStore();
  const orgById = new Map(store.organizations.map((org) => [String(org._id), org]));
  const branchById = new Map(store.branches.map((branch) => [String(branch._id), branch]));
  return clone(
    store.vehicleGroups.map((row) => ({
      ...row,
      organizationName: orgById.get(String(row.organizationId))?.name || "",
      branchName: branchById.get(String(row.branchId))?.name || "",
    }))
  );
}

export function getMasterVehicleMockRows() {
  const store = getStore();
  const orgById = new Map(store.organizations.map((org) => [String(org._id), org]));
  const branchById = new Map(store.branches.map((branch) => [String(branch._id), branch]));
  const groupById = new Map(store.vehicleGroups.map((group) => [String(group._id), group]));
  return clone(
    store.masterVehicles.map((row) => ({
      ...row,
      organizationName: orgById.get(String(row.organizationId))?.name || "",
      branchName: branchById.get(String(row.branchId))?.name || "",
      vehicleGroupName: groupById.get(String(row.vehicleGroupId))?.name || "",
    }))
  );
}

export function getOrganizationDependencySummaryMock(id) {
  const store = getStore();
  const orgId = String(id);
  const companyCount = store.companies.filter((row) => String(row.organizationId) === orgId).length;
  const branchCount = store.branches.filter((row) => String(row.organizationId) === orgId).length;
  const groupCount = store.vehicleGroups.filter((row) => String(row.organizationId) === orgId).length;
  const vehicleCount = store.masterVehicles.filter((row) => String(row.organizationId) === orgId).length;
  return { companyCount, branchCount, groupCount, vehicleCount };
}

export function getCompanyDependencySummaryMock(id) {
  const store = getStore();
  const companyId = String(id);
  const branchCount = store.branches.filter((row) => String(row.companyId) === companyId).length;
  return { branchCount };
}

export function getBranchDependencySummaryMock(id) {
  const store = getStore();
  const branchId = String(id);
  const groupCount = store.vehicleGroups.filter((row) => String(row.branchId) === branchId).length;
  const vehicleCount = store.masterVehicles.filter((row) => String(row.branchId) === branchId).length;
  return { groupCount, vehicleCount };
}

export function getVehicleGroupDependencySummaryMock(id) {
  const store = getStore();
  const groupId = String(id);
  const vehicleCount = store.masterVehicles.filter(
    (row) => String(row.vehicleGroupId) === groupId
  ).length;
  return { vehicleCount };
}
