import mongoose from "mongoose";

const sosArchiveSchema = new mongoose.Schema(
  {
    firebaseId: {
      type: String,
      required: true,
      unique: true,
    },
    triggeredBy: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["resolved", "cancelled"],
      required: true,
    },
    responderUID: {
      type: String,
      default: null,
    },
    finalLayer: {
      type: Number,
      default: 1,
    },
    firebaseCreatedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: Date.now,
    },
    rawFirebaseData: {
      type: mongoose.Schema.Types.Mixed,
      description: "Store the entire raw document for audit purposes",
    },
  },
  {
    timestamps: true, // Adds local createdAt/updatedAt for the archive record itself
  }
);

const SosArchive = mongoose.model("SosArchive", sosArchiveSchema);

export default SosArchive;
