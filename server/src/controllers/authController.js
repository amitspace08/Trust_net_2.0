
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

const generateToken = (id, uid) => {
  return jwt.sign({ id, uid }, process.env.JWT_SECRET || "secret123", {
    expiresIn: "30d",
  });
};

export const register = async (req, res) => {
  const { displayName, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate a unique UID for Firebase compatibility initially
    const uid = new mongoose.Types.ObjectId().toString(); // Use mongoose ID as UID if not provided

    const user = await User.create({
      uid,
      displayName,
      email,
      passwordHash,
    });

    if (user) {
      res.status(201).json({
        success: true,
        message: "Registration successful",
        token: generateToken(String(user._id), user.uid),
        user: {
          id: user._id,
          name: user.displayName,
          email: user.email,
        }
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      res.json({
        success: true,
        message: "Login successful",
        token: generateToken(String(user._id), user.uid),
        user: {
          id: user._id,
          name: user.displayName,
          email: user.email
        }
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (user) {
      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.displayName,
          email: user.email
        }
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
