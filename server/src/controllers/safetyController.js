

import SafetyRating from "../models/SafetyRating.js";

// Helper to compute grid cell (~150m buckets -> ~0.00135 degrees)
// A simple way is to round lat/lng to 3 decimal places (~111 meters)
const computeGridCell = (lat, lng) => {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
};

export const rateArea = async (req, res) => {
  try {
    const { lat, lng, rating, tags, comment } = req.body;
    if (!lat || !lng || !rating)
      return res.status(400).json({ message: "lat, lng, and rating required" });

    const gridCell = computeGridCell(lat, lng);

    // Rate limiting: one rating per gridCell per user per 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentRating = await SafetyRating.findOne({
      uid: req.user.uid,
      gridCell,
      createdAt: { $gte: twoHoursAgo },
    });

    if (recentRating) {
      return res
        .status(429)
        .json({
          message:
            "You have already rated this area recently. Please try again later.",
        });
    }

    // Cap user's total contribution to any gridCell at 3 ratings per 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyRatingsCount = await SafetyRating.countDocuments({
      uid: req.user.uid,
      gridCell,
      createdAt: { $gte: oneDayAgo },
    });

    if (dailyRatingsCount >= 3) {
      return res
        .status(429)
        .json({ message: "Daily rating limit reached for this area." });
    }

    const newRating = await SafetyRating.create({
      uid: req.user.uid,
      location: { lat, lng },
      rating,
      gridCell,
      tags: tags || [],
      comment,
    });

    res.status(201).json(newRating);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAreaScore = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng)
      return res.status(400).json({ message: "lat and lng required" });

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const gridCell = computeGridCell(latitude, longitude);

    const ratings = await SafetyRating.find({ gridCell });

    if (ratings.length < 3) {
      return res.json({
        score: null,
        count: ratings.length,
        message: "Not enough ratings in this area",
      });
    }

    const totalScore = ratings.reduce((sum, r) => sum + r.rating, 0);
    const avgScore = totalScore / ratings.length;

    // Compile tags
    const tagCounts = {};
    ratings.forEach((r) => {
      r.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map((entry) => entry[0]);

    res.json({
      score: parseFloat(avgScore.toFixed(1)),
      count: ratings.length,
      topTags,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
