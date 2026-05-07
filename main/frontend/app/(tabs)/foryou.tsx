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
import { getCurrentLocation, searchRestaurantDB } from '../../services/api';
import { RestaurantDBResult } from '../../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// All available sections for random selection
interface SectionConfig {
  title: string;
  emoji: string;
  query: string;
  fixed?: boolean; // If true, always show first
}

const ALL_SECTIONS: SectionConfig[] = [
  { title: 'Tendencias', emoji: '🔥', query: 'trending popular', fixed: true },
  { title: 'Pizzerías', emoji: '🍕', query: 'pizza' },
  { title: 'Hamburguesas', emoji: '🍔', query: 'burger' },
  { title: 'Sushi', emoji: '🍱', query: 'sushi' },
  { title: 'Cafés & Brunch', emoji: '☕', query: 'cafe brunch' },
  { title: 'Vegano / Saludable', emoji: '🌱', query: 'vegan healthy' },
  { title: 'Abiertos de noche', emoji: '🌙', query: 'open night' },
  { title: 'Para una cita', emoji: '🎯', query: 'date romantic' },
  { title: 'Familiar', emoji: '👨‍👩‍👧', query: 'family kids' },
  { title: 'Instagrameables', emoji: '📸', query: 'instagrammable' },
  { title: 'Terrazas', emoji: '🍹', query: 'terrace' },
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
  onRestaurantPress: (id: string) => void;
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
              onPress={() => onRestaurantPress(restaurant.id)}
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
                    source={{ uri: restaurant.metadata.photo_url }}
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
                    {restaurant.metadata.price_level && ` · ${restaurant.metadata.price_level}`}
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

  const handleRestaurantPress = useCallback((id: string) => {
    router.push({ pathname: '/(modals)/place-details', params: { id, type: 'place' } });
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

  // Fetch hero restaurant from API
  useEffect(() => {
    if (!location) return;

    const fetchHero = async () => {
      setHeroLoading(true);
      try {
        const results = await searchRestaurantDB({
          query: 'trending popular destacado',
          lat: location.lat,
          lng: location.lng,
          radiusM: 5000,
          useBrain: true, // Use AI for hero selection
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
              onPress={() => handleRestaurantPress(heroRestaurant.id)}
              activeOpacity={0.8}
            >
              {heroRestaurant.metadata?.photo_url ? (
                <ImageBackground
                  source={{ uri: heroRestaurant.metadata.photo_url }}
                  style={dynamicStyles.heroContainer}
                >
                  <View style={dynamicStyles.heroContent}>
                    <View style={dynamicStyles.heroBadge}>
                      <Text style={dynamicStyles.heroBadgeText}>Restaurante del día</Text>
                    </View>

                    <Text style={dynamicStyles.heroName}>{heroRestaurant.name}</Text>

                    <Text style={dynamicStyles.heroDetails}>
                      ★ {heroRestaurant.metadata.rating?.toFixed(1)} 
                      {heroRestaurant.metadata.price_level && ` · ${heroRestaurant.metadata.price_level}`}
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
                      {heroRestaurant.metadata?.price_level && ` · ${heroRestaurant.metadata.price_level}`}
                      {heroRestaurant.metadata?.distance_m && ` · ${(heroRestaurant.metadata.distance_m / 1000).toFixed(1)}km`}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ) : null}

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