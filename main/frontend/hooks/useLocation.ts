import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Metro bundler provides require as a global — declare it for TypeScript
declare const require: (module: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

  useEffect(() => {
    let cancelled = false;

    async function startWatching() {
      // Native: try expo-location
      if (Platform.OS !== 'web') {
        try {
          const ExpoLocation = require('expo-location');
          const { status } = await ExpoLocation.requestForegroundPermissionsAsync();

          if (status !== 'granted') {
            if (!cancelled) {
              setLocation({ lat: null, lng: null, accuracy: null, loading: false, error: 'Permission denied' });
            }
            return () => {};
          }

          const sub = await ExpoLocation.watchPositionAsync(
            {
              accuracy: ExpoLocation.Accuracy.Balanced,
              timeInterval: 10_000,
              distanceInterval: 50,
            },
            (loc: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => {
              if (!cancelled) {
                setLocation({
                  lat: loc.coords.latitude,
                  lng: loc.coords.longitude,
                  accuracy: loc.coords.accuracy,
                  loading: false,
                  error: null,
                });
              }
            },
          );

          return () => sub.remove();
        } catch {
          // expo-location not available — fall through to web API
        }
      }

      // Web / fallback
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!cancelled) {
              setLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                loading: false,
                error: null,
              });
            }
          },
          (err) => {
            if (!cancelled) {
              setLocation({ lat: null, lng: null, accuracy: null, loading: false, error: err.message });
            }
          },
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
        );

        return () => navigator.geolocation.clearWatch(watchId);
      }

      // No geolocation API available at all
      if (!cancelled) {
        setLocation({ lat: null, lng: null, accuracy: null, loading: false, error: 'Geolocation not supported' });
      }
      return () => {};
    }

    let cleanup: (() => void) | undefined;
    startWatching().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return location;
}
