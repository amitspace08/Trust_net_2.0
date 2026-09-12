import express from "express";
import {
  triggerSOS,
  cancelSOS,
  acknowledgeSOS,
  endSOS,
  getSOS,
  acknowledgeLayer2,
  declineLayer2,
  archiveSOS,
} from "../controllers/sosController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const router = express.Router();

const triggerSchema = z.object({
  body: z.object({
    lat: z.number({ required_error: "Latitude is required" }),
    lng: z.number({ required_error: "Longitude is required" }),
  }),
});

router.post("/archive", archiveSOS); // Used by Firebase Cloud Functions, might want an API key here later
router.post("/trigger", protect, validate(triggerSchema), triggerSOS);
router.post("/:sessionId/cancel", protect, cancelSOS);
router.post("/:sessionId/acknowledge", protect, acknowledgeSOS);
router.post("/:sessionId/end", protect, endSOS);
router.get("/:sessionId", protect, getSOS);
router.post("/:sessionId/layer2/acknowledge", protect, acknowledgeLayer2);
router.post("/:sessionId/layer2/decline", protect, declineLayer2);

export default router;
