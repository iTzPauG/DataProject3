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
  iconName: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  category?: string;
  index?: number;
}

export default function ChoiceCard({
  iconName,
  label,
  selected,
  onPress,
  category,
  index = 0,
}: Props) {
  const { colors, radii, shadows, typography } = useTheme();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      width: "50%",
      padding: 8,
    },
    card: {
      minHeight: 154,
      borderRadius: radii.lg,
      paddingHorizontal: 16,
      paddingVertical: 18,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      ...shadows.soft,
    },
    cardSelected: {
      borderColor: colors.brand,
      backgroundColor: colors.chip,
    },
    cardPressed: {
      transform: [{ scale: 0.98 }],
    },
    iconBadge: {
      width: 68,
      height: 68,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.chip,
      marginBottom: 14,
    },
    iconBadgeSelected: {
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.brand,
    },
    label: {
      textAlign: "center",
      color: colors.ink,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    labelSelected: {
      color: colors.brandDeep,
    },
  }), [colors, radii, shadows, typography]);

  useEffect(() => {
    const delay = index * 70;
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 120 }));
  }, [index, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.card,
            selected && styles.cardSelected,
            pressed && styles.cardPressed,
            animStyle,
          ]}
        >
          <View style={[styles.iconBadge, selected && styles.iconBadgeSelected]}>
            <GADOIcon
              category={category}
              name={iconName}
              size={34}
              color={selected ? colors.brandDeep : colors.brand}
            />
          </View>
          <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
            {label}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}
