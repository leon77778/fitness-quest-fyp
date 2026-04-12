import AsyncStorage from "@react-native-async-storage/async-storage";

// This file holds the reusable math + persistence helpers for walk quests.
// WalkScreen uses these helpers so the screen component can focus on UI/state.

export const ACTIVE_WALK_STATE_KEY = "@rpgfit:activeWalk";
export const WALK_COMPLETION_RADIUS_M = 30;

export function destinationPoint(start, distanceM, bearingDeg) {
  // Creates a destination coordinate a given distance and direction away from the start.
  // The app uses this to generate a walk target without asking Google Maps for a route.
  const R = 6371000;
  const bearing = bearingDeg * Math.PI / 180;
  const lat1 = start.latitude * Math.PI / 180;
  const lon1 = start.longitude * Math.PI / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceM / R) +
    Math.cos(lat1) * Math.sin(distanceM / R) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distanceM / R) * Math.cos(lat1),
    Math.cos(distanceM / R) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { latitude: lat2 * 180 / Math.PI, longitude: lon2 * 180 / Math.PI };
}

export function haversineDistance(a, b) {
  // Estimates the straight-line distance between two coordinates in meters.
  // Even though the function name says "haversine", the implementation is a lighter approximation.
  const x = (b.longitude - a.longitude) * 111320 * Math.cos(a.latitude * Math.PI / 180);
  const y = (b.latitude - a.latitude) * 110540;
  return Math.sqrt(x * x + y * y);
}

export async function saveActiveWalkState(state) {
  // Saves an in-progress walk so the app can recover it if it is closed mid-walk.
  try {
    await AsyncStorage.setItem(ACTIVE_WALK_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export async function loadActiveWalkState() {
  // Restores an in-progress walk from local storage.
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_WALK_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function clearActiveWalkState() {
  // Removes any saved in-progress walk once the walk is finished or cancelled.
  try {
    await AsyncStorage.removeItem(ACTIVE_WALK_STATE_KEY);
  } catch (_) {}
}

export function buildGoogleMapsDirectionsUrl(startCoord, destination) {
  // Builds the external Google Maps walking-directions link.
  return `https://www.google.com/maps/dir/?api=1&origin=${startCoord.latitude},${startCoord.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=walking`;
}

export function buildGoogleMapsViewerUrl(currentLocation) {
  // Fallback Google Maps viewer URL when there is no destination yet.
  return `https://www.google.com/maps/@${currentLocation.latitude},${currentLocation.longitude},15z`;
}

export function buildWalkSessionEntry(userId, walkObjective, distanceM, elapsedS, xpEarned, completed, route) {
  // Converts the live walk state into the exact object shape saved to Supabase.
  return {
    user_id: userId,
    date: new Date().toISOString().split("T")[0],
    objective: walkObjective.text,
    obj_type: walkObjective.type,
    obj_value: walkObjective.value,
    distance_m: Math.round(distanceM * 100) / 100,
    duration_s: elapsedS,
    xp_earned: xpEarned,
    completed,
    route,
  };
}

export function computeWalkProgress(walkObjective, elapsedS, achieved, remainingM) {
  // Converts raw walk state into a 0..1 progress value for the progress bar.
  // Distance quests use remaining distance; timed quests use elapsed seconds.
  if (!walkObjective) return 0;
  if (walkObjective.type === "distance") {
    if (achieved) return 1;
    return Math.min(Math.max(0, 1 - ((remainingM ?? walkObjective.value) / walkObjective.value)), 1);
  }
  return Math.min(elapsedS / walkObjective.value, 1);
}

export function formatDistance(meters) {
  // Turns a raw meter count into a user-friendly label such as 825m or 1.24km.
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)}km` : `${Math.round(meters)}m`;
}

export function formatElapsedTime(seconds) {
  // Turns raw seconds into mm:ss for the UI.
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
