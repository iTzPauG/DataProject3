import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  "Casi listo, preparando tu selección final...",
];

const CATEGORY_EMOJIS: Record<string, string[]> = {
  pizza: ["\u{1F355}", "\u{1F9C0}", "\u{1F35D}", "\u{1F37D}"],
  italian: ["\u{1F355}", "\u{1F35D}", "\u{1F9C0}", "\u{1F37D}"],
  burgers: ["\u{1F354}", "\u{1F35F}", "\u{1F96C}", "\u{1F37D}"],
  hamburger: ["\u{1F354}", "\u{1F35F}", "\u{1F96C}", "\u{1F37D}"],
  tapas: ["\u{1F958}", "\u{1F364}", "\u{1F377}", "\u{1F37D}"],
  sushi: ["\u{1F363}", "\u{1F365}", "\u{1F35A}", "\u{1F37D}"],
  tacos: ["\u{1F32E}", "\u{1F32F}", "\u{1F336}", "\u{1F37D}"],
  mexican: ["\u{1F32E}", "\u{1F32F}", "\u{1F37B}", "\u{1F37D}"],
  brunch: ["\u{1F373}", "\u{1F95E}", "\u{1F95E}", "\u{2615}"],
  bakery: ["\u{1F950}", "\u{1F35E}", "\u{1F370}", "\u{2615}"],
  coffee: ["\u{2615}", "\u{1F9CB}", "\u{1F36A}", "\u{1F9C1}"],
  vegan: ["\u{1F331}", "\u{1F966}", "\u{1F957}", "\u{1F34F}"],
  healthy: ["\u{1F957}", "\u{1F95D}", "\u{1F966}", "\u{1F34E}"],
  bar: ["\u{1F37A}", "\u{1F378}", "\u{1F942}", "\u{1F37D}"],
  cocktail: ["\u{1F378}", "\u{1F379}", "\u{1F942}", "\u{1F37D}"],
};

const DEFAULT_EMOJIS = ["\u{1F37D}", "\u{1F374}", "\u{1F355}", "\u{1F37A}"];

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
          withTiming(-14, { duration: 240, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 420 })
        ),
        -1,
        false
      )
    );
  }, [delayMs, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return <Animated.Text style={[stylesStatic.emoji, style]}>{emoji}</Animated.Text>;
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
  const progress = useSharedValue(0);
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
          paddingHorizontal: 18,
        },
        topRail: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundColor: colors.chip,
        },
        topRailProgress: {
          height: "100%",
          backgroundColor: colors.brand,
        },
        heroWrap: {
          width: "100%",
          maxWidth: 540,
          alignItems: "center",
          gap: 16,
        },
        heroCard: {
          width: "100%",
          borderRadius: radii.xl,
          paddingHorizontal: 20,
          paddingVertical: 22,
          borderWidth: 1.5,
          backgroundColor: colors.surface,
          ...shadows.lift,
        },
        heroTitle: {
          textAlign: "center",
          fontFamily: typography.heading,
          color: colors.ink,
          fontSize: 25,
          marginBottom: 8,
          fontWeight: "800",
        },
        heroSubtitle: {
          textAlign: "center",
          fontFamily: typography.body,
          color: colors.inkMuted,
          fontSize: 15,
          lineHeight: 22,
        },
        chipsRow: {
          width: "100%",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
        },
        chip: {
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
        },
        chipText: {
          color: colors.ink,
          fontFamily: typography.body,
          fontSize: 13,
        },
      }),
    [colors, typography, radii, shadows]
  );

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }, 2300);

    return () => clearInterval(interval);
  }, [glow, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(10, progress.value * 100)}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      glow.value,
      [0, 1],
      [colors.stroke, colors.brand]
    ),
    shadowColor: interpolateColor(
      glow.value,
      [0, 1],
      [colors.brandMuted, colors.brand]
    ),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.topRail}>
        <Animated.View style={[styles.topRailProgress, progressStyle]} />
      </View>

      <View style={styles.heroWrap}>
        <Animated.View style={[styles.heroCard, glowStyle]}>
          <View style={stylesStatic.emojiRow}>
            {emojis.map((emoji, index) => (
              <BouncingEmoji key={`${emoji}-${index}`} emoji={emoji} delayMs={index * 120} />
            ))}
          </View>
          <Text style={styles.heroTitle}>Preparando restaurantes para ti</Text>
          <Text style={styles.heroSubtitle}>{LOADING_PHRASES[phraseIndex]}</Text>
        </Animated.View>

        <View style={styles.chipsRow}>
          {activeFilters.length > 0 ? (
            activeFilters.map((filter, i) => (
              <Animated.View key={`${filter}-${i}`} style={[styles.chip, glowStyle]}>
                <Text style={styles.chipText}>{filter}</Text>
              </Animated.View>
            ))
          ) : (
            <Animated.View style={[styles.chip, glowStyle]}>
              <Text style={styles.chipText}>Buscando opciones...</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const stylesStatic = StyleSheet.create({
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  emoji: {
    fontSize: 31,
  },
});
