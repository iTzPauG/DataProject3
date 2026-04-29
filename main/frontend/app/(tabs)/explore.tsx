import { useTranslation } from "react-i18next";
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import CategoryMonogram from '../../components/CategoryMonogram';
import Icon from '../../components/Icon';
import { ExploreCategory, getExploreCategories } from '../../services/api';
import { useTheme } from '../../utils/theme';
import { useLocation } from '../../hooks/useLocation';

/**
 * Explore — editorial index.
 */
export default function ExploreTab() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const { city } = useLocation();
  const [categories, setCategories] = useState<ExploreCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const exploreVerbs = useMemo(() => t('explore.exploreVerbs', { returnObjects: true }) as string[], [t]);
  const randomVerb = useMemo(() => {
    if (Array.isArray(exploreVerbs) && exploreVerbs.length > 0) {
      return exploreVerbs[Math.floor(Math.random() * exploreVerbs.length)];
    }
    return "Explore";
  }, [exploreVerbs]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.shell },
        container: {
          flex: 1,
          maxWidth: 620,
          width: '100%',
          alignSelf: 'center',
        },
        scrollContent: { paddingBottom: 64 },

        // ── masthead ────────────────────────────────────────────
        masthead: {
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 28,
        },
        issueLine: {
          fontSize: 11,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
          marginBottom: 14,
        },
        masterHead: {
          fontSize: 42,
          lineHeight: 46,
          letterSpacing: -1.2,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
        },
        masterHeadAccent: {
          color: colors.brand,
          fontStyle: 'italic',
          fontWeight: '500',
        },
        deck: {
          fontSize: 15,
          lineHeight: 23,
          color: colors.inkMuted,
          marginTop: 14,
          maxWidth: 460,
          fontFamily: typography.body,
        },

        ruleBlock: {
          marginHorizontal: 24,
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.stroke,
        },

        // ── featured events strip ───────────────────────────────
        featured: {
          marginHorizontal: 24,
          marginTop: 28,
          marginBottom: 32,
        },
        featuredEyebrow: {
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
          marginBottom: 12,
        },
        featuredRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
        },
        featuredTextBlock: {
          flex: 1,
          gap: 8,
        },
        featuredTitle: {
          fontSize: 22,
          lineHeight: 28,
          letterSpacing: -0.4,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
        },
        featuredBody: {
          fontSize: 14,
          lineHeight: 21,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        featuredAction: {
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        featuredActionText: {
          fontSize: 13,
          letterSpacing: 0.3,
          color: colors.brand,
          fontFamily: typography.body,
          fontWeight: '600',
        },

        // ── index list ─────────────────────────────────────────
        sectionHeader: {
          paddingHorizontal: 24,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        sectionTitle: {
          fontSize: 11,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
        },
        sectionCount: {
          fontSize: 11,
          letterSpacing: 1.5,
          color: colors.inkWhisper,
          fontFamily: typography.body,
          fontWeight: '500',
        },
        row: {
          paddingHorizontal: 24,
          paddingVertical: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
        },
        rowLast: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.stroke,
        },
        rowNumber: {
          width: 28,
          fontSize: 12,
          color: colors.inkWhisper,
          fontFamily: typography.mono,
          fontWeight: '500',
          letterSpacing: 0.5,
        },
        rowBody: { flex: 1, gap: 4 },
        rowTitle: {
          fontSize: 17,
          lineHeight: 22,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
          letterSpacing: -0.2,
        },
        rowDescription: {
          fontSize: 13,
          lineHeight: 18,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        rowMeta: {
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: colors.inkWhisper,
          fontFamily: typography.body,
          fontWeight: '600',
          marginLeft: 12,
        },
        rowInactive: { opacity: 0.48 },
      }),
    [colors, typography],
  );

  useEffect(() => {
    getExploreCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleCategoryPress(category: ExploreCategory) {
    if (category.active === false) {
      Alert.alert(t('common.soon'), t('explore.notAvailable'));
      return;
    }
    if (category.id === 'report') {
      router.push('/(tabs)/report');
      return;
    }
    const eventCategories = new Set(['event', 'market', 'music']);
    if (eventCategories.has(category.id)) {
      router.push({
        pathname: '/(flow)/explore-list',
        params: {
          categoryId: category.id,
          itemType: 'event',
          title: category.label,
        },
      });
      return;
    }
    router.push({
      pathname: '/(flow)/category',
      params: { categoryId: category.id },
    });
  }

  // exclude report / event from the index (report gets its own block, events are in the featured strip)
  const indexed = useMemo(() => categories.filter(
    (c) => c.id !== 'report' && c.id !== 'event',
  ), [categories]);

  return (
    <AnimatedTabScene>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.masthead}>
              <Text style={styles.issueLine}>{t('explore.issueLine') || "Nº 01 · Índice de la ciudad"}</Text>
              <Text style={styles.masterHead}>
                {randomVerb} {city || "València"}{'\n'}
                <Text style={styles.masterHeadAccent}>{t('explore.masterHeadPart2') || "como un local."}</Text>
              </Text>
              <Text style={styles.deck}>
                {t('explore.deck')}
              </Text>
            </View>

            <View style={styles.ruleBlock} />

            <View style={styles.featured}>
              <Text style={styles.featuredEyebrow}>{t('explore.featured')}</Text>
              <View style={styles.featuredRow}>
                <View style={styles.featuredTextBlock}>
                  <Text style={styles.featuredTitle}>
                    {t('explore.featuredTitle')}
                  </Text>
                  <Text style={styles.featuredBody}>
                    {t('explore.featuredBody')}
                  </Text>
                  <TouchableOpacity
                    style={styles.featuredAction}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push({
                        pathname: '/(flow)/explore-list',
                        params: {
                          categoryId: 'event',
                          itemType: 'event',
                          title: t('explore.events'),
                        },
                      })
                    }
                  >
                    <Text style={styles.featuredActionText}>{t('explore.viewAgenda')}</Text>
                    <Icon
                      name="arrow-right"
                      size={14}
                      color={colors.brand}
                      strokeWidth={1.4}
                    />
                  </TouchableOpacity>
                </View>
                <CategoryMonogram
                  categoryId="event"
                  label={t('explore.events')}
                  size={74}
                  variant="ring"
                />
              </View>
            </View>

            <View style={sectionHeaderStyles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('explore.sections')}</Text>
              <Text style={styles.sectionCount}>
                {String(indexed.length).padStart(2, '0')} {t('explore.categories') || "categorías"}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.inkMuted}
                style={{ marginTop: 24 }}
              />
            ) : (
              <View>
                {indexed.map((cat, i) => {
                  const isLast = i === indexed.length - 1;
                  const number = String(i + 1).padStart(2, '0');
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.7}
                      onPress={() => handleCategoryPress(cat)}
                      accessibilityRole="button"
                      accessibilityLabel={cat.label}
                      style={[
                        styles.row,
                        isLast && styles.rowLast,
                        cat.active === false && styles.rowInactive,
                      ]}
                    >
                      <Text style={styles.rowNumber}>{number}</Text>
                      <CategoryMonogram
                        categoryId={cat.id}
                        label={cat.label}
                        size={40}
                        variant="ring"
                      />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle}>{cat.label}</Text>
                        {cat.description ? (
                          <Text style={styles.rowDescription} numberOfLines={2}>
                            {cat.description}
                          </Text>
                        ) : null}
                      </View>
                      {cat.active === false ? (
                        <Text style={styles.rowMeta}>{t('common.soon')}</Text>
                      ) : (
                        <Icon
                          name="chevron-right"
                          size={14}
                          color={colors.inkWhisper}
                          strokeWidth={1.4}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
