import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { categoryAccents, monogramFor } from '../constants/design';
import { useTheme } from '../utils/theme';

interface Props {
  /** Category id used to pick the accent color from categoryAccents. */
  categoryId?: string | null;
  /** Label the monogram is derived from (first Unicode letter). */
  label: string;
  /** Outer diameter. */
  size?: number;
  /** Visual variant — `ring` (default) = hairline outline, `filled` = tinted fill. */
  variant?: 'ring' | 'filled';
  /** Override stroke/ring colour. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * CategoryMonogram — editorial replacement for the emoji-in-chip icon.
 *
 * Renders a hairline circle with the category's first letter inside, tinted
 * to its family accent.  Works identically on web and native, matches the
 * magazine-caption feel of the redesign.
 */
export default function CategoryMonogram({
  categoryId,
  label,
  size = 44,
  variant = 'ring',
  color,
  style,
}: Props): React.ReactElement {
  const { colors, typography } = useTheme();
  const accent =
    color ??
    (categoryId && categoryAccents[categoryId]) ??
    categoryAccents.default;
  const letter = monogramFor(label);

  const isFilled = variant === 'filled';
  const stroke = Math.max(1, Math.round(size * 0.04));

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: isFilled ? 0 : stroke,
          borderColor: accent,
          backgroundColor: isFilled ? accent : 'transparent',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.42,
          lineHeight: size * 0.42 * 1.1,
          color: isFilled ? colors.shell : accent,
          fontFamily: typography.heading,
          fontWeight: '500',
          letterSpacing: -0.4,
          textAlign: 'center',
          includeFontPadding: false,
        }}
      >
        {letter}
      </Text>
    </View>
  );
}
