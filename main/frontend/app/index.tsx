import { router } from 'expo-router';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../utils/theme';
import { useLocation } from '../hooks/useLocation';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.38, 150);

const useDotStyle = (sv: Animated.SharedValue<number>) =>
  useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ scale: 0.6 + sv.value * 0.6 }],
  }));

export default function SplashScreen() {
  const { typography } = useTheme();
  const { t } = useTranslation();
  const { city } = useLocation();
  const splash = useMemo(
    () => ({
      bg: "#F2F6FC",
      ink: "#13233C",
      muted: "#4B5D79",
      brand: "#2B63E0",
      blobA: "#9DBBFF",
      blobB: "#C8F0DF",
      logo: "#13233C",
    }),
    []
  );
  
  const slogans = useMemo(() => t('splash.slogans', { returnObjects: true }) as string[] || [], [t]);
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

  // Mesh gradient animation values
  const blob1X = useSharedValue(-width * 0.2);
  const blob1Y = useSharedValue(-height * 0.1);
  const blob2X = useSharedValue(width * 0.6);
  const blob2Y = useSharedValue(height * 0.6);

  const navigated = useRef(false);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: splash.bg,
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
      color: splash.ink,
      fontFamily: typography.heading,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    city: {
      fontSize: 32,
      fontWeight: '300',
      color: splash.brand,
      fontFamily: typography.heading,
    },
    tagline: {
      fontSize: 15,
      fontWeight: '400',
      color: splash.muted,
      marginTop: 12,
      fontFamily: typography.body,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: splash.brand,
    },
  }), [splash, typography]);

  useEffect(() => {
    // Mesh gradient slow movement
    blob1X.value = withRepeat(withTiming(width * 0.4, { duration: 15000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob1Y.value = withRepeat(withTiming(height * 0.3, { duration: 18000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob2X.value = withRepeat(withTiming(width * 0.1, { duration: 20000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob2Y.value = withRepeat(withTiming(height * 0.2, { duration: 16000, easing: Easing.inOut(Easing.ease) }), -1, true);

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

    // Slogan Rotation Logic - Clean Reanimated approach
    let sloganInterval: NodeJS.Timeout;
    if (slogans.length > 1) {
      sloganInterval = setInterval(() => {
        sloganOpacity.value = withSequence(
          withTiming(0, { duration: 400 }, (finished) => {
            if (finished) {
              runOnJS(setCurrentSloganIndex)((prev) => (prev + 1) % slogans.length);
            }
          }),
          withTiming(1, { duration: 400 })
        );
      }, 3000);
    }

    // Phase 5: Fade out and navigate
    const navTimer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;
      containerOpacity.value = withTiming(0, { duration: 600 });
      setTimeout(() => router.replace('/(tabs)'), 600);
    }, 5000);

    return () => {
      clearTimeout(navTimer);
      if (sloganInterval) clearInterval(sloganInterval);
    };
  }, [slogans.length]);

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

  const dot1Style = useDotStyle(dot1);
  const dot2Style = useDotStyle(dot2);
  const dot3Style = useDotStyle(dot3);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const blob1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob1X.value }, { translateY: blob1Y.value }],
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob2X.value }, { translateY: blob2Y.value }],
  }));

  return (
    <Animated.View style={[dynamicStyles.container, containerStyle]}>
      {/* Mesh Gradient Background */}
      <View style={StyleSheet.absoluteFillObject}>
        <Animated.View style={[styles.blob, { backgroundColor: splash.blobA }, blob1Style]} />
        <Animated.View style={[styles.blob, { backgroundColor: splash.blobB, width: width * 1.2, height: width * 1.2 }, blob2Style]} />
        <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
      </View>

      <Animated.View style={styles.content}>
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image
            source={require('../assets/whim-logo-new.png')}
            style={[styles.logo, { tintColor: splash.logo }]}
            resizeMode="contain"
            accessibilityLabel="WHIM Logo"
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
            {slogans[currentSloganIndex]}
          </Animated.Text>
        </Animated.View>

        <Animated.View 
          style={[styles.dotsRow, tagStyle]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden={true}
        >
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
  blob: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    opacity: 0.4,
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
