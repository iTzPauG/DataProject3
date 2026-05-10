import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useFlowState } from '../../hooks/useFlowState';
import { useTheme } from '../../utils/theme';

const FOOD_SUBCATEGORIES = [
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'sushi', label: 'Sushi', emoji: '🍱' },
  { id: 'tapas', label: 'Tapas', emoji: '🥘' },
  { id: 'burgers', label: 'Hamburguesas', emoji: '🍔' },
  { id: 'asian', label: 'Asiática', emoji: '🍜' },
  { id: 'italian', label: 'Italiana', emoji: '🍝' },
  { id: 'mexican', label: 'Mexicana', emoji: '🌮' },
  { id: 'healthy', label: 'Saludable', emoji: '🥗' },
  { id: 'vegan', label: 'Vegano', emoji: '🌱' },
  { id: 'kebab', label: 'Kebab', emoji: '🥙' },
];

export default function ExploreTab() {
  const { t } = useTranslation();
  const { colors, typography, radii, shadows } = useTheme();
  const { reset, setParentCategory, setCategory } = useFlowState();

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.inkMuted,
      lineHeight: 20,
      fontFamily: typography.body,
      marginTop: 4,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 8,
      fontFamily: typography.heading,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.inkMuted,
      lineHeight: 24,
      fontFamily: typography.body,
      textAlign: 'center',
    },
    foodCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.stroke,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 140,
      width: '48%', // Para 2 columnas
      ...shadows.soft,
    },
    foodCardEmoji: {
      fontSize: 32,
      marginBottom: 8,
    },
    foodCardLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      borderRadius: 18,
      padding: 16,
      minHeight: 150,
      ...shadows.soft,
    },
    cardIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    cardLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 4,
      fontFamily: typography.heading,
    },
    cardDescription: {
      fontSize: 12,
      color: colors.inkMuted,
      lineHeight: 16,
      fontFamily: typography.body,
    },
  }), [colors, typography, radii, shadows]);

  function handleFoodSubcatPress(subcatId: string) {
    reset();
    setParentCategory('food');
    setCategory(subcatId);
    router.push('/(flow)/mood');
  }

  return (
    <AnimatedTabScene>
    <SafeAreaView style={dynamicStyles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={dynamicStyles.title}>🍽️ ¿Qué te apetece comer?</Text>
          <Text style={dynamicStyles.subtitle}>{t('explore.subtitle')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Food type selection grid */}
          <View style={styles.foodGrid}>
            {FOOD_SUBCATEGORIES.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={dynamicStyles.foodCard}
                activeOpacity={0.7}
                onPress={() => handleFoodSubcatPress(sub.id)}
                accessibilityLabel={sub.label}
                accessibilityRole="button"
              >
                <Text style={dynamicStyles.foodCardEmoji}>{sub.emoji}</Text>
                <Text style={dynamicStyles.foodCardLabel}>{sub.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
    </AnimatedTabScene>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 12,
  },
  container: {
    flex: 1,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  foodChipsScroll: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 8,
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  cardWrapper: {
    width: '50%',
    padding: 6,
  },
  cardInactive: {
    opacity: 0.6,
  },
  comingSoonBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF4E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
