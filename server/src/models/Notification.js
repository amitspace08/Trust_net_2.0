import mongoose, { Document, Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    receiverUid: { type: String, required: true, index: true },
    senderUid: { type: String },
    type: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export default mongoose.model("Notification", notificationSchema);
