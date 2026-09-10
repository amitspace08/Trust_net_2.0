import mongoose, { Document, Schema } from "mongoose";

const trustRelationshipSchema = new Schema(
  {
    requesterUid: { type: String, required: true, index: true },
    targetUid: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    layer: { type: Number, default: 1 },
  },
  { timestamps: true },
);

// Prevent duplicate relationships
trustRelationshipSchema.index(
  { requesterUid: 1, targetUid: 1 },
  { unique: true },
);

export default mongoose.model("TrustRelationship", trustRelationshipSchema);
