import mongoose, { Document, Schema } from "mongoose";

const safeSpaceSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, required: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: { type: String },
    verified: { type: Boolean, default: false },
    addedByUid: { type: String, required: true },
  },
  { timestamps: true },
);

safeSpaceSchema.index({ location: "2dsphere" });

export default mongoose.model("SafeSpace", safeSpaceSchema);
