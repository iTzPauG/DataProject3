import { router } from 'expo-router';
import React, { useEffect, useRef, useMemo, useState } from 'react';
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
import { useLocation } from '../hooks/useLocation';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { city } = useLocation();
  
  const exploreVerbs = useMemo(() => t('explore.exploreVerbs', { returnObjects: true }) as string[], [t]);
  const randomVerb = useMemo(() => {
    if (Array.isArray(exploreVerbs) && exploreVerbs.length > 0) {
      return exploreVerbs[Math.floor(Math.random() * exploreVerbs.length)];
    }
    return "Explore";
  }, [exploreVerbs]);

  const [currentSloganIndex, setCurrentSloganIndex] = useState(0);
  const sloganOpacity = useSharedValue(1);

  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  
  const verbOpacity = useSharedValue(0);
  const verbY = useSharedValue(10);
  
  const cityOpacity = useSharedValue(0);
  const cityY = useSharedValue(10);

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
    headlineContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 24,
      gap: 8,
    },
    verb: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.ink,
      fontFamily: typography.heading,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    city: {
      fontSize: 32,
      fontWeight: '300',
      color: colors.brand,
      fontFamily: typography.heading,
    },
    tagline: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.inkMuted,
      marginTop: 12,
      fontFamily: typography.body,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.brand,
    },
  }), [colors, typography]);

  useEffect(() => {
    // Phase 1: Logo Reveal - Premium Spring
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { 
      damping: 12, 
      stiffness: 90, 
      mass: 1,
      velocity: 2
    });

    // Phase 2: Headline Stagger (Verb then City)
    verbOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
    verbY.value = withDelay(600, withSpring(0, { damping: 15 }));

    cityOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));
    cityY.value = withDelay(900, withSpring(0, { damping: 15 }));

    // Phase 3: Tagline
    tagOpacity.value = withDelay(1400, withTiming(1, { duration: 800 }));

    // Phase 4: Organic Spring-based Dots
    const pulseDot = (delay: number) =>
      withDelay(
        2000 + delay,
        withRepeat(
          withSequence(
            withSpring(1, { damping: 10, stiffness: 100 }),
            withSpring(0.2, { damping: 10, stiffness: 100 }),
          ),
          -1,
        ),
      );
    dot1.value = pulseDot(0);
    dot2.value = pulseDot(200);
    dot3.value = pulseDot(400);

    // Slogan Rotation Logic
    const sloganInterval = setInterval(() => {
      sloganOpacity.value = withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 400 })
      );
      setTimeout(() => {
        setCurrentSloganIndex((prev) => (prev + 1) % SLOGANS.length);
      }, 400);
    }, 3000);

    // Phase 5: Fade out and navigate
    const navTimer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;
      containerOpacity.value = withTiming(0, { duration: 600 });
      setTimeout(() => router.replace('/(tabs)'), 600);
    }, 5000);

    return () => {
      clearTimeout(navTimer);
      clearInterval(sloganInterval);
    };
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const verbStyle = useAnimatedStyle(() => ({
    opacity: verbOpacity.value,
    transform: [{ translateY: verbY.value }],
  }));

  const cityStyle = useAnimatedStyle(() => ({
    opacity: cityOpacity.value,
    transform: [{ translateY: cityY.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
  }));

  const sloganStyle = useAnimatedStyle(() => ({
    opacity: sloganOpacity.value,
  }));

  const makeDotStyle = (sv: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: sv.value,
      transform: [{ scale: 0.6 + sv.value * 0.6 }],
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
            source={require('../assets/gado-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={dynamicStyles.headlineContainer}>
          <Animated.Text style={[dynamicStyles.verb, verbStyle]}>
            {randomVerb}
          </Animated.Text>
          <Animated.Text style={[dynamicStyles.city, cityStyle]}>
            {city || "València"}
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[tagStyle, sloganStyle]}>
          <Animated.Text style={dynamicStyles.tagline}>
            {SLOGANS[currentSloganIndex]}
          </Animated.Text>
        </Animated.View>

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
    gap: 12,
    marginTop: 48,
  },
});
