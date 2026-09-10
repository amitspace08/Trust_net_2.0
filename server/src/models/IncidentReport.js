import mongoose, { Document, Schema } from "mongoose";

const incidentReportSchema = new Schema(
  {
    reporterUid: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    type: { type: String, required: true },
    status: { type: String, default: "pending" },
  },
  { timestamps: true },
);

export default mongoose.model("IncidentReport", incidentReportSchema);
