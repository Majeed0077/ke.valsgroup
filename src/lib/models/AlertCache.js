import mongoose from "mongoose";

const AlertCacheEntrySchema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true, index: true },
    loginFor: { type: String, default: "", index: true },
    alertId: { type: Number, required: true },
    severity: { type: String, default: "LOW", index: true },
    message: { type: String, default: "" },
    ruleName: { type: String, default: "", index: true },
    vehicleName: { type: String, default: "", index: true },
    vehicleNumber: { type: String, default: "", index: true },
    imei: { type: String, default: "", index: true },
    acknowledged: { type: Boolean, default: false, index: true },
    remarks: { type: String, default: "" },
    alertTime: { type: Date, default: null, index: true },
    sourceUpdatedAt: { type: Date, default: null },
    searchText: { type: String, default: "" },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

AlertCacheEntrySchema.index({ scopeKey: 1, alertId: 1 }, { unique: true });
AlertCacheEntrySchema.index({ scopeKey: 1, alertTime: -1 });
AlertCacheEntrySchema.index({ scopeKey: 1, acknowledged: 1, alertTime: -1 });
AlertCacheEntrySchema.index({ scopeKey: 1, severity: 1, alertTime: -1 });

const AlertCacheStateSchema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true, unique: true },
    loginFor: { type: String, default: "", index: true },
    lastSyncedAt: { type: Date, default: null, index: true },
    syncStartedAt: { type: Date, default: null },
    syncCompletedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    status: { type: String, default: "idle" },
    total: { type: Number, default: 0 },
    unacknowledged: { type: Number, default: 0 },
    acknowledgedToday: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const AlertCacheEntry =
  mongoose.models.AlertCacheEntry || mongoose.model("AlertCacheEntry", AlertCacheEntrySchema);

export const AlertCacheState =
  mongoose.models.AlertCacheState || mongoose.model("AlertCacheState", AlertCacheStateSchema);
