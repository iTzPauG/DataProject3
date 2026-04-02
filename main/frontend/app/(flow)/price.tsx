import { router } from 'expo-router';
import React from 'react';
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
import { useMemo } from 'react';

const PRICE_LEVELS: Array<{
  value: 1 | 2 | 3;
  label: string;
  description: string;
}> = [
  { value: 1, label: '€',   description: 'Económico' },
  { value: 2, label: '€€',  description: 'Precio medio' },
  { value: 3, label: '€€€', description: 'Premium' },
];

export default function PriceScreen() {
  const { colors, radii, shadows, typography } = useTheme();
  const { setPriceLevel } = useFlowState();

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    container: {
      flex: 1,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    navBar: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    backButton: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    backText: {
      fontSize: 17,
      color: colors.brandDeep,
      fontWeight: '600',
      fontFamily: typography.heading,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 32,
    },
    step: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brand,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
      fontFamily: typography.heading,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 6,
      fontFamily: typography.heading,
    },
    subtitle: {
      fontSize: 15,
      color: colors.inkMuted,
      lineHeight: 22,
      fontFamily: typography.body,
    },
    segmentWrapper: {
      paddingHorizontal: 24,
    },
    segment: {
      flexDirection: 'row',
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.stroke,
      backgroundColor: colors.surface,
      ...shadows.soft,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    segmentItemFirst: {
      borderTopLeftRadius: radii.lg - 2,
      borderBottomLeftRadius: radii.lg - 2,
    },
    segmentItemLast: {
      borderTopRightRadius: radii.lg - 2,
      borderBottomRightRadius: radii.lg - 2,
    },
    segmentItemBorder: {
      borderRightWidth: 1,
      borderRightColor: colors.stroke,
    },
    segmentLabel: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.brandDeep,
      fontFamily: typography.heading,
      marginBottom: 6,
    },
    segmentDesc: {
      fontSize: 12,
      color: colors.inkMuted,
      fontWeight: '500',
      fontFamily: typography.body,
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
        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>Paso 3 de 3</Text>
          <Text style={styles.title}>¿Cuál es tu presupuesto?</Text>
          <Text style={styles.subtitle}>Filtraremos las opciones para ajustarnos a él</Text>
        </View>

        {/* Segmented selector */}
        <Animated.View entering={FadeInUp.duration(400).delay(100).springify().damping(16)} style={styles.segmentWrapper}>
          <View style={styles.segment}>
            {PRICE_LEVELS.map((pl, index) => {
              const isFirst = index === 0;
              const isLast = index === PRICE_LEVELS.length - 1;
              return (
                <TouchableOpacity
                  key={pl.value}
                  onPress={() => handleSelect(pl.value)}
                  style={[
                    styles.segmentItem,
                    isFirst && styles.segmentItemFirst,
                    isLast && styles.segmentItemLast,
                    !isLast && styles.segmentItemBorder,
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${pl.label} — ${pl.description}`}
                >
                  <Text style={styles.segmentLabel}>
                    {pl.label}
                  </Text>
                  <Text style={styles.segmentDesc}>
                    {pl.description}
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
