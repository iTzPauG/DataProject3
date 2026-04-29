import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export default function AnimatedTabScene({
  children,
}: {
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 0.65;
      translateY.value = 14;
      opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    }, [opacity, translateY]),
  );

  const style = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
