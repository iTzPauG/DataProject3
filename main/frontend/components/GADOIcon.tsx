import React from "react";
import { Image, Platform, StyleProp, View, ViewStyle } from "react-native";
import { iconIndex } from "../assets/icons/index";
import Icon, { IconName } from "./Icon";
import CategoryMonogram from "./CategoryMonogram";

interface GADOIconProps {
  category?: string;
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "image" | "button";
}

// ── Native-only Ionicons delegate ────────────────────────────────────────
let IoniconComponent: React.ComponentType<{
  name: string;
  size: number;
  color: string;
}> | null = null;
if (Platform.OS !== 'web') {
  try {
    IoniconComponent = require('@expo/vector-icons').Ionicons;
  } catch {
    IoniconComponent = null;
  }
}

// ── Legacy name → Ionicons glyph (used on native only) ───────────────────
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

// ── Web: legacy names → geometric Icon names ─────────────────────────────
// Everything not in this list renders as a CategoryMonogram (if we can guess
// a label) or a neutral dot — NEVER an emoji.
const WEB_ICON_MAP: Record<string, IconName> = {
  // navigation / wayfinding
  map: 'map',
  explore: 'compass',
  compass: 'compass',
  nearby: 'arrow-right',
  navigate: 'arrow-right',
  pin: 'pin',
  location: 'pin',

  // actions
  add: 'plus',
  report_tab: 'plus',
  close: 'close',
  checkmark: 'check',
  search: 'search',

  // people / profile
  person: 'person',
  people: 'person',
  family: 'person',
  group: 'person',
  team: 'person',
  individual: 'person',

  // bookmarks
  favorites: 'bookmark',
  bookmark: 'bookmark',
  heart: 'bookmark',

  // status (no dedicated glyph — fall back to ring/triangle/dot)
  warning: 'triangle',
  'alert-circle': 'triangle',
  urgent: 'triangle',
  ellipse: 'dot',
  'volume-mute': 'dot',
};

// ── Categories that should render as a monogram on web ───────────────────
// (Matches categoryAccents keys + a handful of sub-category aliases.)
const MONOGRAM_CATEGORIES = new Set<string>([
  'food', 'restaurant', 'nightlife', 'shopping', 'health', 'nature',
  'culture', 'sport', 'cinema', 'event', 'market', 'music', 'services',
  'pets', 'automotive', 'education', 'wellness', 'coworking',
]);

function resolveAsset(category: string | undefined, name: string): number | null {
  const directKey = `${category ?? "generic"}:${name}`;
  const categoryKey = category ? `${category}:default` : "";
  return iconIndex[directKey] ?? (categoryKey ? iconIndex[categoryKey] : undefined) ?? null;
}

export function GADOIcon({
  category,
  name,
  size = 24,
  color = "#EDEBE3",
  style,
  accessibilityLabel,
  accessibilityRole = "image",
}: GADOIconProps): React.ReactElement {
  // 1. Prefer the hand-authored raster asset (no emoji risk).
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

  // 2. Native: delegate to real Ionicons.
  if (Platform.OS !== 'web' && IoniconComponent) {
    const glyph =
      IONICONS_GLYPHS[name] ??
      (category ? IONICONS_GLYPHS[category] : undefined) ??
      "ellipse";
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

  // 3. Web: geometric Icon if we know the name.
  const iconName = WEB_ICON_MAP[name] ?? (category ? WEB_ICON_MAP[category] : undefined);
  if (iconName) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
      >
        <Icon name={iconName} size={size} color={color} />
      </View>
    );
  }

  // 4. Web: category-ish → monogram ring.
  const monogramKey =
    (category && MONOGRAM_CATEGORIES.has(category) && category) ||
    (MONOGRAM_CATEGORIES.has(name) && name) ||
    null;
  if (monogramKey) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        style={style}
      >
        <CategoryMonogram
          categoryId={monogramKey}
          label={monogramKey}
          size={size}
          variant="ring"
        />
      </View>
    );
  }

  // 5. Last resort: neutral ring. Forces us to map real names as the design
  //    evolves instead of ever falling back to emoji.
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Icon name="dot" size={size} color={color} />
    </View>
  );
}

export default GADOIcon;
