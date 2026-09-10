import express from "express";
import {
  searchUsers,
  getUser,
  updateProfile,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/search", protect, searchUsers);
router.route("/:uid").get(protect, getUser).put(protect, updateProfile);

export default router;
