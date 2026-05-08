// v2
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useTheme } from '../../utils/theme';
import { getCurrentLocation, searchRestaurantDB, RESTAURANT_DB_URL } from '../../services/api';
import { RestaurantDBResult } from '../../types';
const formatPrice = (p: string) => {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Gratis',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '',
    PRICE_LEVEL_EXPENSIVE: '$',
    PRICE_LEVEL_VERY_EXPENSIVE: '',
  };
  return map[p] ?? p;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// All available sections for random selection
interface SectionConfig {
  title: string;
  emoji: string;
  query: string;
  fixed?: boolean; // If true, always show first
}

const ALL_SECTIONS: SectionConfig[] = [
  { title: 'Tendencias', emoji: '🔥', query: 'restaurante popular Valencia', fixed: true },
  { title: 'Pizzerías', emoji: '🍕', query: 'pizzeria restaurante' },
  { title: 'Hamburguesas', emoji: '🍔', query: 'hamburguesa restaurante' },
  { title: 'Sushi', emoji: '🍱', query: 'sushi japones restaurante' },
  { title: 'Cafés & Brunch', emoji: '☕', query: 'cafe brunch desayuno' },
  { title: 'Vegano / Saludable', emoji: '🌱', query: 'vegano saludable restaurante' },
  { title: 'Abiertos de noche', emoji: '🌙', query: 'restaurante nocturno' },
  { title: 'Para una cita', emoji: '🎯', query: 'restaurante romantico cena' },
  { title: 'Familiar', emoji: '👨‍👩‍👧', query: 'restaurante familiar' },
  { title: 'Instagrameables', emoji: '📸', query: 'restaurante bonito moderno' },
  { title: 'Terrazas', emoji: '🍹', query: 'restaurante terraza' },
  { title: 'Recién abiertos', emoji: '🆕', query: 'restaurante nuevo abierto Valencia' },
];

function getRandomSections(): SectionConfig[] {
  const fixedSections = ALL_SECTIONS.filter(s => s.fixed);
  const randomSections = ALL_SECTIONS.filter(s => !s.fixed);

  // Shuffle and pick 5 random sections
  const shuffled = [...randomSections].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 5);

  // Return fixed sections first, then random selections
  return [...fixedSections, ...selected];
}

interface SectionRowProps {
  title: string;
  emoji: string;
  query: string;
  lat: number;
  lng: number;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  radii: ReturnType<typeof useTheme>['radii'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  onRestaurantPress: (restaurant: RestaurantDBResult) => void;
}

function SectionRow({
  title,
  emoji,
  query,
  lat,
  lng,
  colors,
  typography,
  radii,
  shadows,
  onRestaurantPress,
}: SectionRowProps) {
  const [restaurants, setRestaurants] = useState<RestaurantDBResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        const results = await searchRestaurantDB({
          query,
          lat,
          lng,
          radiusM: 5000,
          useBrain: false,
          category: 'restaurant',
        });
        setRestaurants(results);
      } catch {
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [query, lat, lng]);

  // Don't render if no results
  if (!loading && restaurants.length === 0) {
    return null;
  }

  return (
    <View style={sectionStyles.container}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.emoji}>{emoji}</Text>
        <Text style={[sectionStyles.title, { color: colors.ink, fontFamily: typography.heading }]}>
          {title}
        </Text>
      </View>

      {loading ? (
        <View style={sectionStyles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent || '#E50914'} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={sectionStyles.scrollContent}
        >
          {restaurants.map((restaurant) => (
            <TouchableOpacity
              key={restaurant.id}
              style={[
                sectionStyles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.stroke,
                  borderRadius: radii.md,
                },
              ]}
              onPress={() => onRestaurantPress(restaurant)}
              activeOpacity={0.7}
            >
              {/* Restaurant image or emoji placeholder */}
              <View
                style={[
                  sectionStyles.imageContainer,
                  { backgroundColor: colors.chip },
                ]}
              >
                {restaurant.metadata?.photo_url ? (
                  <Image
                    source={{ uri: restaurant.metadata.photo_url?.startsWith('/') ? `${RESTAURANT_DB_URL}${restaurant.metadata.photo_url}` : restaurant.metadata.photo_url }}
                    style={sectionStyles.image}
                  />
                ) : (
                  <Text style={sectionStyles.emojiPlaceholder}>🍽️</Text>
                )}
              </View>

              {/* Restaurant info */}
              <View style={sectionStyles.info}>
                <Text
                  style={[
                    sectionStyles.name,
                    { color: colors.ink, fontFamily: typography.heading },
                  ]}
                  numberOfLines={2}
                >
                  {restaurant.name}
                </Text>

                {restaurant.metadata?.rating && (
                  <Text style={[sectionStyles.rating, { color: colors.inkMuted }]}>
                    ★ {restaurant.metadata.rating.toFixed(1)}
                    {restaurant.metadata.price_level && ` · ${formatPrice(restaurant.metadata.price_level)}`}
                  </Text>
                )}

                {restaurant.metadata?.distance_m && (
                  <Text style={[sectionStyles.distance, { color: colors.inkMuted }]}>
                    {(restaurant.metadata.distance_m / 1000).toFixed(1)} km
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function ForYouTab() {
  const { colors, typography, radii, shadows } = useTheme();
  const router = useRouter();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [heroRestaurant, setHeroRestaurant] = useState<RestaurantDBResult | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const sectionsRef = useRef<SectionConfig[]>(getRandomSections());
  const [weatherSection, setWeatherSection] = useState<SectionConfig | null>(null);
  const handleRestaurantPress = useCallback((restaurant: RestaurantDBResult) => {
    router.push({
      pathname: '/(modals)/place-details',
      params: {
        id: restaurant.id,
        type: 'place',
        prefill: JSON.stringify({
          item_id: restaurant.id,
          item_type: 'place',
          title: restaurant.name,
          lat: restaurant.lat,
          lng: restaurant.lng,
          category_id: 'restaurant',
          metadata: restaurant.metadata,
        }),
      },
    });
  }, [router]);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getCurrentLocation();
        setLocation(loc);
      } catch {
        // Fallback to Valencia center if location fails
        setLocation({ lat: 39.4699, lng: -0.3763 });
      }
    };

    fetchLocation();
  }, []);


  // Fetch weather and add dynamic section
  useEffect(() => {
    if (!location) return;
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=precipitation,weathercode&timezone=auto`
        );
        const data = await res.json();
        const precipitation = data?.current?.precipitation ?? 0;
        const code = data?.current?.weathercode ?? 0;
        const isBadWeather = precipitation > 0 || (code >= 51 && code <= 99);
        if (isBadWeather) {
          setWeatherSection({ title: 'Para refugiarse', emoji: '🌧️', query: 'restaurante interior acogedor' });
        } else {
          setWeatherSection({ title: 'Terrazas al sol', emoji: '☀️', query: 'restaurante terraza exterior' });
        }
      } catch {
        setWeatherSection(null);
      }
    };
    fetchWeather();
  }, [location]);
  // Fetch hero restaurant from API
  useEffect(() => {
    if (!location) return;

    const fetchHero = async () => {
      setHeroLoading(true);
      try {
        const results = await searchRestaurantDB({
          query: 'restaurante popular Valencia destacado',
          lat: location.lat,
          lng: location.lng,
          radiusM: 5000,
          useBrain: true,
          category: 'restaurant',
        });
        if (results.length > 0) {
          setHeroRestaurant(results[0]);
        }
      } catch {
        setHeroRestaurant(null);
      } finally {
        setHeroLoading(false);
      }
    };

    fetchHero();
  }, [location]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.shell,
        },
        heroContainer: {
          height: SCREEN_HEIGHT * 0.55,
          borderRadius: radii.lg,
          margin: 16,
          overflow: 'hidden',
          ...shadows.soft,
        },
        heroContent: {
          flex: 1,
          justifyContent: 'flex-end',
          padding: 24,
          backgroundColor: 'rgba(0,0,0,0.3)',
        },
        heroSkeleton: {
          backgroundColor: colors.surface,
        },
        heroBadge: {
          backgroundColor: colors.accent || '#E50914',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: radii.md,
          marginBottom: 12,
          alignSelf: 'flex-start',
        },
        heroBadgeText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '700',
          fontFamily: typography.heading,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        heroName: {
          fontSize: 28,
          fontWeight: '800',
          color: '#fff',
          fontFamily: typography.heading,
          marginBottom: 8,
        },
        heroDetails: {
          fontSize: 14,
          color: 'rgba(255,255,255,0.9)',
          fontFamily: typography.body,
        },
      }),
    [colors, typography, radii, shadows]
  );

  if (!location) {
    return (
      <AnimatedTabScene>
        <SafeAreaView style={dynamicStyles.safe} edges={['top']}>
          <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color={colors.accent || '#E50914'} />
          </View>
        </SafeAreaView>
      </AnimatedTabScene>
    );
  }

  return (
    <AnimatedTabScene>
      <SafeAreaView style={dynamicStyles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          {heroLoading ? (
            <View style={[dynamicStyles.heroContainer, dynamicStyles.heroSkeleton]} />
          ) : heroRestaurant ? (
            <TouchableOpacity
              onPress={() => handleRestaurantPress(heroRestaurant)}
              activeOpacity={0.8}
            >
              {heroRestaurant.metadata?.photo_url ? (
                <ImageBackground
                  source={{ uri: heroRestaurant.metadata.photo_url?.startsWith('/') ? `${RESTAURANT_DB_URL}${heroRestaurant.metadata.photo_url}` : heroRestaurant.metadata.photo_url }}
                  style={dynamicStyles.heroContainer}
                >
                  <View style={dynamicStyles.heroContent}>
                    <View style={dynamicStyles.heroBadge}>
                      <Text style={dynamicStyles.heroBadgeText}>Restaurante del día</Text>
                    </View>

                    <Text style={dynamicStyles.heroName}>{heroRestaurant.name}</Text>

                    <Text style={dynamicStyles.heroDetails}>
                      ★ {heroRestaurant.metadata.rating?.toFixed(1)} 
                      {heroRestaurant.metadata.price_level && ` · ${formatPrice(heroRestaurant.metadata.price_level)}`}
                      {heroRestaurant.metadata.distance_m && ` · ${(heroRestaurant.metadata.distance_m / 1000).toFixed(1)}km`}
                    </Text>
                  </View>
                </ImageBackground>
              ) : (
                <View style={dynamicStyles.heroContainer}>
                  <View style={dynamicStyles.heroContent}>
                    <View style={dynamicStyles.heroBadge}>
                      <Text style={dynamicStyles.heroBadgeText}>Restaurante del día</Text>
                    </View>

                    <Text style={dynamicStyles.heroName}>{heroRestaurant.name}</Text>

                    <Text style={dynamicStyles.heroDetails}>
                      ★ {heroRestaurant.metadata?.rating?.toFixed(1)} 
                      {heroRestaurant.metadata?.price_level && ` · ${formatPrice(heroRestaurant.metadata.price_level)}`}
                      {heroRestaurant.metadata?.distance_m && ` · ${(heroRestaurant.metadata.distance_m / 1000).toFixed(1)}km`}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Weather Section */}
          {weatherSection && (
            <SectionRow
              key={weatherSection.query}
              title={weatherSection.title}
              emoji={weatherSection.emoji}
              query={weatherSection.query}
              lat={location.lat}
              lng={location.lng}
              colors={colors}
              typography={typography}
              radii={radii}
              shadows={shadows}
              onRestaurantPress={handleRestaurantPress}
            />
          )}
          {/* Dynamic Sections */}
          {sectionsRef.current.map((section) => (
            <SectionRow
              key={section.query}
              title={section.title}
              emoji={section.emoji}
              query={section.query}
              lat={location.lat}
              lng={location.lng}
              colors={colors}
              typography={typography}
              radii={radii}
              shadows={shadows}
              onRestaurantPress={handleRestaurantPress}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 18,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  card: {
    minWidth: 150,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emojiPlaceholder: {
    fontSize: 40,
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  rating: {
    fontSize: 12,
    marginBottom: 4,
  },
  distance: {
    fontSize: 11,
  },
});
