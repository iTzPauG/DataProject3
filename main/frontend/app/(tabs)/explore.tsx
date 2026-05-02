import { useTranslation } from "react-i18next";
import { router } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Icon from '../../components/Icon';
import CategoryMonogram from '../../components/CategoryMonogram';
import { useTheme } from '../../utils/theme';
import { useLocation } from '../../hooks/useLocation';

const { width, height } = Dimensions.get('window');

const FLOW_STEPS = [
  { key: 'food_type', iconName: 'food', labelKey: 'flow.categoryTitle', subtitleKey: 'flow.categorySubtitle' },
  { key: 'mood', iconName: 'nightlife', labelKey: 'flow.moodTitle', subtitleKey: 'flow.moodSubtitle' },
  { key: 'budget', iconName: 'shopping', labelKey: 'flow.priceTitle', subtitleKey: 'flow.priceSubtitle' },
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

  // Mesh gradient animation values
  const blob1X = useSharedValue(-width * 0.1);
  const blob1Y = useSharedValue(-height * 0.1);
  const blob2X = useSharedValue(width * 0.5);
  const blob2Y = useSharedValue(height * 0.4);

  useEffect(() => {
    blob1X.value = withRepeat(withTiming(width * 0.3, { duration: 18000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob1Y.value = withRepeat(withTiming(height * 0.2, { duration: 22000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob2X.value = withRepeat(withTiming(width * 0.1, { duration: 25000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob2Y.value = withRepeat(withTiming(height * 0.1, { duration: 19000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob1X.value }, { translateY: blob1Y.value }],
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob2X.value }, { translateY: blob2Y.value }],
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        container: {
          flex: 1,
          maxWidth: 620,
          width: '100%',
          alignSelf: 'center',
        },
        scrollContent: { paddingBottom: 64 },

        blob: {
          position: 'absolute',
          width: width * 0.9,
          height: width * 0.9,
          borderRadius: width * 0.45,
          opacity: 0.15,
        },

        masthead: {
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 28,
        },
        issueLine: {
          fontSize: 11,
          letterSpacing: 2.4,
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
        ctaContainer: {
          marginHorizontal: 24,
          marginBottom: 32,
          borderRadius: 20,
          overflow: 'hidden',
        },
        ctaBlur: {
          paddingVertical: 20,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(108, 99, 232, 0.15)', // brand with opacity
          borderWidth: 1,
          borderColor: 'rgba(108, 99, 232, 0.3)',
          borderRadius: 20,
        },
        ctaLeft: { flex: 1 },
        ctaTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.ink,
          fontFamily: typography.heading,
          letterSpacing: -0.3,
        },
        ctaSubtitle: {
          fontSize: 13,
          color: colors.inkMuted,
          fontFamily: typography.body,
          marginTop: 3,
        },
        ctaIconBox: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
        },

        // ── Steps preview ──────────────────────────────────────
        stepsLabel: {
          paddingHorizontal: 24,
          marginBottom: 12,
          fontSize: 11,
          letterSpacing: 2.4,
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
        stepIconBox: {
          width: 40,
          alignItems: 'center',
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
      <View style={StyleSheet.absoluteFillObject}>
        <Animated.View style={[styles.blob, { backgroundColor: colors.brandDeep }, blob1Style]} />
        <Animated.View style={[styles.blob, { backgroundColor: colors.accent, width: width * 1.1, height: width * 1.1 }, blob2Style]} />
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      </View>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.masthead}>
              <Text style={styles.issueLine}>{t('explore.issueLine') || "Nº 01 · Índice de la ciudad"}</Text>
              {city ? (
                <Text style={styles.masterHead}>
                  {randomVerb} {city}
                  {'\n'}
                  <Text style={styles.masterHeadAccent}>{t('explore.masterHeadPart2') || "como un local."}</Text> 
                </Text>
              ) : (
                <View style={{ height: 80, justifyContent: 'center', alignItems: 'flex-start' }}>
                  <ActivityIndicator size="small" color={colors.ink} />
                </View>
              )}
              <Text style={styles.deck}>
                {t('explore.deck')}
              </Text>
            </View>

            <View style={styles.ruleBlock} />

            {/* CTA principal */}
            <TouchableOpacity
              style={styles.ctaContainer}
              onPress={handleStart}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('flow.startFlow', 'Empezar búsqueda')}
            >
              <BlurView intensity={40} tint="dark" style={styles.ctaBlur}>
                <View style={styles.ctaLeft}>
                  <Text style={styles.ctaTitle}>{t('flow.startFlow', 'Encontrar mi sitio')}</Text>
                  <Text style={styles.ctaSubtitle}>{t('flow.startFlowSub', '3 pasos · menos de 30 segundos')}</Text>
                </View>
                <View style={styles.ctaIconBox}>
                  <Icon name="chevron-right" size={20} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* Preview de los 3 pasos */}
            <Text style={styles.stepsLabel}>{t('flow.howItWorks', 'Cómo funciona')}</Text>
            {FLOW_STEPS.map((step, i) => (
              <View
                key={step.key}
                style={[styles.stepRow, i === FLOW_STEPS.length - 1 && styles.stepRowLast]}
              >
                <View style={styles.stepIconBox}>
                  <CategoryMonogram
                    categoryId={step.iconName}
                    label={String(i + 1)}
                    size={36}
                  />
                </View>
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
