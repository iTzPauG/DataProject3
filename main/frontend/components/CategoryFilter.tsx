/**
 * CategoryFilter — horizontal editorial chips.
 *
 * Pills are now text-first: no leading emoji, no filled brand background on
 * the active chip.  The active state is a subtle ink-filled pill with a
 * contrasting label — the emoji/icon in front of each label has been
 * removed entirely because it previously came from an unescaped Unicode
 * glyph that leaked through as "🍴 Comida y bebida".
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Category } from '../types';
import { useTheme } from '../utils/theme';

interface Props {
  categories: Category[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
}

export default function CategoryFilter({ categories, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          paddingHorizontal: 4,
          paddingVertical: 2,
          gap: 6,
        },
        pill: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.stroke,
          backgroundColor: 'transparent',
        },
        pillActive: {
          backgroundColor: colors.ink,
          borderColor: colors.ink,
        },
        label: {
          fontSize: 13,
          fontWeight: '500',
          letterSpacing: -0.1,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        labelActive: {
          color: colors.shell,
          fontWeight: '600',
        },
      }),
    [colors, typography],
  );

  const chip = (
    key: string,
    label: string,
    isActive: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.pill, isActive && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, isActive && styles.labelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {chip('__all__', t('common.all'), selected === null, () => onSelect(null))}
        {categories.map((cat) =>
          chip(cat.id, cat.label, selected === cat.id, () =>
            onSelect(selected === cat.id ? null : cat.id),
          ),
        )}
      </ScrollView>
    </View>
  );
}

