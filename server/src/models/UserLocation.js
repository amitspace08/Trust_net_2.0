import mongoose, { Document, Schema } from "mongoose";

const userLocationSchema = new Schema(
  {
    uid: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    heading: { type: Number },
    speed: { type: Number },
    timestamp: { type: Date, default: Date.now },
    isEmergency: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("UserLocation", userLocationSchema);
