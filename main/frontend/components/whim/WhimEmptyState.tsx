import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import { whimTheme } from '../../constants/whimTheme';

export const WhimEmptyState = ({ conflictingFilter = 'Romántico', onRemoveFilter, onReset }: { conflictingFilter?: string, onRemoveFilter?: () => void, onReset?: () => void }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 150, easing: Easing.linear }),
        withTiming(-10, { duration: 150, easing: Easing.linear }),
        withTiming(0, { duration: 150, easing: Easing.linear }),
        withTiming(0, { duration: 1000 }) // pause
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }]
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        <Text style={styles.emoji}>🍽️</Text>
        <Text style={styles.questionMark}>❓</Text>
      </Animated.View>

      <Text style={styles.title}>Esta combo no tiene mucho rollo 😅</Text>
      <Text style={styles.subtitle}>Prueba a cambiar algo — estos filtros no se llevan bien.</Text>

      <View style={styles.conflictBadge}>
        <Text style={styles.conflictText}>Filtro problemático: <Text style={styles.highlight}>{conflictingFilter}</Text></Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onRemoveFilter} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Quitar filtro más raro</Text>
        </Pressable>

        <Pressable onPress={onReset} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Empezar de nuevo</Text>
        </Pressable>
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
    padding: 32,
  },
  iconContainer: {
    marginBottom: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
  },
  questionMark: {
    fontSize: 40,
    position: 'absolute',
    top: -10,
    right: -10,
  },
  title: {
    fontFamily: whimTheme.fonts.display,
    color: whimTheme.colors.text.primary,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  conflictBadge: {
    backgroundColor: '#FF4D4D15',
    borderWidth: 1,
    borderColor: '#FF4D4D50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 40,
  },
  conflictText: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 14,
  },
  highlight: {
    color: '#FFD166', // amber
    fontWeight: 'bold',
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: whimTheme.colors.surface,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: whimTheme.colors.accent.teal + '40',
  },
  primaryButtonText: {
    fontFamily: whimTheme.fonts.display,
    color: whimTheme.colors.accent.teal,
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 16,
  }
});
