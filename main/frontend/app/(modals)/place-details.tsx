import { Ionicons } from '../../components/SafeIonicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';
import { checkBookmark, toggleBookmark, getVotes, VoteData, getPlaceLiveData, LiveDataResult, getPlaceTake } from '../../services/api';
import { formatDistance } from '../../utils/format';
import VoteButtons from '../../components/VoteButtons';
import LiveDataAddon from '../../components/LiveDataAddon';
import ReviewList from '../../components/ReviewList';
import { useTheme } from '../../utils/theme';
import { Restaurant } from '../../types/restaurant';

const CATEGORY_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  food:       { color: '#FF6B35', icon: '🍴', label: 'Comida y bebida' },
  restaurant: { color: '#FF6B35', icon: '🍽️', label: 'Restaurante' },
  nightlife:  { color: '#3B82F6', icon: '🌙', label: 'Ocio nocturno' },
  shopping:   { color: '#10B981', icon: '🛒', label: 'Compras' },
  health:     { color: '#EF4444', icon: '💊', label: 'Salud' },
  nature:     { color: '#22C55E', icon: '🌿', label: 'Naturaleza' },
  culture:    { color: '#F59E0B', icon: '🎭', label: 'Cultura' },
  services:   { color: '#94A3B8', icon: '🛠️', label: 'Servicios' },
  sport:      { color: '#0EA5E9', icon: '⚽', label: 'Deporte' },
  education:  { color: '#8B5CF6', icon: '📚', label: 'Educación' },
  event:      { color: '#EC4899', icon: '🎉', label: 'Evento' },
  market:     { color: '#F97316', icon: '🏪', label: 'Mercado' },
  music:      { color: '#A855F7', icon: '🎵', label: 'Música en vivo' },
  report:     { color: '#EF4444', icon: '📢', label: 'Reporte' },
  cinema:     { color: '#EF4444', icon: '🎬', label: 'Cine' },
};

const DEFAULT_STYLE = { color: '#9E9E9E', icon: '📍', label: 'Lugar' };

export default function PlaceDetailsModal() {
  const { colors, radii, shadows, typography } = useTheme();
  const { id, place_data } = useLocalSearchParams<{ id: string; type: string; place_data?: string }>();
  const { nearbyItems, mapPreferences } = useAppState();
  const { user } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loadingBookmark, setLoadingBookmark] = useState(false);
  const [voteData, setVoteData] = useState<VoteData | undefined>();
  const [liveData, setLiveData] = useState<LiveDataResult | null>(null);
  const [placeTake, setPlaceTake] = useState<Restaurant | null>(null);
  const [loadingTake, setLoadingTake] = useState(false);

  // Parse place_data param if provided (from search results)
  const parsedPlaceData = useMemo(() => {
    if (!place_data) return null;
    try {
      const r = JSON.parse(place_data);
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://restaurant-api-gcfbpra65a-ew.a.run.app';
      const photoUrl = r.metadata?.photo_url;
      return {
        item_id: r.id,
        item_type: r.item_type ?? 'place',
        title: r.name,
        category_id: r.category_id ?? 'food',
        lat: r.lat,
        lng: r.lng,
        distance_m: 0,
        metadata: {
          ...r.metadata,
          photo_url: photoUrl?.startsWith('/') ? `${backendUrl}${photoUrl}` : photoUrl,
          rating: r.metadata?.rating,
          address: r.address ?? r.metadata?.address,
          google_reviews: r.google_reviews ?? r.metadata?.google_reviews ?? [],
        },
      };
    } catch { return null; }
  }, [place_data]);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    circleButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.soft,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 8,
      fontFamily: typography.heading,
    },
    metaValue: {
      fontSize: 14,
      color: colors.inkMuted,
      fontWeight: '500',
      fontFamily: typography.body,
    },
    infoText: {
      fontSize: 14,
      color: colors.inkMuted,
      flex: 1,
      fontFamily: typography.body,
    },
    voteContainer: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.stroke,
    },
    description: {
      fontSize: 14,
      color: colors.inkMuted,
      lineHeight: 20,
      marginTop: 8,
      marginBottom: 12,
      fontFamily: typography.body,
    },
    statBadge: {
      backgroundColor: colors.chip,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.md,
    },
    statText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
  }), [colors, radii, shadows, typography]);

  // Subcategories / categories that have a live-data addon
  const LIVE_DATA_SUBCATS = new Set(['gas_station', 'gasolinera', 'fuel', 'ev_charging', 'ev_charging_auto', 'pharmacy']);
  const LIVE_DATA_CATS    = new Set(['cinema', 'nature', 'sport']);

  useEffect(() => {
    if (id) {
      if (user) checkBookmarkStatus();
      fetchVoteData();
    }
  }, [user, id]);

  useEffect(() => {
    setLiveData(null);
    setPlaceTake(null);
    const foundItem = nearbyItems.find((i) => i.item_id === id);
    if (!foundItem) return;

    if (foundItem.metadata?.liveData && (foundItem.metadata.liveData as any).type !== 'none') {
      setLiveData(foundItem.metadata.liveData as LiveDataResult);
      return;
    }

    const sub = (foundItem.metadata?.subcategory as string | undefined) ?? '';
    const cat = foundItem.category_id ?? '';
    if (LIVE_DATA_SUBCATS.has(sub) || LIVE_DATA_CATS.has(cat)) {
      fetchLiveData(foundItem, sub, cat);
    }
  }, [id, nearbyItems]);

  useEffect(() => {
    const foundItem = nearbyItems.find((i) => i.item_id === id) ?? parsedPlaceData;
    if (!foundItem || foundItem.item_type !== 'place') return;

    let active = true;
    const loadTake = async () => {
      setLoadingTake(true);
      try {
        const language = mapPreferences.language === 'system' ? 'es' : (mapPreferences.language || 'es');
        const take = await getPlaceTake({
          placeId: id,
          lat: foundItem.lat,
          lng: foundItem.lng,
          category: foundItem.category_id,
          subcategory: foundItem.metadata?.subcategory as string | undefined,
          language,
          name: foundItem.title,
          address: foundItem.metadata?.address as string | undefined,
          photoUrl: foundItem.metadata?.photo_url as string | undefined,
          rating: foundItem.metadata?.rating as number | undefined,
          priceLevel: foundItem.metadata?.price_level as number | undefined,
          reviewsCount: foundItem.metadata?.user_rating_count as number | undefined,
        });
        if (active) setPlaceTake(take);
      } finally {
        if (active) setLoadingTake(false);
      }
    };

    void loadTake();
    return () => {
      active = false;
    };
  }, [id, nearbyItems, parsedPlaceData, mapPreferences.language]);

  async function fetchLiveData(foundItem: typeof nearbyItems[0], sub: string, cat: string) {
    try {
      const lat = foundItem.lat;
      const lng = foundItem.lng;
      if (lat == null || lng == null) return;
      const result = await getPlaceLiveData({
        placeId: id,
        lat,
        lng,
        category: cat || undefined,
        subcategory: sub || undefined,
        website: foundItem.metadata?.website as string | undefined,
        name: foundItem.title,
        city: foundItem.metadata?.city as string | undefined,
      });
      setLiveData(result.type !== 'none' ? result : null);
    } catch {
      // silently ignore — addon is non-critical
      setLiveData(null);
    }
  }

  async function fetchVoteData() {
    try {
      const data = await getVotes(id);
      if (data) setVoteData(data);
    } catch (error) {
      console.error('Error fetching votes:', error);
    }
  }

  async function checkBookmarkStatus() {
    try {
      const bookmarked = await checkBookmark(id);
      setIsBookmarked(bookmarked);
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    }
  }

  async function handleToggleBookmark() {
    if (!user) {
      Alert.alert('Inicia sesión', 'Debes iniciar sesión para guardar lugares');
      return;
    }

    if (!item) return;

    setLoadingBookmark(true);
    try {
      await toggleBookmark(id, item.item_type, isBookmarked);
      setIsBookmarked(!isBookmarked);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar favorito';
      Alert.alert('Error', message);
    } finally {
      setLoadingBookmark(false);
    }
  }

  const item = nearbyItems.find((i) => i.item_id === id) ?? parsedPlaceData;
  const catStyle = CATEGORY_STYLES[item?.category_id ?? ''] ?? DEFAULT_STYLE;

  const photoUrl = item?.metadata?.photo_url as string | undefined;
  const rating = item?.metadata?.rating as number | undefined;
  const address = item?.metadata?.address as string | undefined;
  const subcategory = item?.metadata?.subcategory as string | undefined;
  const distance = item?.distance_m && item.distance_m > 0
    ? formatDistance(item.distance_m)
    : '';

  // Event-specific
  const startsAt = item?.metadata?.starts_at as string | undefined;
  const endsAt = item?.metadata?.ends_at as string | undefined;
  const priceInfo = item?.metadata?.price_info as string | undefined;

  // Report-specific
  const reportType = item?.metadata?.report_type as string | undefined;
  const confidence = item?.metadata?.confidence as number | undefined;
  const confirmations = item?.metadata?.confirmations as number | undefined;
  const expiresAt = item?.metadata?.expires_at as string | undefined;
  const description = item?.metadata?.description as string | undefined;

  const renderBoldText = (text: string, baseStyle: any) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <Text style={baseStyle}>
        {parts.map((part, index) =>
          index % 2 === 1 ? (
            <Text key={index} style={{ fontWeight: '700' }}>{part}</Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  if (!item) {
    return (
      <SafeAreaView style={[dynamicStyles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ marginTop: 20, color: colors.ink }}>Lugar no encontrado</Text>
        <TouchableOpacity style={{ marginTop: 40, padding: 12 }} onPress={() => router.back()}>
          <Text style={{ color: colors.brand }}>Cerrar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Close button */}
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={dynamicStyles.circleButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>

          {item && (
            <TouchableOpacity
              style={dynamicStyles.circleButton}
              onPress={handleToggleBookmark}
              activeOpacity={0.7}
              disabled={loadingBookmark}
              accessibilityLabel="Guardar"
              accessibilityRole="button"
            >
              <Ionicons
                name={isBookmarked ? "heart" : "heart-outline"}
                size={24}
                color={isBookmarked ? colors.danger : colors.ink}
              />
            </TouchableOpacity>
          )}
        </View>

        {!item ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.stroke} />
            <Text style={dynamicStyles.emptyText}>No se encontró este lugar</Text>
          </View>
        ) : (
          <>
            {/* Photo */}
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: catStyle.color + '20' }]}>
                <Text style={styles.photoPlaceholderIcon}>{catStyle.icon}</Text>
              </View>
            )}

            {/* Category badge */}
            <View style={[styles.badge, { backgroundColor: catStyle.color }]}>
              <Text style={styles.badgeText}>{catStyle.icon} {catStyle.label}</Text>
            </View>

            {/* Title */}
            <Text style={dynamicStyles.title}>{item.title}</Text>

            {/* Meta row */}
            <View style={styles.metaRow}>
              {rating != null && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaStar}>★</Text>
                  <Text style={dynamicStyles.metaValue}>{rating.toFixed(1)}</Text>
                </View>
              )}
              {distance ? (
                <View style={styles.metaItem}>
                  <Ionicons name="navigate-outline" size={14} color={colors.inkMuted} />
                  <Text style={dynamicStyles.metaValue}>{distance}</Text>
                </View>
              ) : null}
              {subcategory ? (
                <View style={styles.metaItem}>
                  <Text style={dynamicStyles.metaValue}>{subcategory}</Text>
                </View>
              ) : null}
            </View>

            {/* Address */}
            {address ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.inkMuted} />
                <Text style={dynamicStyles.infoText}>{address}</Text>
              </View>
            ) : null}

            {/* Universal Voting */}
            {(item.item_type === 'place' || item.item_type === 'event') && (
              <View style={dynamicStyles.voteContainer}>
                <VoteButtons
                  itemId={id}
                  itemType={item.item_type as 'place' | 'event'}
                  initial={voteData}
                  title="Was this place worth it?"
                />
              </View>
            )}

            {item.item_type === 'place' && (loadingTake || placeTake) && (
              <View style={styles.takeCard}>
                <Text style={styles.sectionEyebrow}>GADO&apos;s Take</Text>
                {loadingTake && !placeTake ? (
                  <View style={styles.takeLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={styles.takeLoadingText}>Analizando reseñas...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.takeVerdict}>{placeTake?.verdict || placeTake?.why}</Text>
                    {(placeTake?.pros || []).length > 0 && (
                      <>
                        <Text style={styles.takeBlockTitle}>Lo mejor</Text>
                        {placeTake?.pros.map((pro) => (
                          <View key={pro} style={styles.takeRow}>
                            <Ionicons name="thumbs-up-outline" size={16} color={colors.success} />
                            {renderBoldText(pro, styles.takeText)}
                          </View>
                        ))}
                      </>
                    )}
                    {(placeTake?.cons || []).length > 0 && (
                      <>
                        <Text style={[styles.takeBlockTitle, styles.takeBlockTitleWarn]}>Ojo con esto</Text>
                        {placeTake?.cons.map((con) => (
                          <View key={con} style={styles.takeRow}>
                            <Ionicons name="warning-outline" size={16} color={colors.warning} />
                            {renderBoldText(con, styles.takeText)}
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Unified Reviews Section */}
            <ReviewList reviews={(placeTake?.reviews as any[] | undefined) || item.metadata?.google_reviews as any[] || []} />

            {/* Live data addon (fuel prices, pharmacy duty, cinema showtimes, EV) */}
            {liveData && <LiveDataAddon data={liveData} />}

            {/* Event info */}
            {item.item_type === 'event' && startsAt && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.inkMuted} />
                <Text style={dynamicStyles.infoText}>
                  {new Date(startsAt).toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {endsAt && ` — ${new Date(endsAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
                </Text>
              </View>
            )}

            {priceInfo && (
              <View style={styles.infoRow}>
                <Ionicons name="pricetag-outline" size={18} color={colors.inkMuted} />
                <Text style={dynamicStyles.infoText}>{priceInfo}</Text>
              </View>
            )}

            {/* Report info */}
            {item.item_type === 'report' && (
              <>
                {reportType && (
                  <View style={styles.infoRow}>
                    <Ionicons name="flag-outline" size={18} color={colors.inkMuted} />
                    <Text style={dynamicStyles.infoText}>{reportType.replace(/_/g, ' ')}</Text>
                  </View>
                )}
                {description && (
                  <Text style={dynamicStyles.description}>{description}</Text>
                )}
                <View style={styles.reportStats}>
                  {confirmations != null && (
                    <View style={dynamicStyles.statBadge}>
                      <Text style={dynamicStyles.statText}>👍 {confirmations}</Text>
                    </View>
                  )}
                  {confidence != null && (
                    <View style={[dynamicStyles.statBadge, { backgroundColor: colors.brand + '15' }]}>
                      <Text style={[dynamicStyles.statText, { color: colors.brand }]}>
                        {Math.round(confidence * 100)}% confianza
                      </Text>
                    </View>
                  )}
                  {expiresAt && (
                    <View style={dynamicStyles.statBadge}>
                      <Text style={dynamicStyles.statText}>
                        ⏱ {new Date(expiresAt).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  photoPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 48,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaStar: {
    fontSize: 14,
    color: '#FFCC00',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  reportStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  takeCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#171A2A',
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7C6CF2',
  },
  takeVerdict: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#F2F0EA',
  },
  takeBlockTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  takeBlockTitleWarn: {
    color: '#FDE68A',
  },
  takeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  takeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#D6D9E6',
  },
  takeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  takeLoadingText: {
    fontSize: 14,
    color: '#A8AEC7',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
});
