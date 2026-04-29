import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "../components/SafeIonicons";
import { VoteData } from "../services/api";
import { Restaurant } from "../types/restaurant";
import { formatDistance, formatRating, formatReviews } from "../utils/format";
import { useTheme } from "../utils/theme";
import WhimIcon from "./WhimIcon";
import VoteButtons from "./VoteButtons";

interface Props {
  restaurant: Restaurant;
  index: number;
  onPress: () => void;
  selected?: boolean;
  voteData?: VoteData;
}

function priceDots(level: number) {
  return "$".repeat(Math.max(1, level));
}

export default function RestaurantCard({
  restaurant,
  index,
  onPress,
  selected = false,
  voteData,
}: Props) {
  const { t } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();
  const distance = restaurant.distanceM > 0 ? formatDistance(restaurant.distanceM) : null;
  const pros = restaurant.pros.slice(0, 2);
  const cons = restaurant.cons.slice(0, 1);

  const renderBoldText = (text: string, baseStyle: any, numberOfLines?: number) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <Text style={baseStyle} numberOfLines={numberOfLines}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
            <Text key={i} style={{ fontWeight: 'bold' }}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      overflow: "hidden",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.stroke,
      ...shadows.soft,
    },
    cardSelected: {
      borderColor: colors.brand,
    },
    cardPressed: {
      opacity: 0.96,
      transform: [{ scale: 0.99 }],
    },
    hero: {
      position: "relative",
      aspectRatio: 16 / 9,
      backgroundColor: colors.chip,
    },
    heroImage: {
      width: "100%",
      height: "100%",
    },
    heroPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    ratingBadge: {
      position: "absolute",
      right: 12,
      top: 12,
      backgroundColor: colors.overlay,
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
      zIndex: 2,
    },
    ratingBadgeText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    body: {
      padding: 16,
      gap: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerCopy: {
      flex: 1,
    },
    name: {
      color: colors.ink,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    metaLine: {
      color: colors.inkMuted,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: typography.body,
      marginTop: 4,
    },
    priceDots: {
      color: colors.warning,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    scoreText: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: "600",
      fontFamily: typography.body,
    },
    reviewText: {
      color: colors.inkMuted,
      fontSize: 13,
      fontFamily: typography.body,
    },
    signalBox: {
      backgroundColor: colors.chip,
      borderRadius: radii.md,
      padding: 12,
      gap: 8,
    },
    signalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    signalGood: {
      color: colors.ink,
      fontSize: 13,
      flex: 1,
      fontFamily: typography.body,
    },
    signalBad: {
      color: colors.inkMuted,
      fontSize: 13,
      flex: 1,
      fontFamily: typography.body,
    },
    footerRow: {
      gap: 12,
      marginTop: 4,
    },
    voteWrap: {
      width: "100%",
    },
    moreWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    moreText: {
      color: colors.brandDeep,
      fontSize: 13,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
  }), [colors, radii, shadows, typography]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${t('common.cardOf', { defaultValue: 'Card of' })} ${restaurant.name}. ${t('placeDetails.rating', { rating: formatRating(restaurant.rating) })}. ${restaurant.tagline || ""}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.hero}>
        {restaurant.photoUrl ? (
          <Image source={{ uri: restaurant.photoUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <WhimIcon name="restaurant" category="food" size={34} color={colors.brand} accessibilityLabel={t('common.restaurantPlaceholder', { defaultValue: 'Restaurant placeholder' })} />
          </View>
        )}
        <View style={styles.ratingBadge} accessibilityLabel={t('placeDetails.rating', { rating: formatRating(restaurant.rating) })}>
          <Text style={styles.ratingBadgeText}>{formatRating(restaurant.rating)} ★</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
            <Text style={styles.metaLine} numberOfLines={1}>
              {restaurant.tagline || t('placeDetails.recommended')}
              {distance ? ` · ${distance}` : ""}
            </Text>
          </View>
          <Text style={styles.priceDots} accessibilityLabel={`${t('common.priceLevel', { defaultValue: 'Price level' })} ${restaurant.priceLevel}`}>
            {priceDots(restaurant.priceLevel)}
          </Text>
        </View>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>{t('placeDetails.rating', { rating: formatRating(restaurant.rating) })}</Text>
          <Text style={styles.reviewText}>{formatReviews(restaurant.reviewsCount)} {t('common.reviews', { defaultValue: 'reviews' })}</Text>
        </View>
<View style={styles.signalBox}>
  {(pros || []).length > 0 ? (
    pros.map((pro, i) => (
      <View key={`pro-${i}`} style={styles.signalRow}>
        <WhimIcon name="like" category="feedback" size={14} color={colors.success} accessibilityLabel={t('common.positivePoint', { defaultValue: 'Positive point' })} />
        {renderBoldText(pro, styles.signalGood, 1)}
      </View>
    ))
  ) : (
    <View style={styles.signalRow}>
      <WhimIcon name="like" category="feedback" size={14} color={colors.success} />
      <Text style={styles.signalGood} numberOfLines={1}>{t('placeDetails.strengths')}</Text>
    </View>
  )}

  {(cons || []).length > 0 ? (
    cons.map((con, i) => (
      <View key={`con-${i}`} style={styles.signalRow}>
        <WhimIcon name="warning" category="feedback" size={14} color={colors.warning} accessibilityLabel={t('common.attentionPoint', { defaultValue: 'Attention point' })} />
        {renderBoldText(con, styles.signalBad, 1)}
      </View>
    ))
  ) : null}
</View>
        <View style={styles.footerRow}>
          <View style={styles.voteWrap}>
            <VoteButtons itemId={restaurant.id} itemType="place" initial={voteData} title={t('placeDetails.verdict')} />
          </View>
          <View style={styles.moreWrap} accessibilityLabel={t('common.viewMore')}>
            <Text style={styles.moreText}>{t('common.viewMore')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brandDeep} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

