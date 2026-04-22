import mongoose from "mongoose";

const ProfileAvatarSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    identity: { type: String, default: "", index: true },
    loginFor: { type: String, default: "", index: true },
    loginKey: { type: String, default: "", index: true },
    userId: { type: String, default: "", index: true },
    externalUserId: { type: String, default: "", index: true },
    username: { type: String, default: "" },
    email: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    filename: { type: String, default: "" },
    size: { type: Number, default: 0 },
    imageData: { type: mongoose.Schema.Types.Buffer, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const ProfileAvatar =
  mongoose.models.ProfileAvatar || mongoose.model("ProfileAvatar", ProfileAvatarSchema);
