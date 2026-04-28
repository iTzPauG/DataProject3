import { router } from 'expo-router';
import React, { useEffect, useRef, useMemo } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../utils/theme';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.38, 150);

const SLOGANS = [
  "Tu próxima aventura comienza aquí",
  "Descubre los mejores rincones",
  "Tu guía local de confianza",
  "Explora, vota y comparte",
  "Lo mejor de la ciudad a un clic",
];

export default function SplashScreen() {
  const { colors, typography } = useTheme();
  const slogan = useRef(SLOGANS[Math.floor(Math.random() * SLOGANS.length)]).current;
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(16);
  const tagOpacity = useSharedValue(0);
  const dot1 = useSharedValue(0.2);
  const dot2 = useSharedValue(0.2);
  const dot3 = useSharedValue(0.2);
  const containerOpacity = useSharedValue(1);

  const navigated = useRef(false);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    title: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.ink,
      letterSpacing: 8,
      marginTop: 24,
      fontFamily: typography.heading,
    },
    tagline: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.inkMuted,
      marginTop: 8,
      fontFamily: typography.body,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.brand,
    },
  }), [colors, typography]);

  useEffect(() => {
    // Phase 1: Logo fades in slowly
    logoOpacity.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) });
    logoScale.value = withSpring(1, { damping: 20, stiffness: 60, mass: 1.2 });

    // Phase 2: "WHIM" text slides up
    titleOpacity.value = withDelay(900, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }));
    titleY.value = withDelay(900, withSpring(0, { damping: 20, stiffness: 70 }));

    // Phase 3: Tagline
    tagOpacity.value = withDelay(1600, withTiming(1, { duration: 700 }));

    // Phase 4: Loading dots pulse
    const pulseDot = (delay: number) =>
      withDelay(
        2300 + delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.2, { duration: 450, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
        ),
      );
    dot1.value = pulseDot(0);
    dot2.value = pulseDot(150);
    dot3.value = pulseDot(300);

    // Phase 5: Fade out and navigate
    const navTimer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;
      containerOpacity.value = withTiming(0, { duration: 500 });
      setTimeout(() => router.replace('/(tabs)'), 500);
    }, 4000);

    return () => clearTimeout(navTimer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
  }));

  const makeDotStyle = (sv: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ scale: 0.6 + sv.value * 0.4 }],
    }));

  const dot1Style = makeDotStyle(dot1);
  const dot2Style = makeDotStyle(dot2);
  const dot3Style = makeDotStyle(dot3);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[dynamicStyles.container, containerStyle]}>
      <Animated.View style={styles.content}>
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image
            source={require('../assets/whim-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.Text style={[dynamicStyles.title, titleStyle]}>WHIM</Animated.Text>

        <Animated.Text style={[dynamicStyles.tagline, tagStyle]}>
          {slogan}
        </Animated.Text>

        <Animated.View style={[styles.dotsRow, tagStyle]}>
          <Animated.View style={[dynamicStyles.dot, dot1Style]} />
          <Animated.View style={[dynamicStyles.dot, dot2Style]} />
          <Animated.View style={[dynamicStyles.dot, dot3Style]} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 36,
  },
});
