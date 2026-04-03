import React from 'react';
import { Platform, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

/**
 * Drop-in replacement for `Ionicons` from `@expo/vector-icons`.
 *
 * On native platforms the real Ionicons component is loaded via conditional
 * `require` so the font renders correctly.  On web the production Metro bundle
 * can fail to resolve `@expo/vector-icons`, so we render a plain-text Unicode
 * fallback instead (no font dependency).
 */

// ---------------------------------------------------------------------------
// Native: conditionally load the real Ionicons
// ---------------------------------------------------------------------------
let RealIonicons: React.ComponentType<{
  name: string;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
}> | null = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RealIonicons = require('@expo/vector-icons').Ionicons;
  } catch {
    RealIonicons = null;
  }
}

// ---------------------------------------------------------------------------
// Unicode glyphs used as web fallback (no font dependency).
// Every icon name used anywhere in the app must have an entry here.
// ---------------------------------------------------------------------------
const WEB_GLYPHS: Record<string, string> = {
  // ---- arrows / navigation ----
  'arrow-back': '←',
  'chevron-back': '‹',
  'chevron-forward': '›',
  'navigate-outline': '➤',

  // ---- actions ----
  close: '✕',
  checkmark: '✓',
  'checkmark-circle': '✔',
  'close-circle': '✖',
  add: '+',

  // ---- status / info ----
  'alert-circle': '⚠',
  'alert-circle-outline': '⚠',
  warning: '⚠',
  'time-outline': '🕐',
  'hourglass-outline': '⏳',
  'shield-checkmark-outline': '🛡',
  star: '★',
  radio: '📡',
  speedometer: '⏱',
  thermometer: '🌡',

  // ---- communication / auth ----
  'mail-outline': '✉',
  'lock-closed-outline': '🔒',
  'logo-google': 'G',
  'open-outline': '↗',

  // ---- places / location ----
  location: '📍',
  'location-outline': '📍',
  'navigate': '➤',
  'water-outline': '💧',
  'filter-outline': '🌀',
  'rainy-outline': '🌧',
  'partly-sunny': '🌤',
  rainy: '🌧',
  thunderstorm: '⛈',
  snow: '❄',

  // ---- people ----
  person: '👤',
  people: '👥',

  // ---- bookmarks / favorites ----
  bookmark: '🔖',
  'bookmark-outline': '🔖',
  heart: '❤',
  'heart-outline': '♡',

  // ---- calendar / events ----
  calendar: '📅',
  'calendar-outline': '📅',

  // ---- tags / price ----
  'pricetag-outline': '🏷',
  'flag-outline': '🚩',

  // ---- reports / megaphone ----
  megaphone: '📢',
  'megaphone-outline': '📢',

  // ---- settings / cloud / misc ----
  'settings-outline': '⚙',
  'options-outline': '⚙',
  'cloud-offline-outline': '☁',
  'cloud-done-outline': '☁',
  'locate': '◎',
  'send': '➤',
  'report_tab': '📢',

  // ---- existing GADOIcon glyphs carried over ----
  map: '🗺',
  explore: '◎',
  restaurant: '🍽',
  moon: '🌙',
  'bag-handle': '🛍',
  medkit: '💊',
  leaf: '🌿',
  'color-palette': '🎨',
  construct: '🔧',
  barbell: '🏋',
  school: '📚',
  film: '🎬',
  flower: '✿',
  laptop: '💻',
  paw: '🐾',
  car: '🚗',
  sparkles: '✦',
  storefront: '🏪',
  'musical-notes': '♪',
  compass: '◎',
  'thumbs-up': '👍',
  'thumbs-down': '👎',
  pizza: '🍕',
  'fast-food': '🍔',
  fish: '🐟',
  nutrition: '🥗',
  wine: '🍷',
  cafe: '☕',
  beer: '🍺',
  disc: '💿',
  bed: '🛏',
  business: '🏢',
  walk: '🚶',
  water: '💧',
  library: '📚',
  images: '🖼',
  ticket: '🎫',
  book: '📖',
  football: '⚽',
  basketball: '🏀',
  tennisball: '🎾',
  flame: '🔥',
  'hand-left': '🤚',
  body: '🧘',
  fist: '✊',
  mountain: '⛰',
  flash: '⚡',
  ellipse: '●',
  build: '🔧',
  clipboard: '📋',
  happy: '😊',
  'volume-mute': '🔇',
  'game-controller': '🎮',
  diamond: '💎',
  cash: '💵',
  wifi: '📶',
  'musical-note': '♪',
  fitness: '🏃',
  bulb: '💡',
};

// ---------------------------------------------------------------------------
// glyphMap – exported so that `keyof typeof Ionicons.glyphMap` still works
// when consumers reference the type.  The values are irrelevant at runtime on
// web; on native the real glyphMap from `@expo/vector-icons` is used.
// ---------------------------------------------------------------------------
export const glyphMap: Record<string, number> = Object.keys(WEB_GLYPHS).reduce(
  (acc, key) => {
    acc[key] = 0;
    return acc;
  },
  {} as Record<string, number>,
);

// If the real Ionicons is available, merge its glyphMap so all native names
// are present (important for TypeScript consumers that iterate the map).
if (RealIonicons && (RealIonicons as any).glyphMap) {
  Object.assign(glyphMap, (RealIonicons as any).glyphMap);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface SafeIoniconsProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle | ViewStyle>;
}

function SafeIonicons({
  name,
  size = 24,
  color = '#000000',
  style,
}: SafeIoniconsProps): React.ReactElement {
  // Native: delegate to the real Ionicons when available
  if (Platform.OS !== 'web' && RealIonicons) {
    return <RealIonicons name={name} size={size} color={color} style={style as StyleProp<TextStyle>} />;
  }

  // Web: Unicode text fallback
  const unicode = WEB_GLYPHS[name] ?? '●';
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style as StyleProp<ViewStyle>,
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.72,
          lineHeight: size,
          color,
          textAlign: 'center',
        }}
      >
        {unicode}
      </Text>
    </View>
  );
}

// Attach glyphMap as a static property so `Ionicons.glyphMap` works
SafeIonicons.glyphMap = glyphMap;

export { SafeIonicons as Ionicons };
export default SafeIonicons;
