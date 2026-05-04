import { router } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import WhimIcon from '../../components/WhimIcon';
import { useFlowState } from '../../hooks/useFlowState';
import { ExploreCategory, getExploreCategories } from '../../services/api';
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
  const { colors, typography, radii, shadows } = useTheme();
  const { reset, setParentCategory, setCategory } = useFlowState();
  const [categories, setCategories] = useState<ExploreCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

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
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 4,
      fontFamily: typography.heading,
    },
    subtitle: {
      fontSize: 15,
      color: colors.inkMuted,
      lineHeight: 22,
      fontFamily: typography.body,
    },
    foodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.stroke,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
      ...shadows.soft,
    },
    foodChipEmoji: {
      fontSize: 18,
    },
    foodChipLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
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

  useEffect(() => {
    getExploreCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoadingCategories(false));
  }, []);

  function handleFoodSubcatPress(subcatId: string) {
    reset();
    setParentCategory('food');
    setCategory(subcatId);
    router.push('/(flow)/mood');
  }

  function handleCategoryPress(category: ExploreCategory) {
    if (category.active === false) {
      Alert.alert('Próximamente', 'Esta funcionalidad estará disponible pronto');
      return;
    }
    if (category.id === 'report') {
      router.push('/(tabs)/report');
      return;
    }
    const eventCategories = new Set(['event', 'market', 'music']);
    if (eventCategories.has(category.id)) {
      router.push({
        pathname: '/(flow)/explore-list',
        params: { categoryId: category.id, itemType: 'event', title: category.label },
      });
      return;
    }
    router.push({ pathname: '/(flow)/category', params: { categoryId: category.id } });
  }

  return (
    <AnimatedTabScene>
    <SafeAreaView style={dynamicStyles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={dynamicStyles.title}>Explorar</Text>
          <Text style={dynamicStyles.subtitle}>Descubre lo mejor de tu ciudad</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Food type quick-access */}
          <View style={styles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>¿Qué te apetece comer?</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.foodChipsScroll}
          >
            {FOOD_SUBCATEGORIES.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={dynamicStyles.foodChip}
                activeOpacity={0.7}
                onPress={() => handleFoodSubcatPress(sub.id)}
                accessibilityLabel={sub.label}
                accessibilityRole="button"
              >
                <Text style={dynamicStyles.foodChipEmoji}>{sub.emoji}</Text>
                <Text style={dynamicStyles.foodChipLabel}>{sub.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Other categories */}
          <View style={styles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Más categorías</Text>
          </View>
          {loadingCategories ? (
            <ActivityIndicator
              size="large"
              color={colors.brand}
              style={{ marginTop: 32 }}
            />
          ) : (
            <View style={styles.grid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.cardWrapper}
                  activeOpacity={0.7}
                  onPress={() => handleCategoryPress(cat)}
                  accessibilityLabel={`Categoría ${cat.label}`}
                  accessibilityRole="button"
                >
                  <View style={[dynamicStyles.card, { borderRadius: radii.lg }, cat.active === false && styles.cardInactive]}>
                    <View style={dynamicStyles.cardIcon}>
                      <WhimIcon name={cat.id} category={cat.id} size={28} color={colors.brand} accessibilityLabel={`Icono ${cat.label}`} />
                    </View>
                    <Text style={dynamicStyles.cardLabel}>{cat.label}</Text>
                    {cat.description ? (
                      <Text style={dynamicStyles.cardDescription}>{cat.description}</Text>
                    ) : null}
                    {cat.active === false && (
                      <View style={[styles.comingSoonBadge, { borderRadius: radii.sm }]}>
                        <Text style={styles.comingSoonText}>Pronto</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
    paddingTop: 20,
    paddingBottom: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  foodChipsScroll: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 8,
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
