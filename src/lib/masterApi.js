export function toPublicOptions(docs, labelField = "name") {
  return (docs || []).map((doc) => ({
    id: String(doc._id),
    label: String(doc[labelField] || ""),
  }));
}

export function parseMongoError(error, fallbackMessage) {
  if (error?.code === 11000) {
    const key = Object.keys(error?.keyPattern || {})[0] || "field";
    return `${key} already exists.`;
  }
  return fallbackMessage || "Request failed.";
}
