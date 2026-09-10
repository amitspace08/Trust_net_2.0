import mongoose, { Document, Schema } from "mongoose";

const userSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    photoURL: { type: String },
    phone_no: { type: String },
    status: { type: String, default: "active" },
    lastSeen: { type: Date, default: Date.now },
    locationEnabled: { type: Boolean, default: true },
    locationSharingEnabled: { type: Boolean, default: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    isGuardianAngel: { type: Boolean, default: false },
    guardianVerified: { type: Boolean, default: false },
    guardianRating: { type: Number, default: 0 },
    guardianResponseCount: { type: Number, default: 0 },
    guardianAvailable: { type: Boolean, default: false },
    guardianRegisteredAt: { type: Date },
  },
  { timestamps: true },
);

// 2dsphere index for proximity queries
userSchema.index({ location: "2dsphere" });

export default mongoose.model("User", userSchema);
