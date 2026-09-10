import { addDoc, collection, GeoPoint, getDocs, query, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase/firebase";

// =======================================
// Register Safe Space
// =======================================

export async function registerSafeSpace(name, type, latitude, longitude, address) {
  try {
    const docRef = await addDoc(collection(db, "safe_spaces"), {
      name,

      type,

      geopoint: new GeoPoint(latitude, longitude),

      address,

      verified: true,

      registeredAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (err) {
    console.error(err);

    throw err;
  }
}

// =======================================
// Calculate Distance
// =======================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const toRadians = (x) => (x * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);

  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =======================================
// Nearest Safe Space
// =======================================

export async function getNearestSafeSpace(latitude, longitude) {
  const snapshot = await getDocs(query(collection(db, "safe_spaces")));

  let nearest = null;

  let bestDistance = Number.MAX_VALUE;

  snapshot.forEach((doc) => {
    const data = doc.data();

    const distance = calculateDistance(
      latitude,

      longitude,

      data.geopoint.latitude,

      data.geopoint.longitude,
    );

    if (distance < bestDistance) {
      bestDistance = distance;

      nearest = {
        id: doc.id,

        distance,

        ...data,
      };
    }
  });

  return nearest;
}

// =======================================
// Safe Spaces Within Radius
// =======================================

export async function getSafeSpacesWithinRadius(latitude, longitude, radius) {
  const snapshot = await getDocs(query(collection(db, "safe_spaces")));

  const spaces = [];

  snapshot.forEach((doc) => {
    const data = doc.data();

    const distance = calculateDistance(
      latitude,

      longitude,

      data.geopoint.latitude,

      data.geopoint.longitude,
    );

    if (distance <= radius) {
      spaces.push({
        id: doc.id,

        distance,

        ...data,
      });
    }
  });

  return spaces.sort((a, b) => a.distance - b.distance);
}

// =======================================
// Fetch Places from Google Maps API
// =======================================

export async function fetchPlaces(lat, lng) {
  if (typeof window === "undefined" || !window.google) {
    console.warn("Google Maps API not loaded");
    return [];
  }

  const location = new window.google.maps.LatLng(lat, lng);
  const mapDiv = document.createElement("div");
  const service = new window.google.maps.places.PlacesService(mapDiv);

  const types = ["hospital", "police", "pharmacy"];
  const results = [];

  for (const type of types) {
    const request = {
      location,
      radius: 2000, // 2km radius
      type,
    };

    try {
      const places = await new Promise((resolve, reject) => {
        service.nearbySearch(request, (res, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            resolve(res);
          } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(status);
          }
        });
      });
      results.push(...places);
    } catch (e) {
      console.error(`Failed to fetch places of type ${type}:`, e);
    }
  }

  return results
    .map((place) => {
      let placeType = "public_building";
      if (place.types?.includes("police")) placeType = "police_station";
      else if (place.types?.includes("hospital") || place.types?.includes("health"))
        placeType = "pharmacy";
      else if (place.types?.includes("pharmacy")) placeType = "pharmacy";

      const pLat = place.geometry?.location?.lat() || 0;
      const pLng = place.geometry?.location?.lng() || 0;

      return {
        id: place.place_id,
        name: place.name,
        type: placeType,
        distance: Math.round(calculateDistance(lat, lng, pLat, pLng)),
        address: place.vicinity || place.formatted_address || "Nearby",
        lat: pLat,
        lng: pLng,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}
