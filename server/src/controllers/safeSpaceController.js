

import SafeSpace from "../models/SafeSpace.js";

export const registerSafeSpace = async (req, res) => {
  try {
    const { name, description, type, lat, lng, address } = req.body;
    const safeSpace = await SafeSpace.create({
      name,
      description,
      type,
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
      address,
      verified: true, // Auto-verified for demo
      addedByUid: req.user.uid,
    });
    res.status(201).json(safeSpace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getNearestSafeSpace = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng)
      return res.status(400).json({ message: "lat and lng required" });

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    const nearest = await SafeSpace.findOne({
      verified: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
        },
      },
    });

    res.json(nearest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSafeSpacesWithinRadius = async (req, res) => {
  try {
    const { lat, lng, km = "5" } = req.query;
    if (!lat || !lng)
      return res.status(400).json({ message: "lat and lng required" });

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistance = parseFloat(km) * 1000;

    const spaces = await SafeSpace.find({
      verified: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistance,
        },
      },
    });

    res.json(spaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
