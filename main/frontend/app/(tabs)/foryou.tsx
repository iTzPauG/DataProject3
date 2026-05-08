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
  fixed?: boolean;
  trending?: boolean;
  newish?: boolean;
  // tags para calcular afinidad con el perfil del usuario
  affinityTags?: string[];
  // tags que reducen probabilidad (si el usuario los tiene en dislikes)
  dislikeTags?: string[];
}

const ALL_SECTIONS: SectionConfig[] = [
  { title: 'Tendencias',        emoji: '🔥', query: 'restaurante popular Valencia',        fixed: true, trending: true },
  { title: 'Pizzerías',         emoji: '🍕', query: 'pizzeria restaurante',                affinityTags: ['pizza','italiana'],                                    dislikeTags: [] },
  { title: 'Hamburguesas',      emoji: '🍔', query: 'hamburguesa restaurante',             affinityTags: ['hamburguesa','burger'],                                dislikeTags: ['hamburguesa','burger','fast food'] },
  { title: 'Sushi',             emoji: '🍱', query: 'sushi japones restaurante',           affinityTags: ['sushi','japonés','asiático','ramen','poke'],            dislikeTags: ['sushi','japonés','asiático'] },
  { title: 'Cafés & Brunch',    emoji: '☕', query: 'cafe brunch desayuno',                affinityTags: ['brunch','café','coffee','desayuno'],                    dislikeTags: [] },
  { title: 'Vegano / Saludable',emoji: '🌱', query: 'vegano saludable restaurante',        affinityTags: ['vegano','saludable','healthy','vegan','orgánico'],      dislikeTags: ['vegano','saludable','healthy'] },
  { title: 'Abiertos de noche', emoji: '🌙', query: 'restaurante nocturno',                affinityTags: ['nocturno','noche','bar','copas'],                       dislikeTags: [] },
  { title: 'Para una cita',     emoji: '🎯', query: 'restaurante romantico cena',          affinityTags: [],                                                      dislikeTags: [] },
  { title: 'Familiar',          emoji: '👨‍👩‍👧', query: 'restaurante familiar',            affinityTags: [],                                                      dislikeTags: [] },
  { title: 'Instagrameables',   emoji: '📸', query: 'restaurante bonito moderno',          affinityTags: ['moderno','fusión','instagrameable'],                    dislikeTags: [] },
  { title: 'Terrazas',          emoji: '🍹', query: 'restaurante terraza',                 affinityTags: ['terraza','exterior'],                                  dislikeTags: [] },
  { title: 'Lo más nuevo',      emoji: '✨', query: 'restaurante reciente nuevo Valencia',  affinityTags: [],                                                      dislikeTags: [], newish: true },
  { title: 'Comida Rápida',     emoji: '🍟', query: 'comida rapida burger fast food Valencia', affinityTags: ['fast food','comida rápida'],                       dislikeTags: ['fast food','comida rápida','mcdonalds','montaditos'] },
] as (SectionConfig & { newish?: boolean })[];

// Calcula el peso de cada sección según el perfil del usuario
function getRandomSections(): SectionConfig[] {
  const fixedSections = ALL_SECTIONS.filter(s => s.fixed);
  const randomSections = ALL_SECTIONS.filter(s => !s.fixed);
  return [...fixedSections, ...randomSections];
}

// Perfil hardcodeado de usuario para la sección "Como te gustó X"
const MOCK_USER_PROFILE = {
  saved:        ['Nozomi Sushi Bar', 'Koku Kitchen', 'La Salita'],
  recentViews:  ['Nozomi', 'Lateral Valencia', 'Ohana Poke', 'Vuelve Carolina', 'Ramen Kagura'],
  likes:        ['Nozomi Sushi Bar', 'Ohana Poke', 'Lateral Valencia'],
  dislikes:     ['McDonald\'s Valencia', '100 Montaditos'],
  exploreCategories: ['sushi', 'tapas', 'brunch'],
};

// Deriva una query de búsqueda a partir del perfil del usuario
function buildPersonalizedQuery(): string {
  // Inferir gustos de los likes + guardados: sushi/poke/moderno
  const positiveNames = [...MOCK_USER_PROFILE.saved, ...MOCK_USER_PROFILE.likes];
  const hasSushi   = positiveNames.some(n => /sushi|nozomi|takami/i.test(n));
  const hasPoke    = positiveNames.some(n => /poke|ohana/i.test(n));
  const hasModern  = positiveNames.some(n => /lateral|koku|salita/i.test(n));
  const cats       = MOCK_USER_PROFILE.exploreCategories;

  const terms: string[] = [];
  if (hasSushi) terms.push('sushi japonés');
  if (hasPoke)  terms.push('poke');
  if (hasModern) terms.push('moderno fusión');
  cats.forEach(c => { if (!terms.join(' ').includes(c)) terms.push(c); });
  terms.push('Valencia');
  return terms.join(' ');
}

// ── Collaborative filtering (clustering) ─────────────────────────────────────
// Cada cluster tiene un centroide (tags) y los restaurantes que sus usuarios
// han dado like/guardado. El usuario actual se asigna al cluster más cercano
// por intersección de tags, y se recomiendan restaurantes de ese cluster.

interface UserCluster {
  id: string;
  tags: string[];           // centroide del cluster
  poolQueries: string[];    // queries que representan los likes colectivos del cluster
}

const CLUSTERS: UserCluster[] = [
  {
    id: 'asiatico',
    tags: ['sushi', 'ramen', 'poke', 'japonés', 'asiático', 'fusión', 'nozomi', 'koku', 'ohana', 'kagura'],
    poolQueries: ['sushi japonés Valencia', 'ramen poke asiático Valencia', 'restaurante japonés moderno Valencia'],
  },
  {
    id: 'tradicional',
    tags: ['tapas', 'paella', 'terraza', 'vino', 'español', 'mediterráneo', 'pepica', 'lateral', 'kaymus', 'carolina'],
    poolQueries: ['tapas terraza mediterráneo Valencia', 'restaurante español tradicional Valencia', 'paella mariscos Valencia'],
  },
  {
    id: 'healthy',
    tags: ['vegano', 'brunch', 'saludable', 'café', 'orgánico', 'ensalada', 'smoothie', 'healthy', 'vegan'],
    poolQueries: ['restaurante vegano saludable Valencia', 'brunch café orgánico Valencia', 'healthy bowl ensalada Valencia'],
  },
];

// Convierte el perfil del usuario en un vector de tags
function getUserTags(): string[] {
  const all = [
    ...MOCK_USER_PROFILE.saved,
    ...MOCK_USER_PROFILE.likes,
    ...MOCK_USER_PROFILE.exploreCategories,
    ...MOCK_USER_PROFILE.recentViews,
  ].join(' ').toLowerCase();
  return all.split(/[\s,]+/);
}

// Asigna el usuario al cluster con mayor intersección de tags
function assignCluster(): UserCluster {
  const userTags = getUserTags();
  let best = CLUSTERS[0];
  let bestScore = 0;
  for (const cluster of CLUSTERS) {
    const score = cluster.tags.filter(t => userTags.some(ut => ut.includes(t) || t.includes(ut))).length;
    if (score > bestScore) { bestScore = score; best = cluster; }
  }
  return best;
}

// Elige aleatoriamente una de las queries del cluster asignado
function buildTribeQuery(): string {
  const cluster = assignCluster();
  const queries = cluster.poolQueries;
  return queries[Math.floor(Math.random() * queries.length)];
}

// Sección "¿Te atreves?" — restaurantes de categorías con 0 afinidad con el usuario
// Elige las 3 categorías más lejanas y mezcla sus queries en una sola búsqueda
function buildSurpriseQuery(): string {
  const userTags = getUserTags().join(' ');
  const distant = ALL_SECTIONS
    .filter(s => !s.fixed)
    .filter(s => (s.affinityTags ?? []).filter(t => userTags.includes(t)).length === 0)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const pool = distant.length > 0 ? distant : ALL_SECTIONS.filter(s => !s.fixed).sort(() => Math.random() - 0.5).slice(0, 3);
  // Combina keywords de las categorías lejanas para una búsqueda variada
  return pool.map(s => s.query.split(' ')[0]).join(' ') + ' Valencia';
}

// Tendencias: 60% volumen de reseñas + 40% rating + bonus viral
// + pequeño bonus por palabras clave virales en reseñas (máx +0.1)
const TRENDING_KEYWORDS = ['increíble', 'espectacular', 'imprescindible', 'lleno', 'cola', 'viral', 'amazing', 'incredible', 'must', 'packed', 'queue', 'incroyable', 'génial'];
function trendingScore(r: RestaurantDBResult): number {
  const rating = r.metadata?.rating ?? 0;
  const count = r.metadata?.user_rating_count ?? 0;
  const countScore = Math.log10(count + 1);
  // 60% volumen + 40% rating, ambos normalizados
  const base = (countScore / 4) * 0.6 + (rating / 5) * 0.4;
  const reviews: string[] = ((r as any).google_reviews ?? []).map((rv: any) => (rv.text ?? '').toLowerCase());
  const allText = reviews.join(' ');
  const hits = TRENDING_KEYWORDS.filter(kw => allText.includes(kw)).length;
  const bonus = Math.min(hits * 0.02, 0.1);
  return base + bonus;
}

// "Lo más nuevo": pocas reseñas + palabras en reseñas que sugieren novedad
const NEWISH_KEYWORDS = ['nuevo', 'nueva', 'recién', 'reciente', 'abierto', 'inaugurado', 'estreno', 'new', 'just opened', 'recently opened', 'brand new', 'nouveau'];
function newishScore(r: RestaurantDBResult): number {
  const count = r.metadata?.user_rating_count ?? 0;
  // Penaliza sitios con muchas reseñas (más antiguos)
  const freshnessScore = 1 / Math.log10(count + 2);
  const reviews: string[] = ((r as any).google_reviews ?? []).map((rv: any) => (rv.text ?? '').toLowerCase());
  const allText = reviews.join(' ');
  const hits = NEWISH_KEYWORDS.filter(kw => allText.includes(kw)).length;
  const bonus = hits * 0.2;
  return freshnessScore + bonus;
}

interface SectionRowProps {
  title: string;
  emoji: string;
  query: string;
  lat: number;
  lng: number;
  trending?: boolean;
  surprise?: boolean;
  newish?: boolean;
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
  trending,
  surprise,
  newish,
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
        const sorted = trending
          ? [...results].sort((a, b) => trendingScore(b) - trendingScore(a)).slice(0, 10)
          : surprise
          ? [...results].sort(() => Math.random() - 0.5).slice(0, 20)
          : newish
          // "Lo más nuevo": pocas reseñas + keywords de novedad en reseñas
          ? [...results].sort((a, b) => newishScore(b) - newishScore(a))
          : results;
        setRestaurants(sorted);
      } catch (e) {
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [query, lat, lng, trending]);

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
    const photoUrl = restaurant.metadata?.photo_url;
    const fullPhotoUrl = photoUrl?.startsWith('/') ? `${RESTAURANT_DB_URL}${photoUrl}` : photoUrl;
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
          metadata: {
            ...restaurant.metadata,
            photo_url: fullPhotoUrl,
            google_reviews: (restaurant as any).google_reviews ?? [],
            user_rating_count: restaurant.metadata?.user_rating_count,
          },
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
        // Bad: lluvia/tormenta (51-99), nublado/muy nublado (2-3), o precipitación activa
        const isBadWeather = precipitation > 0 || (code >= 51 && code <= 99) || code === 2 || code === 3;
        // Good: despejado o casi despejado (0-1) sin precipitación
        const isGoodWeather = !isBadWeather && (code === 0 || code === 1);
        if (isBadWeather) {
          setWeatherSection({ title: 'Para refugiarse', emoji: '🌧️', query: 'restaurante interior acogedor' });
        } else if (isGoodWeather) {
          setWeatherSection({ title: 'Terrazas al sol', emoji: '☀️', query: 'restaurante terraza exterior' });
        } else {
          setWeatherSection(null);
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

          {/* Dynamic Sections */}
          {/* First section (Tendencias) */}
          {sectionsRef.current.slice(0, 1).map((section) => (
            <SectionRow
              key={section.query}
              title={section.title}
              emoji={section.emoji}
              query={section.query}
              lat={location.lat}
              lng={location.lng}
              trending={section.trending}
              colors={colors}
              typography={typography}
              radii={radii}
              shadows={shadows}
              onRestaurantPress={handleRestaurantPress}
            />
          ))}
          {/* Second fixed section — personalized */}
          <SectionRow
            key="personalized"
            title="Como te gustó X"
            emoji="✨"
            query={buildPersonalizedQuery()}
            lat={location.lat}
            lng={location.lng}
            colors={colors}
            typography={typography}
            radii={radii}
            shadows={shadows}
            onRestaurantPress={handleRestaurantPress}
          />
          {/* Third fixed section — collaborative filtering */}
          <SectionRow
            key="tribe"
            title="Tu tribu recomienda"
            emoji="👥"
            query={buildTribeQuery()}
            lat={location.lat}
            lng={location.lng}
            colors={colors}
            typography={typography}
            radii={radii}
            shadows={shadows}
            onRestaurantPress={handleRestaurantPress}
          />
          {/* Fourth fixed section — surprise / out of comfort zone */}
          <SectionRow
            key="surprise"
            title="¿Te atreves? 🎲"
            emoji="🎲"
            query={buildSurpriseQuery()}
            lat={location.lat}
            lng={location.lng}
            surprise
            colors={colors}
            typography={typography}
            radii={radii}
            shadows={shadows}
            onRestaurantPress={handleRestaurantPress}
          />
          {/* Weather Section — after Tendencias */}
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
          {/* Remaining sections */}
          {sectionsRef.current.slice(1).map((section) => (
            <SectionRow
              key={section.query}
              title={section.title}
              emoji={section.emoji}
              query={section.query}
              lat={location.lat}
              lng={location.lng}
              trending={section.trending}
              newish={(section as any).newish}
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
