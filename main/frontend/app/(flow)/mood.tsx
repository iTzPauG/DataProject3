import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Atmosphere from '../../components/Atmosphere';
import ChoiceChip from '../../components/ChoiceChip';
import { useFlowState } from '../../hooks/useFlowState';
import { CategoryFlowResponse, getCategoryFlow } from '../../services/api';
import { useTheme } from '../../utils/theme';

const DEFAULT_MOODS = [
  { id: 'popular', label: 'Popular', emoji: '🔥' },
  { id: 'quiet', label: 'Tranquilo', emoji: '🤫' },
  { id: 'busy', label: 'Animado', emoji: '🎉' },
];

export default function MoodScreen() {
  const { colors, typography } = useTheme();
  const { parentCategory, category, setMood } = useFlowState();

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
      paddingTop: 8,
      paddingBottom: 16,
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
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      gap: 10,
    },
    chipWrapper: {
      width: '48%',
    },
  }), [colors, typography]);

  const [flow, setFlow] = useState<CategoryFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolvedParentCategory = parentCategory ?? 'food';
    setLoading(true);
    getCategoryFlow(resolvedParentCategory)
      .then(setFlow)
      .finally(() => setLoading(false));
  }, [parentCategory]);

  const currentMoods = useMemo(
    () => (flow?.moods && flow.moods.length > 0 ? flow.moods : DEFAULT_MOODS),
    [flow],
  );

  const title = flow?.category.mood_title ?? '¿Cuál es el plan?';
  const subtitle = flow?.category.mood_subtitle ?? 'Elige la opción que mejor encaja contigo';
  
  // Logic to determine if we should skip the price screen based on current selections
  const shouldSkipPrice = useMemo(() => {
    if (!flow?.category.requires_price) return true;
    
    const skipMoods = flow.category.skip_price_moods || [];
    const skipSubcats = flow.category.skip_price_subcategories || [];
    
    // Check if current subcategory is in skip list
    if (category && skipSubcats.includes(category)) return true;
    
    return false;
  }, [flow, category]);

  const totalSteps = shouldSkipPrice ? 2 : 3;

  function handleSelect(id: string) {
    setMood(id);
    
    // Additional dynamic check for the selected mood
    const skipMoods = flow?.category.skip_price_moods || [];
    const finalSkip = shouldSkipPrice || skipMoods.includes(id);
    
    router.push(finalSkip ? '/(flow)/results-map' : '/(flow)/price');
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
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.step}>Paso 2 de {totalSteps}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.chipsContainer}>
              {currentMoods.map((item, index) => {
                return (
                  <View key={item.id} style={styles.chipWrapper}>
                    <ChoiceChip
                      iconName={item.id}
                      label={item.label}
                      category={parentCategory ?? 'food'}
                      selected={false}
                      onPress={() => handleSelect(item.id)}
                      halfWidth
                      index={index}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
