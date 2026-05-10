// v3 — real-profile-driven personalization
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
import {
  getCurrentLocation,
  getCurrentUserInteractions,
  getSimilarPlacesByTags,
  getTagRecommendations,
  searchRestaurantDB,
  RESTAURANT_DB_URL,
} from '../../services/api';
import type { UserPlaceInteraction, UserVoteInteraction } from '../../services/api';
import { RestaurantDBResult } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useLocation as useDeviceLocation } from '../../hooks/useLocation';
const formatPrice = (p: string | number | null | undefined) => {
  if (p == null) return '';
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Gratis',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '',
    PRICE_LEVEL_EXPENSIVE: '$',
    PRICE_LEVEL_VERY_EXPENSIVE: '',
  };
  return map[String(p)] ?? String(p);
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

interface TribeCluster {
  id: string;
  title: string;
  tags: string[];
  keywords: string[];
}

const TRIBE_CLUSTERS: TribeCluster[] = [
  {
    id: 'urban_foodies',
    title: 'Urban Foodies',
    tags: ['sushi', 'brunch', 'cafe', 'coffee', 'specialty coffee', 'instagrammable', 'terrace', 'fusion', 'asian', 'cocktails', 'trending', 'viral', 'date', 'modern'],
    keywords: ['aesthetic', 'trendy', 'chic', 'date night', 'cool places', 'moderno', 'bonito'],
  },
  {
    id: 'comfort_classics',
    title: 'Comfort Classics',
    tags: ['burger', 'hamburguesa', 'pizza', 'american', 'tex mex', 'italian', 'beer', 'comfort food', 'fast food', 'cheap', 'friendly', 'family'],
    keywords: ['casual', 'amigos', 'rapido', 'conocido', 'comfort'],
  },
  {
    id: 'healthy_green',
    title: 'Healthy & Green',
    tags: ['vegan', 'vegano', 'vegetarian', 'healthy', 'organic', 'fresh', 'salad', 'bowls', 'juice', 'brunch', 'bio'],
    keywords: ['healthy', 'organic', 'fresh', 'fit lifestyle', 'saludable'],
  },
  {
    id: 'night_lovers',
    title: 'Night Lovers',
    tags: ['late_night', 'nightlife', 'bar', 'cocktails', 'rooftop', 'terrace', 'tapas', 'sushi', 'lounge', 'groups', 'social', 'dj'],
    keywords: ['nightlife', 'social', 'cocktails', 'vibes', 'noche', 'copas'],
  },
  {
    id: 'traditional_souls',
    title: 'Traditional Souls',
    tags: ['traditional', 'mediterranean', 'tapas', 'paella', 'seafood', 'arroceria', 'asador', 'family', 'friendly', 'classic', 'spanish'],
    keywords: ['tradicional', 'autentico', 'comida de verdad', 'familiar'],
  },
  {
    id: 'world_explorers',
    title: 'Explorers of the World',
    tags: ['korean', 'thai', 'indian', 'japanese', 'peruvian', 'ethiopian', 'international', 'street food', 'fusion', 'asian', 'sushi', 'ramen'],
    keywords: ['adventurous', 'multicultural', 'descubrir sabores', 'diferente'],
  },
  {
    id: 'cozy_coffee',
    title: 'Cozy Coffee People',
    tags: ['cafe', 'coffee', 'bakery', 'dessert', 'brunch', 'work', 'study', 'cozy', 'calm', 'pastry'],
    keywords: ['cozy', 'chill', 'study', 'work', 'calm vibes', 'tranquilo'],
  },
  {
    id: 'luxury_diners',
    title: 'Luxury Diners',
    tags: ['fine dining', 'premium', 'luxury', 'upscale', 'rooftop', 'wine', 'gourmet', 'steak', 'sushi', 'tasting menu', 'celebration'],
    keywords: ['luxury', 'premium', 'upscale', 'celebration', 'especial'],
  },
  {
    id: 'social_sharers',
    title: 'Social Sharers',
    tags: ['sharing', 'group', 'tapas', 'bbq', 'korean bbq', 'hot pot', 'mexican', 'buffet', 'sports bar', 'friendly', 'family', 'social'],
    keywords: ['group plans', 'compartir', 'social eating', 'grupos'],
  },
  {
    id: 'fast_functional',
    title: 'Fast & Functional',
    tags: ['quick', 'cheap', 'fast food', 'takeaway', 'kebab', 'sandwich', 'poke', 'work', 'affordable', 'practical'],
    keywords: ['quick', 'affordable', 'practical', 'everyday food', 'rapido', 'barato'],
  },
];

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function addWeightedTerms(target: Map<string, number>, terms: Iterable<string>, weight: number) {
  for (const term of terms) {
    const normalized = normalizeToken(term);
    if (!normalized) continue;
    target.set(normalized, (target.get(normalized) ?? 0) + weight);
  }
}

function tokenizeForTribes(text: string | null | undefined): string[] {
  return normalizeToken(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function extractTagTerms(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => normalizeToken(item)).filter(Boolean);
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => normalizeToken(key))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => normalizeToken(part))
      .filter(Boolean);
  }
  return [];
}

function extractInteractionTerms(item: UserPlaceInteraction): string[] {
  const metadata = item.metadata ?? {};
  return [
    ...extractTagTerms(item.tags),
    ...extractTagTerms(metadata.tags),
    ...tokenizeForTribes(item.subcategory),
    ...tokenizeForTribes(item.amenity),
    ...tokenizeForTribes(item.category_id),
    ...tokenizeForTribes(item.title),
  ];
}

function scoreTribe(cluster: TribeCluster, positive: Map<string, number>, negative: Map<string, number>): number {
  const clusterTerms = new Set([...cluster.tags, ...cluster.keywords].map(normalizeToken));
  let score = 0;
  clusterTerms.forEach((term) => {
    score += positive.get(term) ?? 0;
    score -= (negative.get(term) ?? 0) * 1.25;
  });
  return score;
}

function assignTribeFromInteractions(data: Awaited<ReturnType<typeof getCurrentUserInteractions>>): {
  cluster: TribeCluster;
  negativeTags: string[];
  excludeIds: string[];
} | null {
  if (!data) return null;

  const positive = new Map<string, number>();
  const negative = new Map<string, number>();
  const excludeIds = new Set<string>();

  data.interactions.votes.forEach((vote: UserVoteInteraction) => {
    if (vote.item_id) excludeIds.add(vote.item_id);
    const terms = extractInteractionTerms(vote);
    if (vote.vote === 1) {
      addWeightedTerms(positive, terms, 3);
    } else if (vote.vote === -1) {
      addWeightedTerms(negative, terms, 3.5);
    }
  });

  data.interactions.saved_items.forEach((saved) => {
    if (saved.item_id) excludeIds.add(saved.item_id);
    addWeightedTerms(positive, extractInteractionTerms(saved), 2);
  });

  const scored = TRIBE_CLUSTERS
    .map((cluster) => ({ cluster, score: scoreTribe(cluster, positive, negative) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) return null;

  return {
    cluster: best.cluster,
    negativeTags: Array.from(negative.keys()),
    excludeIds: Array.from(excludeIds),
  };
}

// Cuenta cuántos `affinityTags` de una sección coinciden con los positiveTags
// del usuario, restando coincidencias de `dislikeTags`.
function sectionAffinityScore(
  section: SectionConfig,
  positiveTags: Set<string>,
  negativeTags: Set<string>,
): number {
  const pos = (section.affinityTags ?? []).reduce(
    (acc, tag) => acc + (positiveTags.has(tag.toLowerCase()) ? 1 : 0),
    0,
  );
  const neg = (section.dislikeTags ?? []).reduce(
    (acc, tag) => acc + (negativeTags.has(tag.toLowerCase()) || positiveTags.has(tag.toLowerCase()) ? 1 : 0),
    0,
  );
  return pos - neg * 1.2;
}

/**
 * Devuelve las secciones ordenadas por relevancia para el perfil del usuario.
 * - Las marcadas `fixed` van siempre primero (tendencias).
 * - El resto se ordena por `sectionAffinityScore` descendente.
 * - A igualdad de score se aplica un pequeño aleatorio para introducir variedad.
 */
function getOrderedSections(
  positiveTags: Set<string>,
  negativeTags: Set<string>,
): SectionConfig[] {
  const fixedSections = ALL_SECTIONS.filter(s => s.fixed);
  const variable = ALL_SECTIONS.filter(s => !s.fixed);

  const scored = variable
    .map(s => ({
      section: s,
      score: sectionAffinityScore(s, positiveTags, negativeTags) + Math.random() * 0.4,
    }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.section);

  return [...fixedSections, ...scored];
}

/**
 * "¿Te atreves?" — secciones cuyo `affinityTags` tiene cero solape con el
 * perfil del usuario. Mezcla 3 al azar para producir una query variada.
 */
function buildSurpriseQuery(positiveTags: Set<string>, city: string): string {
  const distant = ALL_SECTIONS
    .filter(s => !s.fixed)
    .filter(s => (s.affinityTags ?? []).every(t => !positiveTags.has(t.toLowerCase())))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const pool = distant.length > 0
    ? distant
    : ALL_SECTIONS.filter(s => !s.fixed).sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map(s => s.query.split(' ')[0]).join(' ') + ' ' + city;
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
  loadRestaurants?: () => Promise<RestaurantDBResult[]>;
  lat: number;
  lng: number;
  trending?: boolean;
  surprise?: boolean;
  newish?: boolean;
  /** Optional one-line subtitle shown under the section title. */
  subtitle?: string;
  /** Search radius in meters. Defaults to 5000. */
  radiusM?: number;
  /** Maximum number of cards to display. */
  maxItems?: number;
  /** Mutable Set of restaurant ids already shown in earlier sections. */
  seenIdsRef?: React.MutableRefObject<Set<string>>;
  /**
   * If true, the section will NOT filter out restaurants whose ids are already
   * in `seenIdsRef`, but will still add its own results to it. Used for the
   * top "Tendencias" row so it always renders even when the hero / earlier
   * sections happened to surface the same places.
   */
  feedDedupeOnly?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  radii: ReturnType<typeof useTheme>['radii'];
  onRestaurantPress: (restaurant: RestaurantDBResult) => void;
}

function SectionRow({
  title,
  emoji,
  query,
  loadRestaurants,
  lat,
  lng,
  trending,
  surprise,
  newish,
  subtitle,
  radiusM,
  maxItems,
  seenIdsRef,
  feedDedupeOnly,
  colors,
  typography,
  radii,
  onRestaurantPress,
}: SectionRowProps) {
  const [restaurants, setRestaurants] = useState<RestaurantDBResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        const results = loadRestaurants
          ? await loadRestaurants()
          : await searchRestaurantDB({
              query,
              lat,
              lng,
              radiusM: radiusM ?? 5000,
              useBrain: false,
              category: 'restaurant',
            });
        let sorted = trending
          ? [...results].sort((a, b) => trendingScore(b) - trendingScore(a)).slice(0, 10)
          : surprise
          ? [...results].sort(() => Math.random() - 0.5).slice(0, 20)
          : newish
          ? [...results].sort((a, b) => newishScore(b) - newishScore(a))
          : results;

        // De-duplicate: drop restaurants that earlier sections already rendered,
        // unless this section is in feed-only mode (used by Tendencias so it
        // always shows, even if its top items overlap with the hero).
        if (seenIdsRef) {
          if (!feedDedupeOnly) {
            sorted = sorted.filter(r => !seenIdsRef.current.has(r.id));
          }
          sorted.forEach(r => seenIdsRef.current.add(r.id));
        }

        if (maxItems != null) sorted = sorted.slice(0, maxItems);
        setRestaurants(sorted);
      } catch (e) {
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, [query, loadRestaurants, lat, lng, trending, seenIdsRef, feedDedupeOnly, radiusM, maxItems]);

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
      {subtitle ? (
        <Text
          style={{
            color: colors.inkMuted,
            fontFamily: typography.body,
            fontSize: 12,
            marginLeft: 16,
            marginBottom: 8,
            opacity: 0.85,
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}

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
  const auth = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [heroRestaurant, setHeroRestaurant] = useState<RestaurantDBResult | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [weatherSection, setWeatherSection] = useState<SectionConfig | null>(null);
  const [likedBaseName, setLikedBaseName] = useState<string | null>(null);
  const [likedSimilarRestaurants, setLikedSimilarRestaurants] = useState<RestaurantDBResult[]>([]);
  const [tribeCluster, setTribeCluster] = useState<TribeCluster | null>(null);
  const [tribeRestaurants, setTribeRestaurants] = useState<RestaurantDBResult[]>([]);

  // Real user signals: bookmarks (cloud) + saved pins (local) + recent views.
  const profile = useUserProfile();
  // Detected city via reverse geocoding (handled inside useLocation).
  const deviceLocation = useDeviceLocation();
  const city = deviceLocation.city || 'Valencia';

  // Sections re-ordered by affinity. Recomputed only when the profile changes
  // so users don't see the order shuffle every render.
  const sectionsRef = useRef<SectionConfig[]>(getOrderedSections(profile.positiveTags, profile.negativeTags));
  const lastTagsKey = useRef<string>('');
  useEffect(() => {
    const key = `${Array.from(profile.positiveTags).sort().join(',')}|${Array.from(profile.negativeTags).sort().join(',')}`;
    if (key === lastTagsKey.current) return;
    lastTagsKey.current = key;
    sectionsRef.current = getOrderedSections(profile.positiveTags, profile.negativeTags);
  }, [profile.positiveTags, profile.negativeTags]);

  // De-duplication ref shared across all SectionRow children. Reset every time
  // the location changes (so a new city starts with a clean slate).
  const seenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    seenIdsRef.current = new Set();
  }, [location?.lat, location?.lng]);

  const loadLikedSimilarRestaurants = useCallback(async () => {
    if (!auth.user?.uid || !location) {
      setLikedBaseName(null);
      return [];
    }

    const data = await getCurrentUserInteractions();
    const likedVotes = data?.interactions.votes.filter((vote) => {
      if (vote.vote !== 1 || !vote.item_id) return false;
      const category = (vote.category_id || vote.item_type || '').toLowerCase();
      return category === 'food' || category === 'restaurant' || category === 'place';
    }) ?? [];

    for (const liked of likedVotes) {
      const similar = await getSimilarPlacesByTags({
        placeId: liked.item_id,
        lat: location.lat,
        lng: location.lng,
        limit: 20,
      });

      if (similar && similar.recommendations.length > 0) {
        setLikedBaseName(similar.base_place?.name || liked.title || null);
        return similar.recommendations;
      }
    }

    if (likedVotes.length > 0) {
      setLikedBaseName(likedVotes[0].title || null);
      return [];
    }

    setLikedBaseName(null);
    return [];
  }, [auth.user?.uid, location]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLikedBaseName(null);
      setLikedSimilarRestaurants([]);
      const restaurants = await loadLikedSimilarRestaurants();
      if (!cancelled) {
        setLikedSimilarRestaurants(restaurants);
      }
    }

    if (auth.user?.uid && location) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [auth.user?.uid, location, loadLikedSimilarRestaurants]);

  const loadTribeRecommendations = useCallback(async () => {
    if (!auth.user?.uid || !location) return null;

    const data = await getCurrentUserInteractions();
    const assignment = assignTribeFromInteractions(data);
    if (!assignment) return null;

    const response = await getTagRecommendations({
      tags: assignment.cluster.tags,
      negativeTags: assignment.negativeTags,
      excludeIds: assignment.excludeIds,
      lat: location.lat,
      lng: location.lng,
      limit: 20,
    });

    const restaurants = response?.recommendations ?? [];
    if (restaurants.length === 0) return null;

    return {
      cluster: assignment.cluster,
      restaurants,
    };
  }, [auth.user?.uid, location]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setTribeCluster(null);
      setTribeRestaurants([]);
      const result = await loadTribeRecommendations();
      if (!cancelled && result) {
        setTribeCluster(result.cluster);
        setTribeRestaurants(result.restaurants);
      }
    }

    if (auth.user?.uid && location) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [auth.user?.uid, location, loadTribeRecommendations]);

  const handleRestaurantPress = useCallback((restaurant: RestaurantDBResult) => {
    const photoUrl = restaurant.metadata?.photo_url;
    const fullPhotoUrl = photoUrl?.startsWith('/') ? `${RESTAURANT_DB_URL}${photoUrl}` : photoUrl;

    // Record the view locally so future "Para ti" loads bias toward this taste.
    const subcat = (restaurant.metadata as any)?.subcategory;
    void profile.recordRecentView(
      restaurant.id,
      restaurant.name,
      typeof subcat === 'string' ? [subcat] : undefined,
    );

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
  }, [router, profile]);

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

  // Fetch hero restaurant from API. Uses the detected city + a small rotating
  // suffix so the hero isn't identical on every visit.
  useEffect(() => {
    if (!location) return;

    const HERO_VARIANTS = ['popular', 'destacado', 'imprescindible', 'recomendado'];
    const variant = HERO_VARIANTS[Math.floor(Math.random() * HERO_VARIANTS.length)];

    const fetchHero = async () => {
      setHeroLoading(true);
      try {
        const results = await searchRestaurantDB({
          query: `restaurante ${variant} ${city}`,
          lat: location.lat,
          lng: location.lng,
          radiusM: 5000,
          useBrain: true,
          category: 'restaurant',
        });
        if (results.length > 0) {
          setHeroRestaurant(results[0]);
          // We intentionally do NOT add the hero id to seenIdsRef so that the
          // Tendencias row right below can still surface the same place — the
          // visual treatment is different (full-bleed hero vs scrollable card)
          // and downstream sections will dedupe via feedDedupeOnly.
        }
      } catch {
        setHeroRestaurant(null);
      } finally {
        setHeroLoading(false);
      }
    };

    fetchHero();
  }, [location, city]);

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

          {auth.user?.uid && likedBaseName && likedSimilarRestaurants.length > 0 ? (
            <SectionRow
              key={`liked-similar-${auth.user.uid}`}
              title={`Como te gustó ${likedBaseName}`}
              emoji="*"
              query="liked-similar"
              loadRestaurants={() => Promise.resolve(likedSimilarRestaurants)}
              lat={location.lat}
              lng={location.lng}
              maxItems={20}
              seenIdsRef={seenIdsRef}
              colors={colors}
              typography={typography}
              radii={radii}
              onRestaurantPress={handleRestaurantPress}
            />
          ) : null}

          {auth.user?.uid && tribeCluster && tribeRestaurants.length > 0 ? (
            <SectionRow
              key={`tribe-${auth.user.uid}-${tribeCluster.id}`}
              title="A tu tribu le gustó"
              emoji="*"
              subtitle={tribeCluster.title}
              query="tribe-recommendations"
              loadRestaurants={() => Promise.resolve(tribeRestaurants)}
              lat={location.lat}
              lng={location.lng}
              maxItems={20}
              seenIdsRef={seenIdsRef}
              colors={colors}
              typography={typography}
              radii={radii}
              onRestaurantPress={handleRestaurantPress}
            />
          ) : null}

          {/* Dynamic Sections */}
          {/* First section (Tendencias) — always renders, doesn't filter by
              earlier sections, but feeds seenIdsRef for downstream dedupe. */}
          {sectionsRef.current.slice(0, 1).map((section) => (
            <SectionRow
              key={section.query}
              title={section.title}
              emoji={section.emoji}
              query={section.query.replace(/Valencia/gi, city)}
              lat={location.lat}
              lng={location.lng}
              trending={section.trending}
              seenIdsRef={seenIdsRef}
              feedDedupeOnly
              colors={colors}
              typography={typography}
              radii={radii}
              onRestaurantPress={handleRestaurantPress}
            />
          ))}
          {/* Surprise / out of comfort zone */}
          <SectionRow
            key="surprise"
            title="¿Te atreves?"
            emoji="🎲"
            query={buildSurpriseQuery(profile.positiveTags, city)}
            lat={location.lat}
            lng={location.lng}
            surprise
            seenIdsRef={seenIdsRef}
            colors={colors}
            typography={typography}
            radii={radii}
            onRestaurantPress={handleRestaurantPress}
          />
          {/* Weather Section — after Tendencias */}
          {weatherSection && (
            <SectionRow
              key={weatherSection.query}
              title={weatherSection.title}
              emoji={weatherSection.emoji}
              query={`${weatherSection.query} ${city}`}
              lat={location.lat}
              lng={location.lng}
              seenIdsRef={seenIdsRef}
              colors={colors}
              typography={typography}
              radii={radii}
              onRestaurantPress={handleRestaurantPress}
            />
          )}
          {/* Remaining sections — already weighted by affinity */}
          {sectionsRef.current.slice(1).map((section) => (
            <SectionRow
              key={section.query}
              title={section.title}
              emoji={section.emoji}
              query={section.query.replace(/Valencia/gi, city)}
              lat={location.lat}
              lng={location.lng}
              trending={section.trending}
              newish={(section as any).newish}
              seenIdsRef={seenIdsRef}
              colors={colors}
              typography={typography}
              radii={radii}
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
