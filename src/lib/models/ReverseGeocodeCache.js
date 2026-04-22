import mongoose from "mongoose";

const ReverseGeocodeCacheSchema = new mongoose.Schema(
  {
    coordinateKey: { type: String, required: true, unique: true, index: true },
    latitude: { type: Number, required: true, index: true },
    longitude: { type: Number, required: true, index: true },
    language: { type: String, default: "en", index: true },
    address: { type: String, default: "" },
    provider: { type: String, default: "nominatim" },
    hits: { type: Number, default: 0 },
    lastResolvedAt: { type: Date, default: null, index: true },
    lastAccessedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

ReverseGeocodeCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const ReverseGeocodeCache =
  mongoose.models.ReverseGeocodeCache ||
  mongoose.model("ReverseGeocodeCache", ReverseGeocodeCacheSchema);
