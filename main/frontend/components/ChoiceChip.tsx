import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../utils/theme";
import CategoryMonogram from "./CategoryMonogram";

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
  const { colors, typography, space } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  const styles = React.useMemo(() => StyleSheet.create({
    wrapper: {
      width: halfWidth ? "48%" : "100%",
    },
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      borderRadius: 12,
      backgroundColor: selected ? colors.surface : "transparent",
      borderWidth: 1,
      borderColor: selected ? colors.brand : colors.stroke,
    },
    containerPressed: {
      opacity: 0.8,
      backgroundColor: colors.surface,
    },
    content: {
      flex: 1,
      marginLeft: space.md,
    },
    label: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: typography.heading,
      letterSpacing: -0.2,
    },
    labelSelected: {
      color: colors.brand,
    },
  }), [colors, typography, space, selected, halfWidth]);

  useEffect(() => {
    const delay = index * 40;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 90 }));
  }, [index, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, animStyle]}>
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <View
            style={[
              styles.container,
              pressed && styles.containerPressed,
            ]}
          >
            <CategoryMonogram 
              categoryId={iconName} 
              label={label} 
              size={36} 
              variant={selected ? 'filled' : 'ring'}
            />
            <View style={styles.content}>
              <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
