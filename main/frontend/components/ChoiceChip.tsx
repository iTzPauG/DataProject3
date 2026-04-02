import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../utils/theme";
import GADOIcon from "./GADOIcon";

interface Props {
  label: string;
  iconName?: string;
  selected: boolean;
  onPress: () => void;
  category?: string;
  halfWidth?: boolean;
  index?: number;
}

export default function ChoiceChip({
  label,
  iconName,
  selected,
  onPress,
  category,
  halfWidth = false,
  index = 0,
}: Props) {
  const { colors, radii, typography } = useTheme();
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  const styles = useMemo(() => StyleSheet.create({
    halfWidth: {
      width: "48%",
    },
    chip: {
      minHeight: 48,
      borderRadius: radii.pill,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    chipSelected: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    chipPressed: {
      opacity: 0.9,
    },
    label: {
      color: colors.inkMuted,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: typography.body,
    },
    labelSelected: {
      color: colors.surface,
    },
  }), [colors, radii, typography]);

  useEffect(() => {
    const delay = index * 50;
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 150 }));
  }, [index, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[halfWidth && styles.halfWidth, animStyle]}>
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <View
            style={[
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
          >
            {iconName ? (
              <GADOIcon
                category={category}
                name={iconName}
                size={18}
                color={selected ? colors.surface : colors.brand}
              />
            ) : null}
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
