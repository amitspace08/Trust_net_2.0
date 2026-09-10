import mongoose, { Document, Schema } from "mongoose";

const sosSessionSchema = new Schema(
  {
    uid: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "resolved", "cancelled"],
      default: "active",
    },
    layerActive: { type: Number, default: 1 },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    layer1Alerted: { type: [String], default: [] },
    layer1Acknowledged: { type: String },
    layer2Alerted: { type: [String], default: [] },
    declinedCandidates: { type: [String], default: [] },
    layer2TriggerTime: { type: Date },
    layer3Alerted: { type: [String], default: [] },
    layer3TriggerTime: { type: Date },
    layer3Exhausted: { type: Boolean, default: false },
    lastLocationStale: { type: Boolean, default: false },
    locationSnapshot: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    responders: [
      {
        uid: { type: String, required: true },
        name: { type: String, required: true },
        respondedAt: { type: Date, default: Date.now },
        currentLocation: {
          lat: { type: Number },
          lng: { type: Number },
        },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model("SOSSession", sosSessionSchema);
