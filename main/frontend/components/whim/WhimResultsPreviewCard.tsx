import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { whimTheme } from '../../constants/whimTheme';

interface Filter {
  label: string;
  type: 'food' | 'speed' | 'budget' | 'mood';
}

export const WhimResultsPreviewCard = ({ count = 0, filters = [], onMapPress }: { count?: number, filters?: Filter[], onMapPress?: () => void }) => {
  const { t } = useTranslation();
  const slideY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    slideY.value = withSpring(0, whimTheme.animation.spring);
    opacity.value = withTiming(1, { duration: whimTheme.animation.duration.normal });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
    opacity: opacity.value,
  }));

  const getColorForType = (type: string) => {
    switch(type) {
      case 'food': return whimTheme.colors.accent.food;
      case 'speed': return whimTheme.colors.accent.speed;
      case 'budget': return whimTheme.colors.accent.budget;
      case 'mood': return whimTheme.colors.accent.mood;
      default: return whimTheme.colors.accent.teal;
    }
  };

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <Text style={styles.title}>{t('whim.results.title')}</Text>
      <Text style={styles.subtitle}>{t('whim.results.subtitle')}</Text>
      
      <View style={styles.filtersContainer}>
        {filters.map((f, i) => (
          <View key={i} style={[styles.chip, { backgroundColor: getColorForType(f.type) + '20', borderColor: getColorForType(f.type) }]}>
            <Text style={[styles.chipText, { color: getColorForType(f.type) }]}>{f.label}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('whim.results.foundCount', { count })}</Text>
      </View>

      <Pressable onPress={onMapPress} style={styles.buttonContainer}>
        <LinearGradient 
          colors={[whimTheme.colors.accent.teal, whimTheme.colors.accent.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('whim.results.viewMap')}</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.emojiRow}>
        <Text style={styles.emoji}>🍕</Text>
        <Text style={styles.emoji}>🥂</Text>
        <Text style={styles.emoji}>☕</Text>
        <Text style={styles.emoji}>🍱</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: whimTheme.colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: whimTheme.colors.accent.teal + '40',
    shadowColor: whimTheme.colors.accent.teal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
    margin: 16,
  },
  title: {
    fontFamily: whimTheme.fonts.display,
    fontSize: 28,
    color: whimTheme.colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: whimTheme.fonts.body,
    fontSize: 14,
    color: whimTheme.colors.text.secondary,
    marginBottom: 20,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: whimTheme.fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: whimTheme.colors.bg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  badgeText: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: whimTheme.fonts.display,
    color: '#FFF',
    fontSize: 16,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 20,
    opacity: 0.8,
  }
});
