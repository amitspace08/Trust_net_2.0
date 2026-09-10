import express from "express";
import { protect } from "../middleware/auth.js";
import {
  registerGuardian,
  toggleAvailability,
  acknowledgeLayer3,
  declineLayer3,
  submitGuardianRating,
} from "../controllers/guardianController.js";

const router = express.Router();

router.post("/register", protect, registerGuardian);
router.post("/availability", protect, toggleAvailability);
router.post("/:sessionId/acknowledge", protect, acknowledgeLayer3);
router.post("/:sessionId/decline", protect, declineLayer3);
router.post("/rating", protect, submitGuardianRating);

export default router;
