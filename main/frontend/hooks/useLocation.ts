import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';

// Metro bundler provides require as a global — declare it for TypeScript
declare const require: (module: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Calculate approximate distance in meters between two coordinates.
 * Used for rate-limiting reverse geocoding requests.
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function getCityName(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`,
      {
        headers: { 'User-Agent': 'WHIM-App/1.0' },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.address.city || data.address.town || data.address.village || null;
  } catch {
    return null;
  }
}

export interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  city: string | null;
  loading: boolean;
  error: string | null;
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    city: null,
    loading: true,
    error: null,
  });

  // Refs for rate-limiting and race-condition prevention
  const lastGeocoded = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    const MIN_DISTANCE_METERS = 1000; // 1km
    const MIN_TIME_MS = 5 * 60 * 1000; // 5 minutes

    const handleLocationUpdate = (latitude: number, longitude: number, accuracy: number | null) => {
      if (cancelled) return;

      setLocation((prev) => ({
        ...prev,
        lat: latitude,
        lng: longitude,
        accuracy: accuracy,
        loading: false,
        error: null,
      }));

      const now = Date.now();
      const shouldGeocode =
        !lastGeocoded.current ||
        getDistance(latitude, longitude, lastGeocoded.current.lat, lastGeocoded.current.lng) > MIN_DISTANCE_METERS ||
        now - lastGeocoded.current.time > MIN_TIME_MS;

      if (shouldGeocode) {
        const requestId = ++latestRequestId.current;
        lastGeocoded.current = { lat: latitude, lng: longitude, time: now };

        getCityName(latitude, longitude).then((city) => {
          if (!cancelled && requestId === latestRequestId.current) {
            setLocation((prev) => ({ ...prev, city }));
          }
        });
      }
    };

    async function startWatching() {
      // Native: try expo-location
      if (Platform.OS !== 'web') {
        try {
          const ExpoLocation = require('expo-location');
          const { status } = await ExpoLocation.requestForegroundPermissionsAsync();

          if (status !== 'granted') {
            if (!cancelled) {
              setLocation({ lat: null, lng: null, accuracy: null, city: null, loading: false, error: 'Permission denied' });
            }
            return;
          }

          const sub = await ExpoLocation.watchPositionAsync(
            {
              accuracy: ExpoLocation.Accuracy.Balanced,
              timeInterval: 10_000,
              distanceInterval: 50,
            },
            (loc: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => {
              handleLocationUpdate(loc.coords.latitude, loc.coords.longitude, loc.coords.accuracy);
            },
          );

          if (cancelled) {
            sub.remove();
          } else {
            cleanupFn = () => sub.remove();
          }
        } catch {
          // expo-location not available — fall through to web API
        }
      }

      // Web / fallback
      if (!cleanupFn && typeof navigator !== 'undefined' && navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            handleLocationUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          },
          (err) => {
            if (!cancelled) {
              setLocation({ lat: null, lng: null, accuracy: null, city: null, loading: false, error: err.message });
            }
          },
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        );

        if (cancelled) {
          navigator.geolocation.clearWatch(watchId);
        } else {
          cleanupFn = () => navigator.geolocation.clearWatch(watchId);
        }
      }

      // No geolocation API available at all
      if (!cleanupFn && !cancelled) {
        setLocation({ lat: null, lng: null, accuracy: null, city: null, loading: false, error: 'Geolocation not supported' });
      }
    }

    startWatching();

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
    };
  }, []);

  return location;
}

