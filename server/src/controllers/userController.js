
import User from "../models/User.js";


export const searchUsers = async (req, res) => {
  const { query } = req.query; // Search by phone or email

  try {
    const users = await User.find({
      $or: [{ email: query }, { phone_no: query }],
    }).select("-passwordHash");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid }).select(
      "-passwordHash",
    );
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user?.uid });

    if (user) {
      user.displayName = req.body.displayName || user.displayName;
      user.phone_no = req.body.phone_no || user.phone_no;
      user.photoURL = req.body.photoURL || user.photoURL;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        uid: updatedUser.uid,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        phone_no: updatedUser.phone_no,
        photoURL: updatedUser.photoURL,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
