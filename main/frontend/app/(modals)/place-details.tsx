import { useTranslation } from "react-i18next";
import { Ionicons } from '../../components/SafeIonicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LiveCommentsSection from '../../components/LiveCommentsSection';
import LiveDataAddon from '../../components/LiveDataAddon';
import ReviewList from '../../components/ReviewList';
import VoteButtons from '../../components/VoteButtons';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { fetchPlaceExtra, getPlaceData, toggleBookmark } from '../../services/api';
import { formatDistance } from '../../utils/format';
import { useTheme } from '../../utils/theme';

const CATEGORY_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  food:       { color: '#FF6B35', icon: '🍴', label: 'Comida' },
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
  music:      { color: '#A855F7', icon: '🎵', label: 'Música' },
  report:     { color: '#EF4444', icon: '📢', label: 'Aviso' },
};

const DEFAULT_STYLE = { color: '#9E9E9E', icon: '📍', label: 'Lugar' };

export default function PlaceDetailsModal() {
  const { t } = useTranslation();
  const { id, prefill } = useLocalSearchParams<{ id: string; prefill?: string }>();
  const { colors, typography, shadows, radii } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { nearbyItems } = useAppState();
  const { recordRecentView } = useUserProfile();
  const bookmarkedIds: string[] = []; // Default fallback since it's missing from AppState

  const [loadingExtra, setLoadingExtra] = useState(true);
  const [placeTake, setPlaceTake] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [voteData, setVoteData] = useState<any>(null);
  const [parsedPlaceData, setParsedPlaceData] = useState<any>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loadingBookmark, setLoadingBookmark] = useState(false);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.shell },
    circleButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.soft,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
      marginBottom: 8,
    },
    metaValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    infoText: {
      fontSize: 15,
      color: colors.ink,
      fontFamily: typography.body,
      flex: 1,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginVertical: 12,
    },
    voteContainer: {
      marginVertical: 20,
      padding: 16,
      backgroundColor: colors.bg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    statBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.chip,
      alignSelf: 'flex-start',
    },
    statText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.mono,
    },
    emptyText: {
      fontSize: 16,
      color: colors.inkMuted,
      marginTop: 12,
      fontFamily: typography.body,
    },
  }), [colors, typography, shadows]);

  useEffect(() => {
    async function loadData() {
      setLoadingExtra(true);
      try {
        let currentItem = nearbyItems.find(i => i.item_id === id);
        if (!currentItem && prefill) {
          try { const p = JSON.parse(prefill as string); setParsedPlaceData(p); currentItem = p; } catch {}
        }
        if (!currentItem) {
          const baseData = await getPlaceData(id);
          if (baseData) { setParsedPlaceData(baseData); currentItem = baseData; }
        }

        // Record this view in the local recent-views buffer used by Para ti.
        if (currentItem?.title && currentItem.item_type === 'place') {
          const subcat = (currentItem.metadata as any)?.subcategory;
          void recordRecentView(
            id,
            currentItem.title,
            typeof subcat === 'string' ? [subcat] : undefined,
          );
        }

        // Now fetch enrichment with full metadata context
        const extraPayload = currentItem ? {
          lat: currentItem.lat,
          lng: currentItem.lng,
          name: currentItem.title,
          category: currentItem.category_id,
          ...currentItem.metadata
        } : {};
        const extra = await fetchPlaceExtra(id, extraPayload);
        if (extra) {
          if (!extra.take) {
            console.warn('[place-details] take returned null for', id, extraPayload);
          }
          setPlaceTake(extra.take);
          setLiveData(extra.live);
          setVoteData(extra.vote);
        }
      } catch (err) {
        console.error('Error fetching details:', err);
      } finally {
        setLoadingExtra(false);
      }
    }
    loadData();
  }, [id, nearbyItems, prefill, recordRecentView]);

  useEffect(() => {
    setIsBookmarked((bookmarkedIds ?? []).includes(id));
  }, [bookmarkedIds, id]);

  async function handleToggleBookmark() {
    if (!user) {
      Alert.alert(t('auth.signIn'), t('placeDetails.bookmarkSignInHint') || 'Debes iniciar sesión para guardar lugares');
      return;
    }
    if (!item) return;
    setLoadingBookmark(true);
    try {
      await toggleBookmark(id, item.item_type, isBookmarked);
      setIsBookmarked(!isBookmarked);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      Alert.alert(t('common.error'), message);
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
  const distance = item?.distance_m && item.distance_m > 0 ? formatDistance(item.distance_m) : '';
  const startsAt = item?.metadata?.starts_at as string | undefined;
  const endsAt = item?.metadata?.ends_at as string | undefined;
  const priceInfo = item?.metadata?.price_info as string | undefined;
  const reportType = item?.metadata?.report_type as string | undefined;
  const confidence = item?.metadata?.confidence as number | undefined;
  const confirmations = item?.metadata?.confirmations as number | undefined;
  const expiresAt = item?.metadata?.expires_at as string | undefined;
  const description = item?.metadata?.description as string | undefined;

  /**
   * Brutally honest client-side fallback when the backend LLM take is missing.
   * Runs a small heuristic over the Google reviews already in metadata so we
   * never end up showing "Análisis no disponible" — at minimum the user sees
   * the rating context plus signal extracted from reviews.
   *
   * Honesty rules (mirror the backend prompt):
   *  - If rating is high but most reviews are short / lukewarm → flag mixed signal.
   *  - Cons are pulled from low-rated reviews (≤3) when available; if not, from
   *    any review that explicitly mentions slow service, overpricing, etc.
   *  - Pros are only included when they contain a SPECIFIC mention (food name,
   *    service descriptor, price/value); generic praise like "muy bueno" gets dropped.
   */
  const fallbackTake = useMemo(() => {
    if (!item || item.item_type !== 'place') return null;
    const rating = (item.metadata?.rating as number | undefined) ?? null;
    const reviews = ((item.metadata as any)?.google_reviews ?? []) as Array<{ text?: string; rating?: number }>;
    if (rating == null && reviews.length === 0) return null;

    const lowRated = reviews.filter(r => (r.rating ?? 5) <= 3).length;
    const reviewCount = reviews.length;
    const hasMixedSignal = rating != null && rating >= 4.2 && lowRated >= Math.max(1, Math.floor(reviewCount * 0.25));

    const verdict = (() => {
      if (rating == null) return 'Sin nota disponible — el análisis se basa solo en reseñas individuales.';
      if (hasMixedSignal) {
        return `★ ${rating.toFixed(1)} de media, pero ${lowRated} de ${reviewCount} reseñas son críticas — la nota engaña, lee abajo antes de fiarte.`;
      }
      if (rating >= 4.6) return `★ ${rating.toFixed(1)} con ${reviewCount} reseñas — el consenso es claro, pero sigue habiendo matices que conviene leer.`;
      if (rating >= 4.2) return `★ ${rating.toFixed(1)} (${reviewCount} reseñas) — bien valorado en general, sin grandes alarmas.`;
      if (rating >= 3.5) return `★ ${rating.toFixed(1)} (${reviewCount} reseñas) — opiniones partidas: lee tanto las buenas como las malas antes de ir.`;
      return `★ ${rating.toFixed(1)} (${reviewCount} reseñas) — críticas frecuentes y patrones negativos repetidos. Pasa de largo salvo que no tengas alternativa.`;
    })();

    // Specific positives only. We require either a noun-like signal (sushi, pizza,
    // servicio, atención…) OR a strong superlative paired with a concrete detail.
    const SPECIFIC_POSITIVE = /(servicio|atenci[oó]n|trato|sushi|pizza|pasta|carne|postre|vino|cerveza|terraza|ambiente|carta|menú|men[ñn]u|precio|relación calidad|relaci[oó]n calidad|napolitana|fresc[oa])/i;
    const STRONG_POSITIVE = /(brutal|excelente|delici[oa]|increíble|incre[ií]ble|espectacular|recomend|el mejor|los mejores|fant[aá]stic|wonderful|outstanding)/i;
    const NEGATIVE_PATTERNS = /(tarde|tard[oó]|fría|frío|fri[oa]|caro|car[ií]simo|sucio|lent[oa]|esperar|cola|peor|horrible|nada del otro mundo|del montón|mediocre|regular|nothing special|slow|cold|overpriced|rude|not worth)/i;

    const pros: string[] = [];
    const cons: string[] = [];
    const seen = new Set<string>();

    for (const r of reviews.slice(0, 8)) {
      const text = (r.text || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 22 && s.length < 200);
      for (const raw of sentences) {
        const s = raw.trim();
        const key = s.slice(0, 40).toLowerCase();
        if (seen.has(key)) continue;

        if (
          pros.length < 2 &&
          (r.rating ?? 5) >= 4 &&
          STRONG_POSITIVE.test(s) &&
          SPECIFIC_POSITIVE.test(s)
        ) {
          pros.push(s);
          seen.add(key);
          continue;
        }
        if (
          cons.length < 2 &&
          NEGATIVE_PATTERNS.test(s) &&
          ((r.rating ?? 5) <= 3 || hasMixedSignal)
        ) {
          cons.push(s);
          seen.add(key);
        }
      }
    }

    return { verdict, pros, cons };
  }, [item]);

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

  if (!item && !loadingExtra) {
    return (
      <SafeAreaView style={[dynamicStyles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ marginTop: 20, color: colors.ink }}>{t('placeDetails.notFound')}</Text>
        <TouchableOpacity style={{ marginTop: 40, padding: 12 }} onPress={() => router.back()}>
          <Text style={{ color: colors.brand }}>{t('common.close')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={dynamicStyles.circleButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>
          {item && (
            <TouchableOpacity
              style={dynamicStyles.circleButton}
              onPress={handleToggleBookmark}
              activeOpacity={0.7}
              disabled={loadingBookmark}
              accessibilityLabel={t('common.save')}
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
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: catStyle.color + '20' }]}>
                <Text style={styles.photoPlaceholderIcon}>{catStyle.icon}</Text>
              </View>
            )}

            <View style={[styles.badge, { backgroundColor: catStyle.color }]}>
              <Text style={styles.badgeText}>{catStyle.icon} {t(`category.${item.category_id}`) || catStyle.label}</Text>
            </View>

            <Text style={dynamicStyles.title}>{item.title}</Text>

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

            {address ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.inkMuted} />
                <Text style={dynamicStyles.infoText}>{address}</Text>
              </View>
            ) : null}

            {(item.item_type === 'place' || item.item_type === 'event') && (
              <View style={dynamicStyles.voteContainer}>
                <VoteButtons
                  itemId={id}
                  itemType={item.item_type as 'place' | 'event'}
                  initial={voteData}
                  title={t('vote.worthIt')}
                />
              </View>
            )}

            {item.item_type === 'place' && (() => {
              // Effective take: prefer backend LLM result, fall back to a
              // client-side synthesis from rating + Google reviews. Hide the
              // card entirely only if both are missing AND we're not still
              // loading.
              const effective = placeTake || fallbackTake;
              if (!loadingExtra && !effective) return null;
              return (
              <View style={styles.takeCard}>
                <Text style={styles.sectionEyebrow}>{t('placeDetails.whimTake')}</Text>
                {loadingExtra && !effective ? (
                  <View style={styles.takeLoading}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={styles.takeLoadingText}>{t('placeDetails.analyzing')}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.takeVerdict}>{effective?.verdict || (effective as any)?.why}</Text>
                    {(effective?.pros || []).length > 0 && (
                      <>
                        <Text style={styles.takeBlockTitle}>{t('placeDetails.theBest')}</Text>
                        {effective?.pros.map((pro: string) => (
                          <View key={pro} style={styles.takeRow}>
                            <Ionicons name="thumbs-up-outline" size={16} color={colors.success} />
                            {renderBoldText(pro, styles.takeText)}
                          </View>
                        ))}
                      </>
                    )}
                    {(effective?.cons || []).length > 0 && (
                      <>
                        <Text style={[styles.takeBlockTitle, styles.takeBlockTitleWarn]}>{t('placeDetails.watchOut')}</Text>
                        {effective?.cons.map((con: string) => (
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
              );
            })()}

            <ReviewList reviews={(placeTake?.reviews as any[] | undefined) || item.metadata?.google_reviews as any[] || []} />

            {item.item_type === 'place' && (
              <LiveCommentsSection
                placeId={id}
                placeName={item.title}
                lat={item.lat}
                lng={item.lng}
              />
            )}

            {liveData && <LiveDataAddon data={liveData} />}

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
                        {Math.round(confidence * 100)}% {t('reportDetails.confidenceLevel')}
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  headerButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  photo: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
  photoPlaceholder: { width: '100%', height: 160, borderRadius: 16, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderIcon: { fontSize: 48 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaStar: { fontSize: 14, color: '#FFCC00' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reportStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  takeCard: { marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: '#171A2A', gap: 10 },
  sectionEyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#7C6CF2' },
  takeVerdict: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#F2F0EA' },
  takeBlockTitle: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#A7F3D0' },
  takeBlockTitleWarn: { color: '#FDE68A' },
  takeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  takeText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#D6D9E6' },
  takeLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  takeLoadingText: { fontSize: 14, color: '#A8AEC7' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
});
