import mongoose from "mongoose";

const UILayoutSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    positions: { type: Object, default: {} },
  },
  { timestamps: true }
);

export const UILayout = mongoose.models.UILayout || mongoose.model("UILayout", UILayoutSchema);
