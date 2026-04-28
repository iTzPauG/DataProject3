import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../components/SafeIonicons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Atmosphere from '../../components/Atmosphere';
import ChoiceCard from '../../components/ChoiceCard';
import { useFlowState } from '../../hooks/useFlowState';
import { CategoryFlowResponse, getCategoryFlow } from '../../services/api';
import { useTheme } from '../../utils/theme';

export default function CategoryScreen() {
  const { t } = useTranslation();
  const { colors, typography, shadows } = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { reset, setCategory, setParentCategory } = useFlowState();

  const DEFAULT_OPTIONS = useMemo(() => [
    { id: 'popular', label: t('flow.popular'), emoji: '🔥' },
    { id: 'new', label: t('common.soon'), emoji: '✨' },
    { id: 'nearby', label: t('home.locationNow'), emoji: '📍' },
    { id: 'top_rated', label: t('placeDetails.theBest'), emoji: '⭐' },
  ], [t]);

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    container: {
      flex: 1,
      maxWidth: 600,
      width: '100%',
      alignSelf: 'center',
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.soft,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    header: {
      paddingHorizontal: 28,
      paddingTop: 24,
      paddingBottom: 16,
    },
    step: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brand,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
      fontFamily: typography.heading,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.ink,
      lineHeight: 38,
      marginBottom: 10,
      fontFamily: typography.heading,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: colors.inkMuted,
      lineHeight: 24,
      fontFamily: typography.body,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingBottom: 40,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 12,
    },
  }), [colors, typography, shadows]);

  const [flow, setFlow] = useState<CategoryFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolvedCategoryId = categoryId ?? 'food';
    reset();
    setParentCategory(resolvedCategoryId);
    setFlow(null);
    setLoading(true);
    getCategoryFlow(resolvedCategoryId)
      .then(setFlow)
      .finally(() => setLoading(false));
  }, [categoryId, reset, setParentCategory]);

  const options = useMemo(
    () => (flow?.subcategories && flow.subcategories.length > 0 ? flow.subcategories : DEFAULT_OPTIONS),
    [flow, DEFAULT_OPTIONS],
  );

  const totalSteps = flow?.category.requires_price ? 3 : 2;

  function handleSelect(id: string) {
    setCategory(id);
    router.push('/(flow)/mood');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Atmosphere />
      <View style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.step}>{t('flow.step', { current: 1, total: totalSteps })}</Text>
          <Text style={styles.title}>{t('flow.categoryTitle')}</Text>
          <Text style={styles.subtitle}>{t('flow.categorySubtitle')}</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {options.map((cat, i) => (
                <ChoiceCard
                  key={cat.id}
                  iconName={cat.id}
                  category={flow?.category.id ?? categoryId ?? 'food'}
                  label={cat.label}
                  selected={false}
                  onPress={() => handleSelect(cat.id)}
                  index={i}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
