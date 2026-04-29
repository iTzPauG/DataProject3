import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { useTheme } from '../utils/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: Props) {
  const { colors, radii, shadows, typography } = useTheme();
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  const styles = useMemo(() => StyleSheet.create({
    button: {
      borderRadius: radii.lg,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
    },
    primary: {
      backgroundColor: colors.brand,
    },
    primaryShadow: {
      ...shadows.lift,
    },
    primaryDisabled: {
      backgroundColor: colors.stroke,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.brand,
    },
    secondaryDisabled: {
      borderColor: colors.stroke,
    },
    label: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: typography.heading,
      letterSpacing: 0.2,
    },
    labelPrimary: {
      color: '#FFFFFF',
    },
    labelSecondary: {
      color: colors.brandDeep,
    },
    labelDisabled: {
      color: '#9AA5AB',
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
  }), [colors, radii, shadows, typography]);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        isPrimary && styles.primaryShadow,
        isDisabled && (isPrimary ? styles.primaryDisabled : styles.secondaryDisabled),
        pressed && !isDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? '#FFFFFF' : colors.brand}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            isPrimary ? styles.labelPrimary : styles.labelSecondary,
            isDisabled && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
