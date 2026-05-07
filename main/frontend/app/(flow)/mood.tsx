import { router } from 'expo-router';
import { Ionicons } from '../../components/SafeIonicons';
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
import { CategoryFlowOption, CategoryFlowResponse, getCategoryFlow } from '../../services/api';
import { useTheme } from '../../utils/theme';

export default function MoodScreen() {
  const { colors, typography, space } = useTheme();
  const { parentCategory, category, setMood } = useFlowState();

  const DEFAULT_MOODS = useMemo<CategoryFlowOption[]>(() => [
    { id: 'popular', label: 'Popular', emoji: '🔥' },
    { id: 'quiet', label: 'Tranquilo', emoji: '🧘' },
    { id: 'busy', label: 'Movido', emoji: '⚡' },
  ], []);

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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingBottom: space.hero,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: space.lg,
      gap: 12,
    },
  }), [colors, typography, space]);

  const [flow, setFlow] = useState<CategoryFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolvedParentCategory = parentCategory ?? 'food';
    setLoading(true);
    getCategoryFlow(resolvedParentCategory)
      .then(setFlow)
      .finally(() => setLoading(false));
  }, [parentCategory]);

  const currentMoods = useMemo(() => {
    const source = flow?.moods && flow.moods.length > 0 ? flow.moods : DEFAULT_MOODS;
    if ((parentCategory ?? 'food') !== 'food') {
      return source;
    }

    const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
    let hasGourmet = source.some((item) => norm(item.id) === 'gourmet');
    const cleaned: typeof source = [];

    for (const item of source) {
      const id = norm(item.id);
      const label = norm(item.label);
      const isTapasMood = id === 'tapas' || label.includes('tapas');

      if (!isTapasMood) {
        cleaned.push(item);
        continue;
      }

      if (!hasGourmet) {
        cleaned.push({
          ...item,
          id: 'gourmet',
          label: 'Gourmet',
          emoji: item.emoji || '🍷',
        });
        hasGourmet = true;
      }
    }

    return cleaned;
  }, [flow, DEFAULT_MOODS, parentCategory]);

  const screenTitle = flow?.category.mood_title ?? '¿Qué ambiente buscas?';
  const screenSubtitle = flow?.category.mood_subtitle ?? 'Selecciona el estado de ánimo';
  
  const shouldSkipPrice = useMemo(() => {
    if (!flow?.category.requires_price) return true;
    const skipSubcats = flow.category.skip_price_subcategories || [];
    if (category && skipSubcats.includes(category)) return true;
    return false;
  }, [flow, category]);

  const totalSteps = shouldSkipPrice ? 2 : 3;

  function handleSelect(id: string) {
    setMood(id);
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
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.step}>Paso 2 de {totalSteps}</Text>
          <Text style={styles.title}>{screenTitle}</Text>
          <Text style={styles.subtitle}>{screenSubtitle}</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.chipsContainer}>
              {currentMoods.map((item, index) => (
                <ChoiceChip
                  key={item.id}
                  iconName={item.id}
                  emoji={item.emoji}
                  label={item.label}
                  category={parentCategory ?? 'food'}
                  selected={false}
                  onPress={() => handleSelect(item.id)}
                  halfWidth
                  index={index}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
