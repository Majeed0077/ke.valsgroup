function extractCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const preferredKeys = ["items", "rows", "results", "data", "objects", "list"];
  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function readString(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

export function normalizeReportObjectOptions(payload) {
  const seen = new Set();

  return extractCollection(payload)
    .map((row) =>
      readString(row, [
        "obj_reg_no",
        "vehicle_no",
        "reg_no",
        "registration_no",
        "vehicle_reg_no",
        "plate_no",
        "obj_name",
        "vehicle_name",
        "name",
        "label",
        "value",
      ])
    )
    .filter(Boolean)
    .filter((value) => {
      const normalized = value.toUpperCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

export function reconcileSelectedObjects(selectedObjects, availableObjects) {
  const options = (Array.isArray(availableObjects) ? availableObjects : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const optionSet = new Set(options);
  const rawSelected = Array.isArray(selectedObjects) ? selectedObjects : [];
  if (rawSelected.length === 0) {
    return [];
  }

  return rawSelected
    .map((value) => String(value || "").trim())
    .filter((value) => optionSet.has(value));
}

export function reconcileSelectedObject(selectedObject, availableObjects) {
  const value = String(selectedObject || "").trim();
  const options = (Array.isArray(availableObjects) ? availableObjects : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (value && options.includes(value)) {
    return value;
  }

  return options[0] || "";
}
