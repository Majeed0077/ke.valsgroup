import mongoose from "mongoose";

const PlaybackHistoryCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    scopeKey: { type: String, required: true, index: true },
    schemaVersion: { type: Number, default: 1, index: true },
    lookupType: { type: String, default: "", index: true },
    lookupValue: { type: String, default: "", index: true },
    fromDate: { type: String, default: "", index: true },
    toDate: { type: String, default: "", index: true },
    queryHash: { type: String, default: "", index: true },
    rowCount: { type: Number, default: 0 },
    rows: { type: mongoose.Schema.Types.Mixed, default: [] },
    lastFetchedAt: { type: Date, default: null, index: true },
    lastAccessedAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date, default: null },
    hits: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

PlaybackHistoryCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PlaybackHistoryCacheSchema.index({ scopeKey: 1, lookupType: 1, lookupValue: 1, fromDate: 1, toDate: 1 });

export const PlaybackHistoryCache =
  mongoose.models.PlaybackHistoryCache ||
  mongoose.model("PlaybackHistoryCache", PlaybackHistoryCacheSchema);
