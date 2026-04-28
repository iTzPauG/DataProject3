import { useTranslation } from "react-i18next";
import { router } from 'expo-router';
import { Ionicons } from '../../components/SafeIonicons';
import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Atmosphere from '../../components/Atmosphere';
import { useFlowState } from '../../hooks/useFlowState';
import { useTheme } from '../../utils/theme';

const PRICE_LEVELS: Array<{
  value: 1 | 2 | 3;
  label: string;
  descriptionKey: string;
}> = [
  { value: 1, label: '€',   descriptionKey: 'price_1' },
  { value: 2, label: '€€',  descriptionKey: 'price_2' },
  { value: 3, label: '€€€', descriptionKey: 'price_3' },
];

export default function PriceScreen() {
  const { t } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();
  const { setPriceLevel } = useFlowState();

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
      paddingBottom: 32,
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
    segmentWrapper: {
      paddingHorizontal: 24,
    },
    segment: {
      flexDirection: 'row',
      borderRadius: radii.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.stroke,
      backgroundColor: colors.surface,
      ...shadows.soft,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    segmentItemBorder: {
      borderRightWidth: 1,
      borderRightColor: colors.stroke,
    },
    segmentLabel: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.brand,
      fontFamily: typography.heading,
      marginBottom: 6,
    },
    segmentDesc: {
      fontSize: 12,
      color: colors.inkMuted,
      fontWeight: '600',
      fontFamily: typography.body,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  }), [colors, radii, shadows, typography]);

  function handleSelect(value: 1 | 2 | 3) {
    setPriceLevel(value);
    router.push('/(flow)/results-map');
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
          <Text style={styles.step}>{t('flow.step', { current: 3, total: 3 })}</Text>
          <Text style={styles.title}>{t('flow.priceTitle')}</Text>
          <Text style={styles.subtitle}>{t('flow.priceSubtitle')}</Text>
        </View>

        <Animated.View entering={FadeInUp.duration(400).delay(100).springify().damping(16)} style={styles.segmentWrapper}>
          <View style={styles.segment}>
            {PRICE_LEVELS.map((pl, index) => {
              const isLast = index === PRICE_LEVELS.length - 1;
              return (
                <TouchableOpacity
                  key={pl.value}
                  onPress={() => handleSelect(pl.value)}
                  style={[
                    styles.segmentItem,
                    !isLast && styles.segmentItemBorder,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.segmentLabel}>
                    {pl.label}
                  </Text>
                  <Text style={styles.segmentDesc}>
                    {t(`flow.${pl.descriptionKey}`) || pl.descriptionKey}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
