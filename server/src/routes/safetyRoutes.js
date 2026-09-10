import express from "express";
import { protect } from "../middleware/auth.js";
import { rateArea, getAreaScore } from "../controllers/safetyController.js";

const router = express.Router();

router.post("/rate", protect, rateArea);
router.get("/area-score", protect, getAreaScore);

export default router;
