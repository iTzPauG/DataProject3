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
  const { colors, typography, space } = useTheme();
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
      paddingTop: space.xxxl,
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
    segmentWrapper: {
      paddingHorizontal: space.lg,
    },
    segment: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.stroke,
      backgroundColor: colors.surface,
    },
    segmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space.xl,
      paddingHorizontal: space.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    segmentLabel: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.brand,
      fontFamily: typography.heading,
      width: 60,
    },
    segmentContent: {
      flex: 1,
    },
    segmentDesc: {
      fontSize: 14,
      color: colors.ink,
      fontWeight: '600',
      fontFamily: typography.heading,
      letterSpacing: -0.2,
    },
    arrow: {
      color: colors.inkWhisper,
      fontSize: 18,
      fontFamily: typography.mono,
    }
  }), [colors, typography, space]);

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
                    isLast && { borderBottomWidth: 0 },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.segmentLabel}>
                    {pl.label}
                  </Text>
                  <View style={styles.segmentContent}>
                    <Text style={styles.segmentDesc}>
                      {t(`flow.${pl.descriptionKey}`) || pl.descriptionKey}
                    </Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
