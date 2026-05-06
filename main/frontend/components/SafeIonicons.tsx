import React from 'react';
import { Platform, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import Icon, { IconName } from './Icon';

/**
 * Drop-in replacement for `Ionicons` from `@expo/vector-icons`.
 *
 * On native we still delegate to the real Ionicons component so existing
 * screens keep their vector glyphs.
 *
 * On web we deliberately avoid emoji fallbacks (the colored OS emoji look
 * was the single biggest "AI slop" tell in the previous design).  For the
 * icon names the redesigned screens care about we map to our new monochrome
 * geometric `Icon` component.  For long-tail names that still come from
 * legacy screens we fall back to a minimal neutral dot — never an emoji.
 */

// ── Native pathway ───────────────────────────────────────────────────────
let RealIonicons: React.ComponentType<{
  name: string;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
}> | null = null;

if (Platform.OS !== 'web') {
  try {
    RealIonicons = require('@expo/vector-icons').Ionicons;
  } catch {
    RealIonicons = null;
  }
}

// ── Web mapping: Ionicons name → geometric Icon name ─────────────────────
const ICON_MAP: Record<string, IconName> = {
  // navigation
  'arrow-back': 'arrow-left',
  'arrow-forward': 'arrow-right',
  'chevron-back': 'chevron-left',
  'chevron-forward': 'chevron-right',
  'chevron-down': 'chevron-down',
  'navigate': 'arrow-right',
  'navigate-outline': 'arrow-right',

  // actions
  close: 'close',
  'close-circle': 'close-circle',
  'close-circle-outline': 'close-circle',
  checkmark: 'check',
  'checkmark-circle': 'check',
  add: 'plus',

  // places / map
  location: 'pin',
  'location-outline': 'pin',
  locate: 'crosshair',
  'locate-outline': 'crosshair',
  map: 'map',
  'map-outline': 'map',
  compass: 'compass',
  'compass-outline': 'compass',

  // person / settings
  person: 'person',
  'person-outline': 'person',
  people: 'person',
  'people-outline': 'person',
  settings: 'sliders',
  'settings-outline': 'sliders',
  options: 'sliders',
  'options-outline': 'sliders',

  // bookmarks
  bookmark: 'bookmark',
  'bookmark-outline': 'bookmark',
  heart: 'bookmark',
  'heart-outline': 'bookmark',

  // status (no dedicated glyph yet — fall back to ring/triangle)
  'alert-circle': 'triangle',
  'alert-circle-outline': 'triangle',
  warning: 'triangle',
  ellipse: 'dot',
  star: 'triangle',
  radio: 'dot',

  // communication / auth (neutral ring)
  'mail-outline': 'ring',
  'lock-closed-outline': 'ring',
  'logo-google': 'ring',

  // reports / misc
  megaphone: 'triangle',
  'megaphone-outline': 'triangle',
  calendar: 'ring',
  'calendar-outline': 'ring',
  'pricetag-outline': 'triangle',
  'flag-outline': 'triangle',
  'time-outline': 'ring',
  'cloud-offline-outline': 'ring',
  'cloud-done-outline': 'check',
  'shield-checkmark-outline': 'check',
  'open-outline': 'arrow-right',
  send: 'arrow-right',
};

// minimal glyphMap shim — preserves `keyof typeof Ionicons.glyphMap` on web
export const glyphMap: Record<string, number> = Object.keys(ICON_MAP).reduce(
  (acc, key) => {
    acc[key] = 0;
    return acc;
  },
  {} as Record<string, number>,
);
if (RealIonicons && (RealIonicons as any).glyphMap) {
  Object.assign(glyphMap, (RealIonicons as any).glyphMap);
}

// ── Component ────────────────────────────────────────────────────────────
interface SafeIoniconsProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle | ViewStyle>;
}

function SafeIonicons({
  name,
  size = 24,
  color = '#EDEBE3',
  style,
}: SafeIoniconsProps): React.ReactElement {
  // Native delegates to real Ionicons when available
  if (Platform.OS !== 'web' && RealIonicons) {
    return (
      <RealIonicons
        name={name}
        size={size}
        color={color}
        style={style as StyleProp<TextStyle>}
      />
    );
  }

  // Web: geometric Icon for mapped names, neutral dot otherwise
  const mapped = ICON_MAP[name];
  if (mapped) {
    return (
      <View style={style as StyleProp<ViewStyle>}>
        <Icon name={mapped} size={size} color={color} />
      </View>
    );
  }

  // Unmapped → tiny centred dot.  Intentionally boring — forces us to map
  // real icon names as the design evolves instead of leaking emoji.
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
      <Text style={{ fontSize: size * 0.6, lineHeight: size, color, textAlign: 'center' }}>
        ·
      </Text>
    </View>
  );
}

SafeIonicons.glyphMap = glyphMap;

export { SafeIonicons as Ionicons };
export default SafeIonicons;
