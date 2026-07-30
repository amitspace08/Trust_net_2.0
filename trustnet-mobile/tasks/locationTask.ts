import * as TaskManager from 'expo-task-manager';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const LOCATION_TASK_NAME = 'background-location-task';

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const loc = locations[0];
    
    if (loc) {
      const currentUser = auth.currentUser;
      if (!currentUser) return; // Only update if authenticated

      // Note: We check if location sharing is enabled. If not, we could stop the updates.
      // For this implementation, we assume if the task is running, sharing is enabled.

      try {
        await updateDoc(doc(db, 'user_locations', currentUser.uid), {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: new Date()
        });
        
        // Additional logic: If the user is in an active SOS session,
        // we can also write to `live_locations` or update the `sos_sessions` directly.
      } catch (err) {
        console.error('Error updating background location:', err);
      }
    }
  }
});
