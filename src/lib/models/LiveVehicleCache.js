import mongoose from "mongoose";

const LiveVehicleCacheEntrySchema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true, index: true },
    schemaVersion: { type: Number, default: 1, index: true },
    loginFor: { type: String, default: "", index: true },
    vehicleId: { type: String, required: true },
    imeiId: { type: String, default: "", index: true },
    vehicleNo: { type: String, default: "", index: true },
    vehicleName: { type: String, default: "", index: true },
    vehicleType: { type: String, default: "", index: true },
    latitude: { type: Number, default: null, index: true },
    longitude: { type: Number, default: null, index: true },
    speed: { type: Number, default: 0, index: true },
    angleName: { type: Number, default: 0 },
    movementStatus: { type: String, default: "", index: true },
    ignitionStatus: { type: String, default: "", index: true },
    gpsFixStatus: { type: String, default: "", index: true },
    sosStatus: { type: String, default: "", index: true },
    statusKey: { type: String, default: "", index: true },
    statusChangedAt: { type: Date, default: null, index: true },
    branch: { type: String, default: "", index: true },
    company: { type: String, default: "", index: true },
    organizations: { type: String, default: "", index: true },
    group1: { type: String, default: "", index: true },
    path: { type: mongoose.Schema.Types.Mixed, default: [] },
    deviceDatetime: { type: Date, default: null, index: true },
    serverDatetime: { type: Date, default: null, index: true },
    lastPacketTime: { type: Date, default: null, index: true },
    lastLocationTime: { type: Date, default: null, index: true },
    explicitStatusChangedAt: { type: Date, default: null },
    sourceTimestamp: { type: Date, default: null, index: true },
    searchText: { type: String, default: "" },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

LiveVehicleCacheEntrySchema.index({ scopeKey: 1, vehicleId: 1 }, { unique: true });
LiveVehicleCacheEntrySchema.index({ scopeKey: 1, speed: -1 });
LiveVehicleCacheEntrySchema.index({ scopeKey: 1, branch: 1 });
LiveVehicleCacheEntrySchema.index({ scopeKey: 1, company: 1 });
LiveVehicleCacheEntrySchema.index({ scopeKey: 1, organizations: 1 });
LiveVehicleCacheEntrySchema.index({ scopeKey: 1, group1: 1 });

const LiveVehicleCacheStateSchema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true, unique: true },
    schemaVersion: { type: Number, default: 1, index: true },
    loginFor: { type: String, default: "", index: true },
    lastSyncedAt: { type: Date, default: null, index: true },
    syncStartedAt: { type: Date, default: null },
    syncCompletedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    status: { type: String, default: "idle" },
    total: { type: Number, default: 0 },
    running: { type: Number, default: 0 },
    idle: { type: Number, default: 0 },
    stopped: { type: Number, default: 0 },
    inactive: { type: Number, default: 0 },
    nodata: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const LiveVehicleCacheEntry =
  mongoose.models.LiveVehicleCacheEntry ||
  mongoose.model("LiveVehicleCacheEntry", LiveVehicleCacheEntrySchema);

export const LiveVehicleCacheState =
  mongoose.models.LiveVehicleCacheState ||
  mongoose.model("LiveVehicleCacheState", LiveVehicleCacheStateSchema);
