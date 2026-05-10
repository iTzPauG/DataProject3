import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LiveCommentsSection from "../../components/LiveCommentsSection";
import LiveDataAddon from "../../components/LiveDataAddon";
import PrimaryButton from "../../components/PrimaryButton";
import ReviewList from "../../components/ReviewList";
import VoteButtons from "../../components/VoteButtons";
import WhimIcon from "../../components/WhimIcon";
import { useAppState } from "../../hooks/useAppState";
import { useFlowState } from "../../hooks/useFlowState";
import { useUserProfile } from "../../hooks/useUserProfile";
import { MapItem } from "../../types";
import { Restaurant } from "../../types/restaurant";
import { BASE_URL, fetchPlaceExtra, getPlaceData, getPlaceLiveData, getPlaceTake, getVotes, LiveDataResult, VoteData } from "../../services/api";
import { formatDistance, formatPriceLevel, formatRating, formatReviews } from "../../utils/format";
import { resolveI18nLanguage } from "../../utils/language";
import { synthesizeFallbackTake } from "../../utils/placeTake";
import { shareRestaurant } from "../../utils/share";
import { storage } from "../../utils/storage";
import { useTheme } from "../../utils/theme";

const SAVED_PINS_KEY = 'whim_saved_pins';

function openDirections(lat: number, lng: number, name: string) {
  const encoded = encodeURIComponent(name);
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encoded}`);
}

function normalizePriceLevel(raw: unknown): 1 | 2 | 3 {
  if (typeof raw === "number") {
    if (raw <= 1) return 1;
    if (raw >= 3) return 3;
    return 2;
  }
  const value = String(raw || "").toUpperCase().trim();
  if (value === "PRICE_LEVEL_INEXPENSIVE") return 1;
  if (value === "PRICE_LEVEL_EXPENSIVE" || value === "PRICE_LEVEL_VERY_EXPENSIVE") return 3;
  return 2;
}

function withAbsolutePhotoUrl(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  return value.startsWith("/") ? `${BASE_URL}${value}` : value;
}

function mapItemToRestaurant(item: MapItem, take?: Restaurant | null): Restaurant {
  const metadata = (item.metadata || {}) as Record<string, unknown>;
  const rating = Number(take?.rating ?? metadata.rating ?? 0);
  const reviewsCount = Number(
    take?.reviewsCount ??
    metadata.user_rating_count ??
    metadata.review_count ??
    0,
  );
  const reviews = Array.isArray(take?.reviews)
    ? take.reviews
    : Array.isArray(metadata.google_reviews)
      ? metadata.google_reviews
          .filter((review) => review && typeof review === "object")
          .map((review: any) => ({
            author: String(review.author || "Anonymous"),
            rating: Number(review.rating || 0),
            text: String(review.text || ""),
            relative_time: String(review.relative_time || ""),
            source: "google" as const,
          }))
      : [];

  return {
    id: String(take?.id || item.item_id),
    name: String(take?.name || item.title || ""),
    priceLevel: normalizePriceLevel(take?.priceLevel ?? metadata.price_level),
    rating: Number.isFinite(rating) ? rating : 0,
    reviewsCount: Number.isFinite(reviewsCount) ? reviewsCount : 0,
    address: String(take?.address || metadata.address || ""),
    phone: String(take?.phone || metadata.phone || ""),
    photoUrl: withAbsolutePhotoUrl(take?.photoUrl || metadata.photo_url),
    tagline: String(take?.tagline || metadata.subcategory || ""),
    why: String(take?.why || ""),
    tags: Array.isArray(take?.tags) ? take.tags : [],
    lat: Number(item.lat || 0),
    lng: Number(item.lng || 0),
    distanceM: Number(item.distance_m || 0),
    bestReviewQuote: String(take?.bestReviewQuote || ""),
    reviewQualityScore: Number(take?.reviewQualityScore || 0.5),
    pros: Array.isArray(take?.pros) ? take.pros : [],
    cons: Array.isArray(take?.cons) ? take.cons : [],
    verdict: String(take?.verdict || ""),
    reviews,
    reviewSources: take?.reviewSources,
    liveData: take?.liveData,
  };
}

export default function DetailsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();
  const { id, prefill } = useLocalSearchParams<{ id: string | string[]; prefill?: string | string[] }>();
  const { results, category, parentCategory } = useFlowState();
  const { nearbyItems } = useAppState();
  const { recordRecentView } = useUserProfile();
  const [voteData, setVoteData] = useState<VoteData | undefined>();
  const [liveData, setLiveData] = useState<LiveDataResult | null>(null);
  const [detailTake, setDetailTake] = useState<any>(null);
  const [fallbackRestaurant, setFallbackRestaurant] = useState<Restaurant | null>(null);
  const [resolvingFallback, setResolvingFallback] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const placeId = Array.isArray(id) ? id[0] : id;
  const flowRestaurant = results?.find((item) => item.id === placeId);
  const restaurant = flowRestaurant ?? fallbackRestaurant;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.shell,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: 32,
        },
        floatingBack: {
          position: "absolute",
          top: 56,
          left: 16,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.1)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 4,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.overlay,
          alignItems: "center",
          justifyContent: "center",
        },
        floatingBackText: {
          color: colors.ink,
          fontSize: 24,
          lineHeight: 26,
        },
        hero: {
          aspectRatio: 16 / 9,
          backgroundColor: colors.chip,
        },
        photo: {
          width: "100%",
          height: "100%",
        },
        photoPlaceholder: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        card: {
          marginHorizontal: 16,
          marginTop: -28,
          borderRadius: radii.xl,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.stroke,
          padding: 20,
          gap: 16,
          ...shadows.lift,
        },
        topRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        },
        headingCopy: {
          flex: 1,
        },
        name: {
          color: colors.ink,
          fontSize: 26,
          lineHeight: 32,
          fontWeight: "800",
          fontFamily: typography.heading,
        },
        subline: {
          color: colors.inkMuted,
          fontSize: 14,
          marginTop: 6,
          fontFamily: typography.body,
        },
        price: {
          color: colors.warning,
          fontSize: 18,
          fontWeight: "700",
          fontFamily: typography.heading,
        },
        ratingRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        ratingPrimary: {
          color: colors.ink,
          fontSize: 15,
          fontWeight: "700",
          fontFamily: typography.heading,
        },
        ratingMeta: {
          color: colors.inkMuted,
          fontSize: 14,
          fontFamily: typography.body,
        },
        metaCard: {
          backgroundColor: colors.chip,
          borderRadius: radii.md,
          padding: 16,
          gap: 8,
        },
        metaTitle: {
          color: colors.inkMuted,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontFamily: typography.heading,
        },
        metaText: {
          color: colors.ink,
          fontSize: 14,
          lineHeight: 20,
          fontFamily: typography.body,
        },
        takeCard: {
          backgroundColor: "#1E2436",
          borderRadius: radii.md,
          padding: 16,
          gap: 10,
        },
        sectionEyebrow: {
          color: "rgba(255,255,255,0.75)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontFamily: typography.heading,
        },
        verdict: {
          color: "#FFFFFF",
          fontSize: 18,
          lineHeight: 26,
          fontWeight: "700",
          fontFamily: typography.heading,
        },
        blockTitle: {
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: "700",
          marginTop: 4,
          fontFamily: typography.heading,
        },
        listRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
        },
        listText: {
          flex: 1,
          color: "#FFFFFF",
          fontSize: 14,
          lineHeight: 20,
          fontFamily: typography.body,
        },
        actions: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
        },
        actionButton: {
          flex: 1,
          minWidth: 110,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.chip,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
        },
        actionPrimary: {
          backgroundColor: colors.brand,
          borderColor: colors.brand,
        },
        actionSaved: {
          borderColor: '#FFD700',
          backgroundColor: 'rgba(255,215,0,0.12)',
        },
        actionPrimaryText: {
          color: colors.surface,
          fontSize: 14,
          fontWeight: "700",
          fontFamily: typography.heading,
        },
        actionSecondaryText: {
          color: colors.ink,
          fontSize: 14,
          fontWeight: "700",
          fontFamily: typography.heading,
        },
        actionSavedText: {
          color: '#FFD700',
          fontSize: 14,
          fontWeight: "700",
          fontFamily: typography.heading,
        },
        notFound: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        },
        notFoundTitle: {
          color: colors.ink,
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 8,
          fontFamily: typography.heading,
        },
        notFoundSub: {
          color: colors.inkMuted,
          textAlign: "center",
          fontSize: 14,
          lineHeight: 20,
          fontFamily: typography.body,
        },
        notFoundButton: {
          width: "100%",
          maxWidth: 280,
          marginTop: 20,
        },
      }),
    [colors, radii, shadows, typography],
  );

  const LIVE_DATA_SUBCATS = new Set(["gas_station", "gasolinera", "fuel", "ev_charging", "ev_charging_auto", "pharmacy"]);
  const LIVE_DATA_CATS = new Set(["cinema", "nature", "sport"]);

  useEffect(() => {
    if (flowRestaurant) {
      setFallbackRestaurant(null);
      setResolvingFallback(false);
      return;
    }
    if (!placeId) {
      setFallbackRestaurant(null);
      setResolvingFallback(false);
      return;
    }

    let cancelled = false;

    const coerceMapItem = (raw: any): MapItem | null => {
      if (!raw || typeof raw !== "object") return null;
      if (raw.item_id && raw.item_type && raw.title) {
        return raw as MapItem;
      }
      if (!raw.id || !raw.name) return null;
      return {
        item_id: String(raw.id),
        item_type: "place",
        title: String(raw.name),
        category_id: String(raw.category_id || "food"),
        lat: Number(raw.lat || 0),
        lng: Number(raw.lng || 0),
        distance_m: Number(raw.distance_m || raw.distanceM || 0),
        metadata: (raw.metadata && typeof raw.metadata === "object") ? raw.metadata : {},
      };
    };

    const resolveSourceItem = async (): Promise<MapItem | null> => {
      const fromNearby = nearbyItems.find((entry) => entry.item_id === placeId);
      if (fromNearby) return fromNearby;

      const rawPrefill = Array.isArray(prefill) ? prefill[0] : prefill;
      if (rawPrefill) {
        try {
          const parsed = JSON.parse(rawPrefill);
          const mapped = coerceMapItem(parsed);
          if (mapped) return mapped;
        } catch {
          // Ignore malformed prefill payloads and try backend lookup.
        }
      }

      const fetched = await getPlaceData(placeId);
      if (fetched) return fetched;
      return null;
    };

    const hydrateFallbackRestaurant = async () => {
      setResolvingFallback(true);
      try {
        const sourceItem = await resolveSourceItem();
        if (!sourceItem || cancelled) {
          if (!cancelled) setFallbackRestaurant(null);
          return;
        }

        const metadata = (sourceItem.metadata || {}) as Record<string, unknown>;
        const seed = mapItemToRestaurant(sourceItem);
        setFallbackRestaurant(seed);

        const normalizedCategory = sourceItem.category_id === "restaurant"
          ? "food"
          : sourceItem.category_id;

        const take = await getPlaceTake({
          placeId: sourceItem.item_id,
          lat: Number(sourceItem.lat || 0),
          lng: Number(sourceItem.lng || 0),
          category: String(normalizedCategory || parentCategory || "food"),
          subcategory: String(metadata.subcategory || category || parentCategory || "food"),
          language: resolveI18nLanguage(i18n.resolvedLanguage || i18n.language),
          name: sourceItem.title,
          address: String(metadata.address || ""),
          photoUrl: withAbsolutePhotoUrl(metadata.photo_url),
          rating: typeof metadata.rating === "number" ? metadata.rating : Number(metadata.rating || 0),
          priceLevel: normalizePriceLevel(metadata.price_level),
          reviewsCount: Number(metadata.user_rating_count || 0),
        });

        if (cancelled || !take) return;
        setDetailTake(take);
        setFallbackRestaurant({
          ...seed,
          ...take,
          id: seed.id,
          lat: seed.lat,
          lng: seed.lng,
          distanceM: seed.distanceM,
          photoUrl: take.photoUrl || seed.photoUrl,
          reviews: Array.isArray(take.reviews) && take.reviews.length > 0 ? take.reviews : seed.reviews,
          pros: Array.isArray(take.pros) && take.pros.length > 0 ? take.pros : seed.pros,
          cons: Array.isArray(take.cons) && take.cons.length > 0 ? take.cons : seed.cons,
          verdict: take.verdict || seed.verdict,
        });
      } catch {
        if (!cancelled) setFallbackRestaurant(null);
      } finally {
        if (!cancelled) setResolvingFallback(false);
      }
    };

    void hydrateFallbackRestaurant();
    return () => {
      cancelled = true;
    };
  }, [category, flowRestaurant, i18n.language, i18n.resolvedLanguage, nearbyItems, parentCategory, placeId, prefill]);

  useEffect(() => {
    if (!restaurant) return;
    const subcat = restaurant.tagline?.trim();
    void recordRecentView(
      restaurant.id,
      restaurant.name,
      subcat ? [subcat] : undefined,
    );
  }, [recordRecentView, restaurant?.id, restaurant?.name, restaurant?.tagline]);

  useEffect(() => {
    if (!placeId) return;
    getVotes(placeId)
      .then((data) => {
        if (data) setVoteData(data);
      })
      .catch(() => {});
  }, [placeId]);

  useEffect(() => {
    setLiveData(null);
    if (!restaurant) return;
    if (restaurant.liveData && restaurant.liveData.type !== "none") {
      setLiveData(restaurant.liveData as LiveDataResult);
      return;
    }
    const sub = category ?? "";
    const cat = parentCategory ?? "";
    if (!LIVE_DATA_SUBCATS.has(sub) && !LIVE_DATA_CATS.has(cat)) return;
    getPlaceLiveData({
      placeId: restaurant.id,
      lat: restaurant.lat,
      lng: restaurant.lng,
      category: cat || undefined,
      subcategory: sub || undefined,
      name: restaurant.name,
      city: undefined,
    })
      .then((result) => {
        setLiveData(result.type !== "none" ? result : null);
      })
      .catch(() => {
        setLiveData(null);
      });
  }, [restaurant?.id, restaurant?.liveData, category, parentCategory]);

  useEffect(() => {
    setDetailTake(null);
    if (!restaurant) return;
    const needsPhone = !restaurant.phone || restaurant.phone.trim().length === 0;
    if (!needsPhone) return;

    fetchPlaceExtra(restaurant.id, {
      lat: restaurant.lat,
      lng: restaurant.lng,
      name: restaurant.name,
      address: restaurant.address,
      rating: restaurant.rating,
      price_level: restaurant.priceLevel,
      user_rating_count: restaurant.reviewsCount,
      category: parentCategory || 'food',
      subcategory: category || parentCategory || 'food',
    })
      .then((extra) => {
        if (extra?.take) setDetailTake(extra.take);
      })
      .catch(() => {});
  }, [restaurant?.id, restaurant?.phone, restaurant?.lat, restaurant?.lng, restaurant?.name, restaurant?.address, restaurant?.rating, restaurant?.priceLevel, restaurant?.reviewsCount, parentCategory, category]);

  // Load saved-pin state from AsyncStorage
  useEffect(() => {
    if (!placeId) return;
    storage.getItem(SAVED_PINS_KEY).then((raw) => {
      const saved: any[] = raw ? JSON.parse(raw) : [];
      setIsSaved(saved.some((s) => s.id === placeId));
    }).catch(() => {});
  }, [placeId]);

  const handleSavePin = async () => {
    if (!restaurant || savingPin) return;
    setSavingPin(true);
    try {
      const raw = await storage.getItem(SAVED_PINS_KEY);
      const saved: any[] = raw ? JSON.parse(raw) : [];
      if (isSaved) {
        const updated = saved.filter((s) => s.id !== restaurant.id);
        await storage.setItem(SAVED_PINS_KEY, JSON.stringify(updated));
        setIsSaved(false);
      } else {
        saved.push({
          id: restaurant.id,
          name: restaurant.name,
          lat: restaurant.lat,
          lng: restaurant.lng,
          photoUrl: restaurant.photoUrl,
          address: restaurant.address,
        });
        await storage.setItem(SAVED_PINS_KEY, JSON.stringify(saved));
        setIsSaved(true);
      }
    } catch {
    } finally {
      setSavingPin(false);
    }
  };

  const renderBoldText = (text: string, baseStyle: any, boldColor: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <Text style={baseStyle}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <Text key={i} style={{ fontWeight: "bold", color: boldColor }}>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          ),
        )}
      </Text>
    );
  };

  if (!restaurant) {
    if (resolvingFallback) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.notFound}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={[styles.notFoundSub, { marginTop: 12 }]}>
              {t("common.loading")}
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Place not found</Text>
          <Text style={styles.notFoundSub}>
            Your search state expired. Start a fresh search to see updated results.
          </Text>
          <View style={styles.notFoundButton}>
            <PrimaryButton label={t("common.close")} onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const distance = restaurant.distanceM > 0 ? formatDistance(restaurant.distanceM) : null;
  const effectivePhone = (detailTake?.phone as string | undefined) || restaurant.phone || "";

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.floatingBack} onPress={() => router.back()}>
        <Text style={styles.floatingBackText}>{"<"}</Text>
      </Pressable>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {restaurant.photoUrl ? (
            <Image
              source={{ uri: restaurant.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <WhimIcon name="restaurant" category="food" size={44} color={colors.brand} />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.name}>{restaurant.name}</Text>
              <Text style={styles.subline}>
                {restaurant.tagline || t("placeDetails.recommended")}
                {distance ? ` · ${distance}` : ""}
              </Text>
            </View>
            <Text style={styles.price}>{formatPriceLevel(restaurant.priceLevel)}</Text>
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.ratingPrimary}>★ {formatRating(restaurant.rating)}</Text>
            <Text style={styles.ratingMeta}>{formatReviews(restaurant.reviewsCount)} {t("common.reviews")}</Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>{t("common.address")}</Text>
            <Text style={styles.metaText}>{restaurant.address}</Text>
            <Text style={styles.metaTitle}>{t("common.phone")}</Text>
            <Text style={styles.metaText}>{effectivePhone || t("common.noPhone")}</Text>
          </View>

          {(() => {
            // Single source of truth for "what to display in the Whim's Take card".
            // 1. Backend take (LLM-generated) is preferred when present and non-empty.
            // 2. Otherwise, synthesize one from the rating + reviews so we never
            //    fall through to "Análisis no disponible".
            const backendTake = {
              verdict: restaurant.verdict || restaurant.why,
              pros: restaurant.pros || [],
              cons: restaurant.cons || [],
            };
            const hasBackend =
              (backendTake.verdict && backendTake.verdict.trim().length > 0) ||
              backendTake.pros.length > 0 ||
              backendTake.cons.length > 0;
            const fallback = hasBackend
              ? null
              : synthesizeFallbackTake({
                  rating: restaurant.rating,
                  reviews: (restaurant.reviews || []) as Array<{ text?: string; rating?: number }>,
                });
            const effective = hasBackend ? backendTake : fallback;
            if (!effective) return null;
            return (
              <View style={styles.takeCard}>
                <Text style={styles.sectionEyebrow}>{t("placeDetails.whimTake")}</Text>
                {effective.verdict ? <Text style={styles.verdict}>{effective.verdict}</Text> : null}
                {effective.pros && effective.pros.length > 0 ? (
                  <>
                    <Text style={styles.blockTitle}>{t("placeDetails.theBest")}</Text>
                    {effective.pros.map((pro) => (
                      <View key={pro} style={styles.listRow}>
                        <WhimIcon name="like" category="feedback" size={14} color={colors.success} />
                        {renderBoldText(pro, styles.listText, "#FFFFFF")}
                      </View>
                    ))}
                  </>
                ) : null}
                {effective.cons && effective.cons.length > 0 ? (
                  <>
                    <Text style={styles.blockTitle}>{t("placeDetails.watchOut")}</Text>
                    {effective.cons.map((con) => (
                      <View key={con} style={styles.listRow}>
                        <WhimIcon name="warning" category="feedback" size={14} color={colors.warning} />
                        {renderBoldText(con, styles.listText, "#FFFFFF")}
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            );
          })()}

          <ReviewList reviews={restaurant.reviews} />

          {liveData && <LiveDataAddon data={liveData} />}

          <VoteButtons itemId={restaurant.id} itemType="place" initial={voteData} />

          <LiveCommentsSection placeId={restaurant.id} placeName={restaurant.name} lat={restaurant.lat} lng={restaurant.lng} />

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, styles.actionPrimary]}
              onPress={() => openDirections(restaurant.lat, restaurant.lng, restaurant.name)}
            >
              <Text style={styles.actionPrimaryText}>{t("common.directions")}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => void shareRestaurant(restaurant)}>
              <Text style={styles.actionSecondaryText}>{t("common.share")}</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => effectivePhone && Linking.openURL(`tel:${effectivePhone}`)}
            >
              <Text style={styles.actionSecondaryText}>{t("common.call")}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, isSaved && styles.actionSaved]}
              onPress={() => void handleSavePin()}
              disabled={savingPin}
            >
              <Text style={isSaved ? styles.actionSavedText : styles.actionSecondaryText}>
                {isSaved ? `★ ${t("common.saved")}` : `☆ ${t("common.save")}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
