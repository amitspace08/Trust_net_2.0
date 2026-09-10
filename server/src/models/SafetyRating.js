import mongoose, { Document, Schema } from "mongoose";

const safetyRatingSchema = new Schema(
  {
    uid: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    rating: { type: Number, required: true, min: 1, max: 10 },
    gridCell: { type: String, required: true, index: true },
    tags: { type: [String], default: [] },
    comment: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model("SafetyRating", safetyRatingSchema);
