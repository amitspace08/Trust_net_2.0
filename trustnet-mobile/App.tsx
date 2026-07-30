import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Switch } from 'react-native';
import * as Location from 'expo-location';
import { LOCATION_TASK_NAME } from './tasks/locationTask';
import { auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';

export default function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Authenticate anonymously for the sake of the demo
    // In production, user would sign in via Google/Phone
    signInAnonymously(auth).catch(console.error);

    (async () => {
      // 1. Request foreground permissions
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setErrorMsg('Permission to access foreground location was denied');
        return;
      }

      // 2. Request background permissions
      let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        setErrorMsg('Permission to access background location was denied');
        return;
      }
      
      // 3. Check if task is already running
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(hasStarted);
    })();
  }, []);

  const toggleTracking = async () => {
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(false);
    } else {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Update every 30 seconds
        distanceInterval: 10, // Update every 10 meters
        deferredUpdatesInterval: 30000,
        showsBackgroundLocationIndicator: true, // required for iOS
      });
      setIsTracking(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TrustNet Mobile</Text>
      <Text style={styles.subtitle}>Background Location Service</Text>
      
      {errorMsg ? (
        <Text style={styles.error}>{errorMsg}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.status}>
            Status: {isTracking ? 'Active' : 'Inactive'}
          </Text>
          <Switch
            value={isTracking}
            onValueChange={toggleTracking}
            trackColor={{ false: '#767577', true: '#10B981' }}
          />
        </View>
      )}
      
      <Text style={styles.note}>
        When active, this app will continue sending your location to Firebase even when minimized or the screen is locked, enabling real-time SOS tracking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9fc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 40,
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 20,
  },
  note: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
