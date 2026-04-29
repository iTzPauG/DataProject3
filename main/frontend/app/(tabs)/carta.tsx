import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import GADOIcon from '../../components/GADOIcon';
import PrimaryButton from '../../components/PrimaryButton';
import { useAppState, useFlowState } from '../../hooks/useAppState';
import { getCartaRecommendations, getCurrentLocation } from '../../services/api';
import { CartaRestaurant, CartaSection } from '../../types/carta';
import { formatPriceLevel, formatRating, formatReviews } from '../../utils/format';
import { useTheme } from '../../utils/theme';

function toDetailReadyList(sections: CartaSection[]): CartaRestaurant[] {
  const map = new Map<string, CartaRestaurant>();
  for (const section of sections) {
    for (const restaurant of section.restaurants) {
      if (!map.has(restaurant.id)) {
        map.set(restaurant.id, restaurant);
      }
    }
  }
  return Array.from(map.values());
}

export default function CartaTab() {
  const { colors, typography, radii, shadows } = useTheme();
  const { mapPreferences } = useAppState();
  const { setParentCategory, setResults } = useFlowState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<CartaSection[]>([]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.shell,
        },
        title: {
          fontSize: 30,
          fontWeight: '800',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        subtitle: {
          marginTop: 6,
          fontSize: 14,
          lineHeight: 20,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        sectionTitle: {
          color: colors.ink,
          fontSize: 18,
          fontWeight: '700',
          fontFamily: typography.heading,
          marginBottom: 10,
        },
        card: {
          width: 220,
          marginRight: 12,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...shadows.soft,
        },
        imageWrap: {
          width: '100%',
          height: 124,
          backgroundColor: colors.chip,
        },
        image: {
          width: '100%',
          height: '100%',
        },
        imageFallback: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardBody: {
          padding: 12,
        },
        name: {
          color: colors.ink,
          fontSize: 15,
          fontWeight: '700',
          fontFamily: typography.heading,
        },
        summary: {
          color: colors.inkMuted,
          fontSize: 12,
          lineHeight: 17,
          marginTop: 4,
          minHeight: 34,
          fontFamily: typography.body,
        },
        statsRow: {
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        statsText: {
          fontSize: 12,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        priceText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.warning,
          fontFamily: typography.heading,
        },
        helperText: {
          color: colors.inkMuted,
          textAlign: 'center',
          lineHeight: 20,
          fontFamily: typography.body,
        },
        retryWrap: {
          marginTop: 18,
          width: 220,
        },
        emptyWrap: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 36,
        },
      }),
    [colors, typography, radii, shadows],
  );

  const detailReadyRestaurants = useMemo(() => toDetailReadyList(sections), [sections]);

  const loadCarta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { lat, lng } = await getCurrentLocation();
      const language = mapPreferences.language === 'system' ? 'es' : mapPreferences.language;
      const result = await getCartaRecommendations({ lat, lng, language });
      setSections(result);
      if (result.length === 0) {
        setError('No encontramos secciones ahora mismo. Prueba de nuevo en unos segundos.');
      }
    } catch {
      setSections([]);
      setError('No se pudo cargar carta. Revisa conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [mapPreferences.language]);

  useEffect(() => {
    void loadCarta();
  }, [loadCarta]);

  const openDetails = useCallback(
    (restaurantId: string) => {
      setParentCategory('food');
      setResults(detailReadyRestaurants);
      router.push({ pathname: '/(flow)/details', params: { id: restaurantId } });
    },
    [detailReadyRestaurants, setParentCategory, setResults],
  );

  return (
    <AnimatedTabScene>
      <SafeAreaView style={dynamicStyles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={dynamicStyles.title}>Carta</Text>
            <Text style={dynamicStyles.subtitle}>
              Descubre restaurantes en carruseles personalizados al estilo streaming.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={[dynamicStyles.helperText, { marginTop: 12 }]}>Preparando recomendaciones...</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={dynamicStyles.emptyWrap}>
              <Text style={dynamicStyles.helperText}>{error}</Text>
              <View style={dynamicStyles.retryWrap}>
                <PrimaryButton label="Reintentar" onPress={() => void loadCarta()} />
              </View>
            </View>
          ) : null}

          {!loading && !error
            ? sections.map((section) => (
                <View key={section.id} style={styles.section}>
                  <Text style={dynamicStyles.sectionTitle}>{section.title}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {section.restaurants.map((restaurant) => (
                      <Pressable
                        key={`${section.id}_${restaurant.id}`}
                        style={dynamicStyles.card}
                        onPress={() => openDetails(restaurant.id)}
                      >
                        <View style={dynamicStyles.imageWrap}>
                          {restaurant.photoUrl ? (
                            <Image source={{ uri: restaurant.photoUrl }} style={dynamicStyles.image} resizeMode="cover" />
                          ) : (
                            <View style={dynamicStyles.imageFallback}>
                              <GADOIcon name="restaurant" category="food" size={32} color={colors.brand} />
                            </View>
                          )}
                        </View>

                        <View style={dynamicStyles.cardBody}>
                          <Text style={dynamicStyles.name} numberOfLines={1}>
                            {restaurant.name}
                          </Text>
                          <Text style={dynamicStyles.summary} numberOfLines={2}>
                            {restaurant.summary || restaurant.tagline || 'Recomendado por GADO'}
                          </Text>

                          <View style={dynamicStyles.statsRow}>
                            <Text style={dynamicStyles.statsText}>
                              * {formatRating(restaurant.rating)} · {formatReviews(restaurant.reviewsCount)}
                            </Text>
                            <Text style={dynamicStyles.priceText}>{formatPriceLevel(restaurant.priceLevel)}</Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))
            : null}
        </ScrollView>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  section: {
    marginTop: 10,
    paddingLeft: 18,
  },
});
