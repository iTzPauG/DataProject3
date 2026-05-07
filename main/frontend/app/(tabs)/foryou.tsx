import React, { useMemo } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useTheme } from '../../utils/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mock data for the hero restaurant
const MOCK_HERO_RESTAURANT = {
  name: 'La Pepita',
  emoji: '🍕',
  rating: 4.8,
  reviews: 1250,
  distance: 0.8,
  priceLevel: '€€',
  tag: 'Pizza artesanal',
  photo_url: null, // Using emoji for now
};

export default function ForYouTab() {
  const { colors, typography, radii, shadows } = useTheme();

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    heroContainer: {
      height: SCREEN_HEIGHT * 0.55,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      margin: 16,
      padding: 24,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.soft,
    },
    heroEmoji: {
      fontSize: 80,
      marginBottom: 16,
    },
    heroBadge: {
      backgroundColor: colors.accent || '#E50914',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.md,
      marginBottom: 12,
    },
    heroBadgeText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: '700',
      fontFamily: typography.heading,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroName: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
      textAlign: 'center',
      marginBottom: 8,
    },
    heroDetails: {
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
      textAlign: 'center',
    },
    sectionsPlaceholder: {
      padding: 24,
      alignItems: 'center',
    },
    placeholderText: {
      fontSize: 16,
      color: colors.inkMuted,
      fontFamily: typography.body,
      textAlign: 'center',
    },
  }), [colors, typography, radii, shadows]);

  return (
    <AnimatedTabScene>
      <SafeAreaView style={dynamicStyles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={dynamicStyles.heroContainer}>
            <Text style={dynamicStyles.heroEmoji}>{MOCK_HERO_RESTAURANT.emoji}</Text>

            <View style={dynamicStyles.heroBadge}>
              <Text style={dynamicStyles.heroBadgeText}>Restaurante del día</Text>
            </View>

            <Text style={dynamicStyles.heroName}>{MOCK_HERO_RESTAURANT.name}</Text>

            <Text style={dynamicStyles.heroDetails}>
              {MOCK_HERO_RESTAURANT.tag} · {MOCK_HERO_RESTAURANT.priceLevel} · {MOCK_HERO_RESTAURANT.distance}km · ★ {MOCK_HERO_RESTAURANT.rating} ({MOCK_HERO_RESTAURANT.reviews} reseñas)
            </Text>
          </View>

          {/* Placeholder for sections */}
          <View style={dynamicStyles.sectionsPlaceholder}>
            <Text style={dynamicStyles.placeholderText}>Secciones aquí</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});