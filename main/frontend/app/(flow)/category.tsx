import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../components/SafeIonicons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Atmosphere from '../../components/Atmosphere';
import CategoryMonogram from '../../components/CategoryMonogram';
import ChoiceCard from '../../components/ChoiceCard';
import { useFlowState } from '../../hooks/useFlowState';
import { CategoryFlowResponse, getCategoryFlow } from '../../services/api';
import { useTheme } from '../../utils/theme';

export default function CategoryScreen() {
  const { t } = useTranslation();
  const { colors, typography, space, radii } = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { reset, setCategory, setParentCategory } = useFlowState();

  const DEFAULT_OPTIONS = useMemo(() => [
    { id: 'popular', label: t('flow.popular') },
    { id: 'new', label: t('common.soon') },
    { id: 'nearby', label: t('home.locationNow') },
    { id: 'top_rated', label: t('placeDetails.theBest') },
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
      paddingHorizontal: space.lg,
      paddingTop: space.xl,
      paddingBottom: space.sm,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    header: {
      paddingHorizontal: space.xl,
      paddingTop: space.hero,
      paddingBottom: space.xl,
    },
    step: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.brand,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginBottom: space.sm,
      fontFamily: typography.mono,
    },
    title: {
      fontSize: 40,
      fontWeight: '800',
      color: colors.ink,
      lineHeight: 44,
      marginBottom: space.sm,
      fontFamily: typography.heading,
      letterSpacing: -0.8,
    },
    subtitle: {
      fontSize: 18,
      color: colors.inkMuted,
      lineHeight: 26,
      fontFamily: typography.body,
      letterSpacing: -0.1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingBottom: space.hero,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: space.xl,
      gap: space.sm,
    },
    gridItem: {
      borderWidth: 1,
      borderColor: colors.stroke,
      padding: space.lg,
      borderRadius: radii.md,
      justifyContent: 'space-between',
    },
    gridItemFull: {
      width: '100%',
      minHeight: 140,
      backgroundColor: colors.surface,
    },
    gridItemHalf: {
      flex: 1,
      minWidth: '45%',
      minHeight: 120,
    },
    gridLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.heading,
      letterSpacing: -0.2,
    },
    gridLabelLarge: {
      fontSize: 22,
      letterSpacing: -0.4,
    },
  }), [colors, typography, space, radii]);

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
              {options.map((cat, i) => {
                const isFull = i % 3 === 0;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => handleSelect(cat.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.gridItem,
                      isFull ? styles.gridItemFull : styles.gridItemHalf
                    ]}
                  >
                    <CategoryMonogram
                      categoryId={flow?.category.id ?? categoryId ?? 'food'}
                      label={cat.label}
                      size={isFull ? 56 : 40}
                    />
                    <Text 
                      style={[styles.gridLabel, isFull && styles.gridLabelLarge]}
                      numberOfLines={2}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
