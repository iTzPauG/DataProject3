import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../../utils/theme";

const LOADING_PHRASES = [
  "Leyendo reseñas reales para filtrar mejor...",
  "Buscando sitios que encajen contigo de verdad...",
  "Consultando Google, OSM y más fuentes...",
  "Casi listo, preparando tu selección final...",
  "Comprobando valoraciones y distancia...",
];

const CATEGORY_EMOJIS: Record<string, string[]> = {
  pizza: ["🍕", "🧀", "🍝", "🍴"],
  italian: ["🍕", "🍝", "🧀", "🍴"],
  burgers: ["🍔", "🍟", "🥬", "🍴"],
  hamburger: ["🍔", "🍟", "🥬", "🍴"],
  tapas: ["🥘", "🦐", "🍷", "🍴"],
  sushi: ["🍣", "🥢", "🍚", "🍴"],
  tacos: ["🌮", "🌯", "🫔", "🍴"],
  mexican: ["🌮", "🌯", "🫔", "🍴"],
  brunch: ["🥞", "🍳", "🥓", "☕"],
  bakery: ["🥐", "🍞", "🥖", "☕"],
  coffee: ["☕", "🧋", "🍪", "🥐"],
  vegan: ["🌱", "🥗", "🥦", "🍃"],
  healthy: ["🥗", "🍎", "🥦", "🫐"],
  bar: ["🍺", "🍻", "🎵", "🍴"],
  asian: ["🍜", "🥢", "🍱", "🍴"],
  kebab: ["🥙", "🌯", "🧅", "🍴"],
};

const DEFAULT_EMOJIS = ["🍴", "🍽️", "🍕", "🍜"];

function emojisForCategory(selectedCategory?: string | null): string[] {
  if (!selectedCategory) return DEFAULT_EMOJIS;
  return CATEGORY_EMOJIS[selectedCategory.trim().toLowerCase()] ?? DEFAULT_EMOJIS;
}

function BouncingEmoji({ emoji, delayMs }: { emoji: string; delayMs: number }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(-16, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 480 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return <Animated.Text style={[stylesStatic.emoji, style]}>{emoji}</Animated.Text>;
}

// Smooth Material-style indeterminate progress bar — slides left→right, never goes backwards
function IndeterminateBar({ color }: { color: string }) {
  const { width: screenWidth } = useWindowDimensions();
  const BAR_W = screenWidth * 0.4; // 40% of screen width
  const slideX = useSharedValue(-BAR_W);

  useEffect(() => {
    slideX.value = -BAR_W;
    slideX.value = withRepeat(
      withTiming(screenWidth + BAR_W, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
  }, [BAR_W, screenWidth, slideX]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  return (
    <View style={[stylesStatic.progressTrack]}>
      <Animated.View
        style={[
          stylesStatic.progressThumb,
          { width: BAR_W, backgroundColor: color },
          barStyle,
        ]}
      />
    </View>
  );
}

export const WhimLoadingScreen = ({
  activeFilters = [],
  selectedCategory = null,
}: {
  activeFilters?: string[];
  loadingPhase?: string;
  selectedCategory?: string | null;
}) => {
  const { colors, typography, radii, shadows } = useTheme();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const glow = useSharedValue(0);
  const emojis = useMemo(() => emojisForCategory(selectedCategory), [selectedCategory]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.shell,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          gap: 28,
        },
        heroCard: {
          width: "100%",
          maxWidth: 520,
          borderRadius: radii.xl,
          paddingHorizontal: 24,
          paddingVertical: 28,
          borderWidth: 1.5,
          backgroundColor: colors.surface,
          alignItems: "center",
          gap: 12,
          ...shadows.lift,
        },
        heroTitle: {
          textAlign: "center",
          fontFamily: typography.heading,
          color: colors.ink,
          fontSize: 22,
          fontWeight: "800",
          lineHeight: 28,
        },
        heroSubtitle: {
          textAlign: "center",
          fontFamily: typography.body,
          color: colors.inkMuted,
          fontSize: 14,
          lineHeight: 20,
          minHeight: 40,
        },
        chipsRow: {
          width: "100%",
          maxWidth: 520,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
        },
        chip: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          backgroundColor: colors.surface,
        },
        chipText: {
          color: colors.ink,
          fontFamily: typography.body,
          fontSize: 13,
        },
      }),
    [colors, typography, radii, shadows],
  );

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }, 2600);

    return () => clearInterval(interval);
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(glow.value, [0, 1], [colors.stroke, colors.brand]),
    shadowColor: interpolateColor(glow.value, [0, 1], [colors.brandMuted ?? colors.stroke, colors.brand]),
    shadowOpacity: 0.3 + glow.value * 0.2,
    shadowRadius: 8 + glow.value * 8,
    elevation: 4 + glow.value * 4,
  }));

  return (
    <View style={styles.container}>
      <IndeterminateBar color={colors.brand} />

      <Animated.View style={[styles.heroCard, glowStyle]}>
        <View style={stylesStatic.emojiRow}>
          {emojis.map((emoji, index) => (
            <BouncingEmoji key={`${emoji}-${index}`} emoji={emoji} delayMs={index * 130} />
          ))}
        </View>
        <Text style={styles.heroTitle}>Buscando tu próximo restaurante</Text>
        <Text style={styles.heroSubtitle}>{LOADING_PHRASES[phraseIndex]}</Text>
      </Animated.View>

      {activeFilters.length > 0 && (
        <View style={styles.chipsRow}>
          {activeFilters.map((filter, i) => (
            <View key={`${filter}-${i}`} style={styles.chip}>
              <Text style={styles.chipText}>{filter}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const stylesStatic = StyleSheet.create({
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressThumb: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 2,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 34,
  },
});
