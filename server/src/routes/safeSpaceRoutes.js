import express from "express";
import { protect } from "../middleware/auth.js";
import {
  registerSafeSpace,
  getNearestSafeSpace,
  getSafeSpacesWithinRadius,
} from "../controllers/safeSpaceController.js";

const router = express.Router();

router.post("/register", protect, registerSafeSpace);
router.get("/nearest", protect, getNearestSafeSpace);
router.get("/within-radius", protect, getSafeSpacesWithinRadius);

export default router;
