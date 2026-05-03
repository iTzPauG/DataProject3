import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolateColor,
  Easing
} from 'react-native-reanimated';
import { whimTheme } from '../../constants/whimTheme';

const LOADING_PHRASES = [
  "Revisando qué dicen los locales de verdad...",
  "Consultando a los mejores rincones de Valencia...",
  "Casi listo, encontrando tu plan perfecto..."
];

export const WhimLoadingScreen = ({ activeFilters = [], loadingPhase = 'searching' }: { activeFilters?: string[], loadingPhase?: string }) => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const progress = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) });
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0, { duration: 1000 })), -1, true);

    const interval = setInterval(() => {
      setPhraseIndex(i => (i + 1) % LOADING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`
  }));

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(glow.value, [0, 1], [whimTheme.colors.accent.teal, whimTheme.colors.accent.violet]),
    shadowColor: interpolateColor(glow.value, [0, 1], [whimTheme.colors.accent.teal, whimTheme.colors.accent.violet]),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Animated.View style={[styles.progressBar, progressStyle]} />
      </View>
      
      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, glowStyle]}>
          <Text style={styles.icon}>🍕🍸🍣🍔</Text>
        </Animated.View>
        
        <View style={styles.chipsContainer}>
          {activeFilters.length > 0 ? (
            activeFilters.map((filter, i) => (
              <Animated.View key={i} style={[styles.chip, glowStyle]}>
                <Text style={styles.chipText}>{filter}</Text>
              </Animated.View>
            ))
          ) : (
            <Animated.View style={[styles.chip, glowStyle]}>
              <Text style={styles.chipText}>Buscando...</Text>
            </Animated.View>
          )}
        </View>
        
        <View accessibilityLiveRegion="polite" style={styles.textContainer}>
          <Text style={styles.title}>Preparando tu lista</Text>
          <Text style={styles.subtitle}>{LOADING_PHRASES[phraseIndex]}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: whimTheme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: whimTheme.colors.surface,
  },
  progressBar: {
    height: '100%',
    backgroundColor: whimTheme.colors.accent.teal,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: whimTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  icon: {
    fontSize: 48,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  chip: {
    backgroundColor: whimTheme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    color: whimTheme.colors.text.primary,
    fontFamily: whimTheme.fonts.body,
    fontSize: 14,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: whimTheme.fonts.display,
    color: whimTheme.colors.text.primary,
    fontSize: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  }
});
