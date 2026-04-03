import React from "react";
import { Image, Platform, StyleProp, Text, View, ViewStyle } from "react-native";
import { iconIndex } from "../assets/icons/index";

interface GADOIconProps {
  category?: string;
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "image" | "button";
}

let IoniconComponent: React.ComponentType<{ name: string; size: number; color: string }> | null = null;
if (Platform.OS !== 'web') {
  try {
    IoniconComponent = require('@expo/vector-icons').Ionicons;
  } catch {
    IoniconComponent = null;
  }
}

const WEB_GLYPHS: Record<string, string> = {
  map: '🗺', explore: '◎', report_tab: '+', favorites: '♥',
  restaurant: '🍽', moon: '🌙', 'bag-handle': '🛍', medkit: '💊',
  leaf: '🌿', 'color-palette': '🎨', construct: '🔧', barbell: '🏋',
  school: '📚', film: '🎬', flower: '✿', laptop: '💻', paw: '🐾',
  car: '🚗', sparkles: '✦', storefront: '🏪', 'musical-notes': '♪',
  megaphone: '📢', compass: '◎', bookmark: '♥', add: '+',
  'thumbs-up': '👍', 'thumbs-down': '👎', 'alert-circle': '⚠',
  pizza: '🍕', 'fast-food': '🍔', fish: '🐟', nutrition: '🥗',
  wine: '🍷', cafe: '☕', beer: '🍺', disc: '💿', bed: '🛏',
  business: '🏢', walk: '🚶', water: '💧', library: '📚', images: '🖼',
  ticket: '🎫', book: '📖', football: '⚽', basketball: '🏀',
  tennisball: '🎾', flame: '🔥', 'hand-left': '🤚', body: '🧘',
  fist: '✊', mountain: '⛰', flash: '⚡', navigate: '➤', ellipse: '●',
  build: '🔧', clipboard: '📋', happy: '😊', heart: '❤', people: '👥',
  'volume-mute': '🔇', person: '👤', 'game-controller': '🎮',
  diamond: '💎', cash: '💵', wifi: '📶', 'musical-note': '♪',
  fitness: '🏃', yoga: '🧘', running: '🏃', bulb: '💡', kebab: '🥙',
};

const IONICONS_GLYPHS: Record<string, string> = {
  food: "restaurant", restaurant: "restaurant", nightlife: "moon",
  shopping: "bag-handle", health: "medkit", nature: "leaf",
  culture: "color-palette", services: "construct", sport: "barbell",
  education: "school", cinema: "film", wellness: "flower",
  coworking: "laptop", pets: "paw", automotive: "car",
  event: "sparkles", market: "storefront", music: "musical-notes",
  report: "megaphone", pizza: "pizza", hamburger: "fast-food",
  sushi: "fish", tacos: "nutrition", healthy: "nutrition", kebab: "fast-food",
  vegan: "leaf", italian: "wine", asian: "restaurant", coffee: "cafe",
  bakery: "cafe", bar: "beer", club: "disc", pub: "beer",
  cocktail: "wine", lounge: "bed", rooftop: "business",
  live_music: "musical-notes", park: "leaf", beach: "sunny",
  hiking: "walk", garden: "flower", museum: "library", gallery: "images",
  theater: "ticket", library: "book", gym: "barbell", football: "football",
  basketball: "basketball", tennis: "tennisball", pool: "water",
  spa: "water", massage: "hand-left", sauna: "flame", meditation: "flower",
  vet: "medkit", pet_shop: "paw", dog_park: "paw",
  gas_station: "water", fuel: "water", ev_charging: "flash",
  ev_charging_auto: "flash", mechanic: "build", taller: "build",
  car_wash: "water", lavado: "water", parking: "car", tires: "disc",
  neumaticos: "disc", itv: "clipboard", car_repair: "build",
  quick: "flash", casual: "happy", date: "heart", family: "people",
  celebration: "sparkles", chill: "moon", party: "radio", intense: "thunderstorm",
  fun: "happy", urgent: "alert-circle", learn: "bulb", quiet: "volume-mute",
  group: "people", individual: "person", beginner: "school", team: "people",
  wifi: "wifi", action: "flash", comedy: "happy", drama: "ticket",
  kids: "game-controller", premium: "diamond", cheap: "cash",
  nearby: "navigate", map: "map", explore: "compass", favorites: "bookmark",
  report_tab: "add", like: "thumbs-up", dislike: "thumbs-down",
  warning: "alert-circle", padel: "fitness", tenis: "tennisball",
  piscina: "water", baloncesto: "basketball", escalada: "mountain",
  yoga: "body", artes_marciales: "fist", running: "walk",
};

function resolveAsset(category: string | undefined, name: string): number | null {
  const directKey = `${category ?? "generic"}:${name}`;
  const categoryKey = category ? `${category}:default` : "";
  return iconIndex[directKey] ?? (categoryKey ? iconIndex[categoryKey] : undefined) ?? null;
}

export function GADOIcon({
  category,
  name,
  size = 24,
  color = "#FFFFFF",
  style,
  accessibilityLabel,
  accessibilityRole = "image",
}: GADOIconProps): React.ReactElement {
  const asset = resolveAsset(category, name);
  if (asset) {
    return (
      <View 
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        style={[{ width: size, height: size }, style]}
      >
        <Image
          source={asset}
          style={{ width: size, height: size, resizeMode: "contain" }}
        />
      </View>
    );
  }

  const glyph =
    IONICONS_GLYPHS[name] ??
    (category ? IONICONS_GLYPHS[category] : undefined) ??
    "ellipse";

  if (Platform.OS !== 'web' && IoniconComponent) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        style={[
          { width: size, height: size, alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        <IoniconComponent name={glyph} size={size} color={color} />
      </View>
    );
  }

  const unicode = WEB_GLYPHS[glyph] ?? WEB_GLYPHS[name] ?? '●';
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        { width: size, height: size, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.72, lineHeight: size, color, textAlign: 'center' }}>
        {unicode}
      </Text>
    </View>
  );
}

export default GADOIcon;
