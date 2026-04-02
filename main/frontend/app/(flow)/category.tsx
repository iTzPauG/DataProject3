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

const DEFAULT_OPTIONS = [
  { id: 'popular', label: 'Popular', emoji: '🔥' },
  { id: 'new', label: 'Nuevo', emoji: '✨' },
  { id: 'nearby', label: 'Cerca de ti', emoji: '📍' },
  { id: 'top_rated', label: 'Mejor valorado', emoji: '⭐' },
];

export default function CategoryScreen() {
  const { colors, typography } = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { reset, setCategory, setParentCategory } = useFlowState();

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
      color: colors.ink,
      fontWeight: '600',
      fontFamily: typography.heading,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 12,
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingBottom: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      paddingTop: 8,
    },
  }), [colors, typography]);

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
    [flow],
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
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <View style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.ink} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.step}>Paso 1 de {totalSteps}</Text>
          <Text style={styles.title}>¿Qué estás buscando?</Text>
          <Text style={styles.subtitle}>Elige una opción para ver recomendaciones personalizadas</Text>
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
