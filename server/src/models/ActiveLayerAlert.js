import mongoose, { Document, Schema } from "mongoose";

const activeLayerAlertSchema = new Schema({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: "SOSSession",
    required: true,
    index: true,
  },
  candidateUID: { type: String, required: true },
  layer: { type: Number, required: true, default: 2 },
  alertedAt: { type: Date, default: Date.now },
});

// TTL Index: automatically delete document 600 seconds (10 minutes) after alertedAt.
// A candidate is effectively "timed out" from the perspective of the UI in 60s/120s,
// but this TTL keeps the database clean of stale alerts automatically.
activeLayerAlertSchema.index({ alertedAt: 1 }, { expireAfterSeconds: 600 });

export default mongoose.model("ActiveLayerAlert", activeLayerAlertSchema);
