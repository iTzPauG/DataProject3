import { Ionicons } from '../../components/SafeIonicons';
import { router } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import GADOIcon from '../../components/GADOIcon';
import { ExploreCategory, getExploreCategories } from '../../services/api';
import { useTheme } from '../../utils/theme';

// 1. IMPORTAMOS EL NUEVO CARRUSEL AQUÍ:
import LiveDealsCarousel from '../../components/LiveDealsCarousel';

export default function ExploreTab() {
  const { colors, typography, radii, shadows } = useTheme();
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
    seeAllText: {
      fontSize: 14,
      color: colors.brand,
      fontWeight: '600',
      fontFamily: typography.heading,
    },
    eventsPromo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 18,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 8,
      gap: 14,
      ...shadows.soft,
    },
    eventsPromoIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    eventsPromoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 4,
      fontFamily: typography.heading,
    },
    eventsPromoSub: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
      lineHeight: 16,
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={dynamicStyles.title}>Explorar</Text>
          <Text style={dynamicStyles.subtitle}>Descubre lo mejor de tu ciudad</Text>
        </View>

        {/* Category grid */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. AÑADIMOS EL CARRUSEL AQUÍ (Aparecerá el primero si hay ofertas) */}
          <LiveDealsCarousel />

          {/* Upcoming Events Section */}
          <View style={styles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Próximos Eventos</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/(flow)/explore-list',
                  params: { categoryId: 'event', itemType: 'event', title: 'Eventos' },
                })
              }
            >
              <Text style={dynamicStyles.seeAllText}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={dynamicStyles.eventsPromo}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(flow)/explore-list',
                params: { categoryId: 'event', itemType: 'event', title: 'Eventos' },
              })
            }
            accessibilityLabel="Ver eventos cercanos"
            accessibilityRole="button"
          >
            <View style={dynamicStyles.eventsPromoIcon}>
              <GADOIcon name="event" category="event" size={28} color={colors.brand} accessibilityLabel="Icono de eventos" />
            </View>
            <View style={styles.eventsPromoText}>
              <Text style={dynamicStyles.eventsPromoTitle}>Descubre eventos cercanos</Text>
              <Text style={dynamicStyles.eventsPromoSub}>
                Mercados, conciertos y más en tu ciudad
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Categorías</Text>
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
                    <GADOIcon name={cat.id} category={cat.id} size={28} color={colors.brand} accessibilityLabel={`Icono ${cat.label}`} />
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
  eventsPromoText: {
    flex: 1,
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