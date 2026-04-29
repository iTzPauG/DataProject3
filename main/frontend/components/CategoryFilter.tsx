/**
 * CategoryFilter — horizontal scrollable pills for map category filtering.
 */
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Category } from '../types';
import { useTheme } from '../utils/theme';

interface Props {
  categories: Category[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
  showAllOption?: boolean;
  allowDeselectActive?: boolean;
}

export default function CategoryFilter({
  categories,
  selected,
  onSelect,
  showAllOption = true,
  allowDeselectActive = true,
}: Props) {
  const { colors, typography, shadows, radii } = useTheme();

  const dynamicStyles = useMemo(() => StyleSheet.create({
    pill: {
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.stroke,
      ...shadows.soft,
    },
    pillActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    pillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    pillTextActive: {
      color: '#FFFFFF',
    },
  }), [colors, typography, shadows, radii]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {showAllOption ? (
          <TouchableOpacity
            style={[dynamicStyles.pill, !selected && dynamicStyles.pillActive]}
            onPress={() => onSelect(null)}
            activeOpacity={0.7}
          >
            <Text style={[dynamicStyles.pillText, !selected && dynamicStyles.pillTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
        ) : null}

        {categories.map((cat) => {
          const isActive = selected === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                dynamicStyles.pill,
                isActive && { backgroundColor: cat.color || colors.brand, borderColor: cat.color || colors.brand },
              ]}
              onPress={() => onSelect(isActive && allowDeselectActive ? null : cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  dynamicStyles.pillText,
                  isActive && dynamicStyles.pillTextActive,
                ]}
              >
                {cat.icon} {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
  },
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
});
