import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../utils/theme';

interface ReviewItem {
  author: string;
  rating: number;
  text: string;
  relative_time: string;
}

interface Props {
  reviews: ReviewItem[];
}

export default function ReviewList({ reviews }: Props) {
  const { t } = useTranslation();
  const { colors, typography, radii, shadows } = useTheme();

  if (!reviews || reviews.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.ink, fontFamily: typography.heading }]}>
        {t('placeDetails.whatPeopleSay')}
      </Text>
      {reviews.map((rev, idx) => (
        <View 
          key={idx} 
          style={[
            styles.reviewCard, 
            { backgroundColor: colors.surface, borderColor: colors.stroke, borderRadius: radii.lg, ...shadows.soft }
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewAuthor, { color: colors.ink, fontFamily: typography.heading }]}>
              {rev.author}
            </Text>
            <Text style={[styles.reviewTime, { color: colors.inkMuted, fontFamily: typography.body }]}>
              {rev.relative_time}
            </Text>
          </View>
          <Text style={styles.reviewStars}>
            {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
          </Text>
          <Text style={[styles.reviewText, { color: colors.ink, fontFamily: typography.body }]}>
            {rev.text}
          </Text>
        </View>
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  reviewCard: {
    padding: 16,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: '700',
  },
  reviewTime: {
    fontSize: 12,
  },
  reviewStars: {
    fontSize: 12,
    color: '#FFCC00',
    letterSpacing: 2,
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
