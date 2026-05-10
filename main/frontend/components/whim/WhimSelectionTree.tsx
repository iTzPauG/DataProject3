import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { whimTheme } from '../../constants/whimTheme';

const { width } = Dimensions.get('window');

const FOOD_CATEGORIES = [
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'hamburguesa', label: 'Hamburguesa', emoji: '🍔' },
  { id: 'japones', label: 'Japonés', emoji: '🍣' },
  { id: 'italiano', label: 'Italiano', emoji: '🍝' },
  { id: 'tapas', label: 'Tapas', emoji: '🧆' },
  { id: 'bocadillos', label: 'Bocadillos', emoji: '🥖' },
  { id: 'cafeteria', label: 'Cafetería', emoji: '☕' },
  { id: 'panaderia', label: 'Panadería', emoji: '🥐' },
];

const SPEED_OPTIONS = [
  { id: 'quick', label: 'Quick', emoji: '⚡' },
  { id: 'sit', label: 'Sentarse', emoji: '🪑' },
  { id: 'takeaway', label: 'Para llevar', emoji: '📦' },
];

const BUDGET_OPTIONS = [
  { id: '1', label: '€' },
  { id: '2', label: '€€' },
  { id: '3', label: '€€€' },
];

const MOOD_OPTIONS = [
  { id: 'romantico', label: 'Romántico' },
  { id: 'animado', label: 'Animado' },
  { id: 'tranquilo', label: 'Tranquilo' },
  { id: 'familiar', label: 'Familiar' },
  { id: 'terraza', label: 'Terraza' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FoodCard = ({ item, isSelected, onPress }: { item: any, isSelected: boolean, onPress: () => void }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1.05, whimTheme.animation.spring),
      withSpring(1, whimTheme.animation.spring)
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable onPress={handlePress} style={[styles.foodCardContainer, animatedStyle]}>
      {isSelected ? (
        <LinearGradient
          colors={[whimTheme.colors.accent.food, '#D9381E']}
          style={styles.foodCard}
        >
          <Text style={styles.foodEmoji}>{item.emoji}</Text>
          <Text style={[styles.foodLabel, { color: '#FFF' }]}>{item.label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.foodCard, { backgroundColor: whimTheme.colors.surface }]}>
          <Text style={styles.foodEmoji}>{item.emoji}</Text>
          <Text style={styles.foodLabel}>{item.label}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
};

export const WhimSelectionTree = ({ onSearch }: { onSearch?: (selections: any) => void }) => {
  const { t } = useTranslation();
  const [selections, setSelections] = useState({
    food: null as string | null,
    speed: null as string | null,
    budget: null as string | null,
    mood: null as string | null,
  });

  const hasSelection = Object.values(selections).some(val => val !== null);
  const isConflicting = selections.food === 'cafeteria' && selections.mood === 'romantico';

  const toggleSelection = (category: keyof typeof selections, id: string) => {
    setSelections(prev => ({
      ...prev,
      [category]: prev[category] === id ? null : id
    }));
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Section 1: Food */}
        <Text style={styles.sectionTitle}>{t('whim.selection.foodTitle')}</Text>
        <View style={styles.grid}>
          {FOOD_CATEGORIES.map(item => (
            <FoodCard
              key={item.id}
              item={item}
              isSelected={selections.food === item.id}
              onPress={() => toggleSelection('food', item.id)}
            />
          ))}
        </View>

        {/* Section 2: Speed */}
        <Text style={styles.sectionTitle}>{t('whim.selection.speedTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {SPEED_OPTIONS.map(item => {
            const isSelected = selections.speed === item.id;
            return (
              <Pressable 
                key={item.id} 
                onPress={() => toggleSelection('speed', item.id)}
                style={[styles.pill, isSelected && { backgroundColor: whimTheme.colors.accent.teal, borderColor: whimTheme.colors.accent.teal }]}
              >
                <Text style={styles.pillEmoji}>{item.emoji}</Text>
                <Text style={[styles.pillLabel, isSelected && { color: '#12122A', fontWeight: 'bold' }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section 3: Budget */}
        <Text style={styles.sectionTitle}>{t('whim.selection.budgetTitle')}</Text>
        <View style={styles.segmentedControl}>
          {BUDGET_OPTIONS.map(item => {
            const isSelected = selections.budget === item.id;
            return (
              <Pressable 
                key={item.id} 
                onPress={() => toggleSelection('budget', item.id)}
                style={[styles.segment, isSelected && { backgroundColor: whimTheme.colors.accent.violet }]}
              >
                <Text style={[styles.segmentLabel, isSelected && { color: '#FFF', fontWeight: 'bold' }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Section 4: Mood */}
        <Text style={styles.sectionTitle}>{t('whim.selection.moodTitle')}</Text>
        <View style={styles.rowWrap}>
          {MOOD_OPTIONS.map(item => {
            const isSelected = selections.mood === item.id;
            return (
              <Pressable 
                key={item.id} 
                onPress={() => toggleSelection('mood', item.id)}
              >
                <LinearGradient
                  colors={isSelected ? [whimTheme.colors.accent.mood, '#9D4EDD'] : [whimTheme.colors.surface, whimTheme.colors.surface]}
                  style={[styles.moodCard, isSelected && styles.moodCardSelected]}
                >
                  <Text style={[styles.moodLabel, isSelected && { color: '#FFF' }]}>{item.label}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CTA Bottom */}
      <View style={styles.ctaContainer}>
        {isConflicting && (
          <Text style={styles.conflictText}>{t('whim.selection.conflict')}</Text>
        )}
        <Pressable 
          disabled={!hasSelection}
          onPress={() => onSearch && onSearch(selections)}
          style={({ pressed }) => [styles.ctaWrapper, pressed && { opacity: 0.8 }, (!hasSelection || isConflicting) && { opacity: 0.4 }]}
        >
          <LinearGradient 
            colors={hasSelection ? [whimTheme.colors.accent.teal, whimTheme.colors.accent.violet] : [whimTheme.colors.surface, whimTheme.colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            <Text style={[styles.ctaText, !hasSelection && { color: whimTheme.colors.text.secondary }]}>{t('whim.selection.search')}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: whimTheme.colors.bg,
  },
  scrollContent: {
    padding: 24,
  },
  sectionTitle: {
    fontFamily: whimTheme.fonts.display,
    fontSize: 20,
    color: whimTheme.colors.text.primary,
    marginTop: 32,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  foodCardContainer: {
    width: (width - 60) / 2,
    height: 100,
  },
  foodCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: whimTheme.colors.surface,
  },
  foodEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  foodLabel: {
    fontFamily: whimTheme.fonts.foodCategory,
    color: whimTheme.colors.text.secondary,
    fontSize: 16,
  },
  row: {
    gap: 12,
    paddingRight: 24,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: whimTheme.colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: whimTheme.colors.surface,
  },
  pillEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  pillLabel: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 14,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: whimTheme.colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  segmentLabel: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 16,
  },
  moodCard: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: whimTheme.colors.surface,
  },
  moodCardSelected: {
    borderColor: 'transparent',
  },
  moodLabel: {
    fontFamily: whimTheme.fonts.body,
    color: whimTheme.colors.text.secondary,
    fontSize: 14,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: whimTheme.colors.bg + 'F0', // semi-transparent
  },
  conflictText: {
    fontFamily: whimTheme.fonts.body,
    color: '#FFD166', // amber
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 12,
  },
  ctaWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaButton: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: whimTheme.fonts.display,
    color: '#FFF',
    fontSize: 18,
  }
});
