import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const entry = JSON.parse(cached) as CacheEntry<T>;
    const now = Date.now();

    if (now - entry.timestamp > CACHE_EXPIRY) {
      await AsyncStorage.removeItem(`cache_${key}`);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
};

export const setCachedData = async <T>(key: string, data: T): Promise<void> => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
};