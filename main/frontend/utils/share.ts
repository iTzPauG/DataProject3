import { Platform, Share, Alert } from 'react-native';
import { Restaurant } from '../types/restaurant';

export async function shareRestaurant(restaurant: Restaurant): Promise<void> {
  const text = [
    restaurant.name,
    restaurant.tagline,
    restaurant.address,
    `Rating: ${restaurant.rating}/5 (${restaurant.reviewsCount} reviews)`,
  ].join('\n');

  if (Platform.OS === 'web') {
    // Web Share API (mobile browsers / newer desktop browsers)
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title: restaurant.name, text });
        return;
      } catch (err) {
        // AbortError = user cancelled — do nothing
        if (err instanceof Error && err.name === 'AbortError') return;
        // Other error: fall through to clipboard
      }
    }

    // Clipboard fallback
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.writeText
    ) {
      try {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copied!', 'Restaurant info copied to clipboard.');
        return;
      } catch {
        // fall through
      }
    }

    // Last-resort alert
    Alert.alert('Share', text);
    return;
  }

  // Native (iOS / Android) — react-native Share
  try {
    await Share.share({ message: text, title: restaurant.name });
  } catch {
    // user cancelled or error
  }
}
