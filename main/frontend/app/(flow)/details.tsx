import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import GADOIcon from "../../components/GADOIcon";
import LiveDataAddon from "../../components/LiveDataAddon";
import PrimaryButton from "../../components/PrimaryButton";
import VoteButtons from "../../components/VoteButtons";
import { useFlowState } from "../../hooks/useFlowState";
import { getPlaceLiveData, getVotes, LiveDataResult, VoteData } from "../../services/api";
import { formatDistance, formatPriceLevel, formatRating, formatReviews } from "../../utils/format";
import { shareRestaurant } from "../../utils/share";
import { useTheme } from "../../utils/theme";

function openDirections(lat: number, lng: number, name: string) {
  const encoded = encodeURIComponent(name);
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encoded}`);
}

function stars(rating: number) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"*".repeat(safe)}${".".repeat(5 - safe)}`;
}

export default function DetailsScreen() {
  const { colors, radii, shadows, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { results, category, parentCategory } = useFlowState();
  const [voteData, setVoteData] = useState<VoteData | undefined>();
  const [liveData, setLiveData] = useState<LiveDataResult | null>(null);
  const restaurant = results?.find((item) => item.id === id);

  const styles = useMemo(() => StyleSheet.create({
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
      borderColor: 'rgba(0,0,0,0.1)',
      shadowColor: '#000',
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
      color: colors.brandDeep,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      fontFamily: typography.heading,
    },
    sectionTitle: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    verdict: {
      color: colors.ink,
      fontSize: 18,
      lineHeight: 26,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    blockTitle: {
      color: colors.success,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 4,
      fontFamily: typography.heading,
    },
    blockTitleWarn: {
      color: colors.warning,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    listText: {
      flex: 1,
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: typography.body,
    },
    quoteCard: {
      backgroundColor: colors.chip,
      borderRadius: radii.md,
      padding: 16,
    },
    quoteText: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: typography.body,
      marginTop: 8,
    },
    reviewsCard: {
      backgroundColor: colors.chip,
      borderRadius: radii.md,
      padding: 16,
      gap: 14,
    },
    reviewItem: {
      borderTopWidth: 1,
      borderTopColor: colors.stroke,
      paddingTop: 14,
    },
    reviewHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
      gap: 12,
    },
    reviewAuthor: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    reviewTime: {
      color: colors.inkMuted,
      fontSize: 12,
      fontFamily: typography.body,
    },
    reviewStars: {
      color: colors.warning,
      fontSize: 13,
      letterSpacing: 1,
      marginBottom: 6,
    },
    reviewBody: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: typography.body,
    },
    emptyReview: {
      color: colors.inkMuted,
      fontSize: 14,
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
  }), [colors, radii, shadows, typography]);

  const LIVE_DATA_SUBCATS = new Set(['gas_station', 'gasolinera', 'fuel', 'ev_charging', 'ev_charging_auto', 'pharmacy']);
  const LIVE_DATA_CATS = new Set(['cinema', 'nature', 'sport']);

  useEffect(() => {
    if (!id) return;
    getVotes(id)
      .then((data) => {
        if (data) setVoteData(data);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    setLiveData(null);
    if (!restaurant) return;
    if (restaurant.liveData && restaurant.liveData.type !== 'none') {
      setLiveData(restaurant.liveData as LiveDataResult);
      return;
    }
    const sub = category ?? '';
    const cat = parentCategory ?? '';
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
      .then((result) => { setLiveData(result.type !== 'none' ? result : null); })
      .catch(() => { setLiveData(null); });
  }, [restaurant?.id, restaurant?.liveData, category, parentCategory]);

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Place not found</Text>
          <Text style={styles.notFoundSub}>
            Your search state expired. Start a fresh search to see the updated results.
          </Text>
          <View style={styles.notFoundButton}>
            <PrimaryButton label="Start over" onPress={() => router.replace("/(flow)/category")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const distance = restaurant.distanceM > 0 ? formatDistance(restaurant.distanceM) : null;


  const renderBoldText = (text: string, baseStyle: any) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <Text style={baseStyle}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <Text key={i} style={{ fontWeight: 'bold', color: colors.ink }}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };
  if (!restaurant) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ marginTop: 20, color: colors.ink }}>Cargando detalles...</Text>
        <TouchableOpacity 
          style={{ marginTop: 40, padding: 12 }} 
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={{ color: colors.brand }}>Volver al mapa</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.floatingBack} onPress={() => router.back()}>
        <Text style={styles.floatingBackText}>{"<"}</Text>
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {restaurant.photoUrl ? (
            <Image source={{ uri: restaurant.photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <GADOIcon name="restaurant" category="food" size={44} color={colors.brand} />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.name}>{restaurant.name}</Text>
              <Text style={styles.subline}>
                {restaurant.tagline || "Recommended place"}
                {distance ? ` · ${distance}` : ""}
              </Text>
            </View>
            <Text style={styles.price}>{formatPriceLevel(restaurant.priceLevel)}</Text>
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.ratingPrimary}>* {formatRating(restaurant.rating)}</Text>
            <Text style={styles.ratingMeta}>{formatReviews(restaurant.reviewsCount)} reviews</Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Address</Text>
            <Text style={styles.metaText}>{restaurant.address}</Text>
            <Text style={styles.metaTitle}>Phone</Text>
            <Text style={styles.metaText}>{restaurant.phone || "No phone available"}</Text>
          </View>

          <View style={styles.takeCard}>
            <Text style={styles.sectionEyebrow}>GADO's Take</Text>
            <Text style={styles.verdict}>{restaurant.verdict || restaurant.why}</Text>
            <Text style={styles.blockTitle}>The good stuff</Text>
            {(restaurant.pros || []).map((pro) => (
              <View key={pro} style={styles.listRow}>
                <GADOIcon name="like" category="feedback" size={14} color={colors.success} />
                {renderBoldText(pro, styles.listText)}
              </View>
            ))}
            <Text style={[styles.blockTitle, styles.blockTitleWarn]}>Worth knowing</Text>
            {(restaurant.cons || []).map((con) => (
              <View key={con} style={styles.listRow}>
                <GADOIcon name="warning" category="feedback" size={14} color={colors.warning} />
                {renderBoldText(con, styles.listText)}
              </View>
            ))}
          </View>

          {restaurant.bestReviewQuote ? (
            <View style={styles.quoteCard}>
              <Text style={styles.sectionEyebrow}>Top review</Text>
              <Text style={styles.quoteText}>"{restaurant.bestReviewQuote}"</Text>
            </View>
          ) : null}

          <View style={styles.reviewsCard}>
            <Text style={styles.sectionTitle}>What people say</Text>
            {restaurant.reviews.length === 0 ? (
              <Text style={styles.emptyReview}>No individual reviews available.</Text>
            ) : (
              restaurant.reviews.map((review, index) => (
                <View key={`${review.author}-${index}`} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>{review.author || "Anonymous"}</Text>
                    <Text style={styles.reviewTime}>{review.relative_time || "Recent"}</Text>
                  </View>
                  <Text style={styles.reviewStars}>{stars(review.rating)}</Text>
                  <Text style={styles.reviewBody}>{review.text}</Text>
                </View>
              ))
            )}
          </View>

          {liveData && <LiveDataAddon data={liveData} />}

          <VoteButtons itemId={restaurant.id} itemType="place" initial={voteData} />
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={() => openDirections(restaurant.lat, restaurant.lng, restaurant.name)}
          >
            <Text style={styles.actionPrimaryText}>Directions</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => void shareRestaurant(restaurant)}>
            <Text style={styles.actionSecondaryText}>Share</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => restaurant.phone && Linking.openURL(`tel:${restaurant.phone}`)}
          >
            <Text style={styles.actionSecondaryText}>Call</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
