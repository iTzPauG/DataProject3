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
import CategoryMonogram from "./CategoryMonogram";

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
  const { colors, typography, space } = useTheme();
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-10);

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      width: "100%",
    },
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    containerSelected: {
      backgroundColor: colors.surface,
    },
    containerPressed: {
      backgroundColor: colors.surface,
      opacity: 0.8,
    },
    content: {
      flex: 1,
      marginLeft: space.lg,
    },
    label: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: "600",
      fontFamily: typography.heading,
      letterSpacing: -0.4,
    },
    labelSelected: {
      color: colors.brand,
    },
    arrow: {
      color: colors.inkWhisper,
      fontSize: 20,
      fontFamily: typography.mono,
    }
  }), [colors, typography, space]);

  useEffect(() => {
    const delay = index * 40;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateX.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 90 }));
  }, [index, opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.container,
            selected && styles.containerSelected,
            pressed && styles.containerPressed,
            animStyle,
          ]}
        >
          <CategoryMonogram 
            categoryId={iconName} 
            label={label} 
            size={48} 
            variant={selected ? 'filled' : 'ring'}
          />
          <View style={styles.content}>
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}
