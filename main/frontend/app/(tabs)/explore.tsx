import { useTranslation } from "react-i18next";
import { router } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Icon from '../../components/Icon';
import { useTheme } from '../../utils/theme';
import { useLocation } from '../../hooks/useLocation';

const FLOW_STEPS = [
  { key: 'food_type', emoji: '🍽️', labelKey: 'flow.categoryTitle', subtitleKey: 'flow.categorySubtitle' },
  { key: 'mood', emoji: '✨', labelKey: 'flow.moodTitle', subtitleKey: 'flow.moodSubtitle' },
  { key: 'budget', emoji: '💰', labelKey: 'flow.priceTitle', subtitleKey: 'flow.priceSubtitle' },
];

/**
 * Explore — goes directly to the 3-step filter flow (food type → mood → budget).
 */
export default function ExploreTab() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const { city } = useLocation();

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
          marginBottom: 28,
        },

        // ── CTA button ─────────────────────────────────────────
        ctaButton: {
          marginHorizontal: 24,
          marginBottom: 32,
          backgroundColor: colors.brand,
          borderRadius: 16,
          paddingVertical: 18,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        ctaLeft: { flex: 1 },
        ctaTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: '#FFFFFF',
          fontFamily: typography.heading,
          letterSpacing: -0.3,
        },
        ctaSubtitle: {
          fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
          fontFamily: typography.body,
          marginTop: 3,
        },

        // ── Steps preview ──────────────────────────────────────
        stepsLabel: {
          paddingHorizontal: 24,
          marginBottom: 12,
          fontSize: 11,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
        },
        stepRow: {
          paddingHorizontal: 24,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
        },
        stepRowLast: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.stroke,
        },
        stepEmoji: {
          fontSize: 26,
          width: 40,
          textAlign: 'center',
        },
        stepBody: { flex: 1 },
        stepTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.ink,
          fontFamily: typography.heading,
          letterSpacing: -0.2,
        },
        stepSubtitle: {
          fontSize: 13,
          color: colors.inkMuted,
          fontFamily: typography.body,
          marginTop: 2,
        },
        stepNumber: {
          fontSize: 11,
          color: colors.inkWhisper,
          fontFamily: typography.mono,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }),
    [colors, typography],
  );

  function handleStart() {
    router.push({
      pathname: '/(flow)/category',
      params: { categoryId: 'food' },
    });
  }

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
                {randomVerb}{' '}
                {city ? (
                  city
                ) : (
                  <ActivityIndicator size="small" color={colors.ink} />
                )}
                {'\n'}
                <Text style={styles.masterHeadAccent}>{t('explore.masterHeadPart2') || "como un local."}</Text>
              </Text>
              <Text style={styles.deck}>
                {t('explore.deck')}
              </Text>
            </View>

            <View style={styles.ruleBlock} />

            {/* CTA principal */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleStart}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('flow.startFlow', 'Empezar búsqueda')}
            >
              <View style={styles.ctaLeft}>
                <Text style={styles.ctaTitle}>{t('flow.startFlow', 'Encontrar mi sitio')}</Text>
                <Text style={styles.ctaSubtitle}>{t('flow.startFlowSub', '3 pasos · menos de 30 segundos')}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>

            {/* Preview de los 3 pasos */}
            <Text style={styles.stepsLabel}>{t('flow.howItWorks', 'Cómo funciona')}</Text>
            {FLOW_STEPS.map((step, i) => (
              <View
                key={step.key}
                style={[styles.stepRow, i === FLOW_STEPS.length - 1 && styles.stepRowLast]}
              >
                <Text style={styles.stepEmoji}>{step.emoji}</Text>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{t(step.labelKey, step.labelKey)}</Text>
                  <Text style={styles.stepSubtitle}>{t(step.subtitleKey, step.subtitleKey)}</Text>
                </View>
                <Text style={styles.stepNumber}>{String(i + 1).padStart(2, '0')}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}
