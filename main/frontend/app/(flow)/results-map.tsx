import { router, useRootNavigationState } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  Modal,
  ScrollView,
} from "react-native";
import Map from "../../components/map/Map";
import PrimaryButton from "../../components/PrimaryButton";
import RestaurantCard from "../../components/RestaurantCard";
import BottomSheet from "../../components/sheet/BottomSheet";
import WhimIcon from "../../components/WhimIcon";
import { BottomSheetRef } from "../../components/sheet/types";
import { useAppState } from "../../hooks/useAppState";
import { useFlowState } from "../../hooks/useFlowState";
import {
  getVotesBatch,
  recommendRestaurants,
  recommendRestaurantsStream,
  VoteData,
  getBookmarks,
  askBrain,
} from "../../services/api";
import { Restaurant } from "../../types/restaurant";
import { MapItem } from "../../types";
import { formatPriceLevel } from "../../utils/format";
import { useTheme } from "../../utils/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_HEIGHT = 360;
const MAX_RESULTS = 10;

type Status = "loading" | "streaming" | "success" | "error";

// ── Animated loading dots ───────────────────────────────────────────────────

// -- Animated bouncing emojis (shown while loading) -------------------------



const CATEGORY_EMOJIS: Record<string, string[]> = {
  pizza:       ["🍕", "🧀", "🍝", "🧄", "🍽️"],
  hamburger:   ["🍔", "🍟", "🌭", "🧂", "🥬"],
  sushi:       ["🍣", "🍤", "🍥", "🍡", "🍢"],
  paella:      ["🦞", "🐟", "🥦", "🧅", "🍽️"],
  tacos:       ["🌮", "🌯", "🧆", "🌶️", "🥬"],
  healthy:     ["🥗", "🥦", "🥑", "🥬", "🍎"],
  vegan:       ["🌱", "🥦", "🥗", "🥑", "🥬"],
  italian:     ["🍝", "🍕", "🧀", "🍻", "🍷"],
  asian:       ["🍜", "🍣", "🍙", "🍛", "🍢"],
  mexican:     ["🌮", "🌯", "🌶️", "🧆", "🍻"],
  brunch:      ["🍳", "🥞", "🧇", "🥐", "☕"],
  bakery:      ["🥐", "🧁", "🎂", "🍞", "☕"],
  coffee:      ["☕", "🧋", "🍵", "🥐", "🍫"],
  kebab:       ["🥭", "🧆", "🌭", "🧅", "🥦"],
  bar:         ["🍺", "🍻", "🥂", "🍹", "🍷"],
  cocktail:    ["🍹", "🍸", "🍷", "🥂", "🍓"],
  wine_bar:    ["🍷", "🍇", "🥂", "🍹", "🍾"],
  rooftop:     ["🍹", "🌟", "🍷", "🍻", "🥂"],
};

const DEFAULT_EMOJIS = ["🍕", "🍜", "🍣", "🥗", "🍔", "🌮", "🍷", "☕"];

function getEmojisForCategory(cat: string | null): string[] {
  if (!cat) return DEFAULT_EMOJIS;
  return CATEGORY_EMOJIS[cat] ?? DEFAULT_EMOJIS;
}

function BouncingEmoji({ emoji, delay }: { emoji: string; delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, { toValue: -14, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.delay(800),
      ]),
    ).start();
  }, [delay, translateY]);

  return (
    <Animated.Text style={{ fontSize: 26, transform: [{ translateY }] }}>
      {emoji}
    </Animated.Text>
  );
}

function LoadingEmojis({ category }: { category: string | null }) {
  const emojis = getEmojisForCategory(category);
  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 8 }}>
      {emojis.map((emoji, i) => (
        <BouncingEmoji key={i} emoji={emoji} delay={i * 120} />
      ))}
    </View>
  );
}

function PulsingDot({ delay, color }: { delay: number; color: string }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: false }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 0.4, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0.3, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: false }),
          ]),
        ]),
      ).start();
    };
    animate();
  }, [delay, opacity, scale]);

  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

function LoadingIndicator({ message, sub }: { message: string; sub?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 28, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
        <PulsingDot delay={0} color={colors.brand} />
        <PulsingDot delay={200} color={colors.brand} />
        <PulsingDot delay={400} color={colors.brand} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.ink, textAlign: "center", fontFamily: typography.heading }}>
        {message}
      </Text>
      {sub ? (
        <Text style={{ marginTop: 6, fontSize: 13, color: colors.inkMuted, textAlign: "center", lineHeight: 19, fontFamily: typography.body }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function StreamingIndicator({ found, total }: { found: number; total?: number }) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10 }}>
      <ActivityIndicator size="small" color={colors.brand} />
      <Text style={{ fontSize: 13, color: colors.inkMuted, fontFamily: typography.body }}>
        {total
          ? t("flow.foundCountOf", { count: found, total })
          : t("flow.foundCount", { count: found })}
      </Text>
    </View>
  );
}

// ── Animated card wrapper ───────────────────────────────────────────────────
// Animates only on MOUNT — stable key (restaurant.id) prevents re-animation
// when other cards arrive.

function AnimatedCard({ children }: { children: React.ReactNode }) {
  const slideY = useRef(new Animated.Value(48)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: false,
        damping: 22,
        stiffness: 260,
        mass: 0.7,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
        damping: 20,
        stiffness: 240,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: runs once on mount only

  return (
    <Animated.View style={{ transform: [{ translateY: slideY }, { scale }], opacity }}>
      {children}
    </Animated.View>
  );
}

// ── Hero loading (full-screen, shown when no results yet) ───────────────────

function MapStatusHero({
  status,
  categoryLabel,
  moodLabel,
  priceLabel,
  errorMsg,
}: {
  status: Status;
  categoryLabel: string;
  moodLabel: string;
  priceLabel: string;
  errorMsg: string;
}) {
  const { t } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();

  // Animated glow
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status === "loading") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]),
      ).start();
    }
  }, [glowAnim, status]);

  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.18, 0.08] });

  const styles = useMemo(() => StyleSheet.create({
    mapPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.shell,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    mapGlowA: {
      position: "absolute",
      top: 70,
      left: -30,
      width: 220,
      height: 220,
      borderRadius: 999,
      backgroundColor: colors.brand,
    },
    mapGlowB: {
      position: "absolute",
      right: -20,
      bottom: 160,
      width: 260,
      height: 260,
      borderRadius: 999,
      backgroundColor: "rgba(59,130,246,0.6)",
    },
    mapGrid: {
      position: "absolute",
      inset: 0,
      opacity: 0.12,
      justifyContent: "space-evenly",
      paddingHorizontal: 26,
    },
    mapGridRow: { height: 1, backgroundColor: colors.stroke },
    mapStatusCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: "rgba(20,24,38,0.85)",
      borderRadius: radii.xl,
      paddingHorizontal: 22,
      paddingVertical: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      ...shadows.soft,
    },
    eyebrow: {
      color: colors.brand,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      fontFamily: typography.body,
      marginBottom: 10,
    },
    headline: {
      color: colors.ink,
      fontSize: 28,
      lineHeight: 32,
      fontWeight: "800",
      fontFamily: typography.heading,
    },
    description: {
      marginTop: 10,
      color: "rgba(255,255,255,0.78)",
      fontSize: 14,
      lineHeight: 21,
      fontFamily: typography.body,
    },
    pillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 16,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.pill,
      backgroundColor: "rgba(255,255,255,0.08)",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    pillText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: "700",
      fontFamily: typography.body,
      marginLeft: 6,
    },
    dotsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 20,
      justifyContent: "center",
    },
  }), [colors, radii, shadows, typography]);

  const isLoading = status === "loading";
  const isError = status === "error";

  const eyebrow = isLoading ? t("flow.searchingNearby") : isError ? t("flow.searchPaused") : t("flow.noMatches");
  const title = isLoading ? t("flow.preparingList") : isError ? t("flow.searchError") : t("flow.noResults");
  const description = isLoading
    ? t("flow.analyzingDescription")
    : isError
      ? errorMsg || t("flow.requestFailed")
      : t("flow.noResultsMsg");

  return (
    <View style={styles.mapPlaceholder}>
      <Animated.View style={[styles.mapGlowA, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
      <Animated.View style={[styles.mapGlowB, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
      <View style={styles.mapGrid}>
        {[0, 1, 2, 3, 4].map((row) => (
          <View key={row} style={styles.mapGridRow} />
        ))}
      </View>

      <View style={styles.mapStatusCard}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headline}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.pillsRow}>
          {categoryLabel ? <View style={styles.pill}><WhimIcon name="bookmark" size={14} color={colors.ink} /><Text style={styles.pillText}>{categoryLabel}</Text></View> : null}
          {moodLabel ? <View style={styles.pill}><WhimIcon name="happy" size={14} color={colors.ink} /><Text style={styles.pillText}>{moodLabel}</Text></View> : null}
          {priceLabel ? <View style={styles.pill}><WhimIcon name="cash" size={14} color={colors.ink} /><Text style={styles.pillText}>{priceLabel}</Text></View> : null}
        </View>
        {isLoading && (
          <View style={styles.dotsRow}>
            <PulsingDot delay={0} color={colors.brand} />
            <PulsingDot delay={200} color={colors.brand} />
            <PulsingDot delay={400} color={colors.brand} />
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function ResultsMapScreen() {
  const { t } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();
  const { parentCategory, category, mood, priceLevel, results, setResults, isHydrated } = useFlowState();

  const styles = useMemo(() => StyleSheet.create({
    topSafe: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    backButton: {
      margin: 16,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    backText: {
      fontSize: 16,
      color: colors.ink,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    sheetHeader: {
      paddingTop: 4,
      paddingBottom: 4,
    },
    sheetTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.ink,
      fontFamily: typography.heading,
      marginBottom: 4,
    },
    sheetCount: {
      color: colors.inkMuted,
      fontSize: 13,
      fontFamily: typography.body,
      marginBottom: 10,
    },
    pills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.chip,
      borderRadius: radii.pill,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    pillText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: "600",
      fontFamily: typography.body,
      marginLeft: 6,
    },
    centered: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 24,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.ink,
      marginBottom: 8,
      textAlign: "center",
      fontFamily: typography.heading,
    },
    errorMsg: {
      fontSize: 14,
      color: colors.inkMuted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
      fontFamily: typography.body,
    },
    retryBtn: {
      width: "100%",
      maxWidth: 260,
    },
    compareBtn: {
      marginTop: 12,
      backgroundColor: colors.brand,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      alignSelf: 'flex-start',
    },
    compareBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: 24,
      width: '100%',
      maxHeight: '80%',
      ...shadows.medium,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 16,
      fontFamily: typography.heading,
    },
    modalText: {
      fontSize: 15,
      color: colors.ink,
      lineHeight: 22,
      fontFamily: typography.body,
    },
    modalCloseBtn: {
      marginTop: 20,
      alignSelf: 'flex-end',
      padding: 10,
    },
    modalCloseText: {
      color: colors.brand,
      fontWeight: '700',
      fontSize: 16,
    },
  }), [colors, radii, shadows, typography]);

  const { mapPreferences } = useAppState();
  const rootNavigationState = useRootNavigationState();
  const canNavigate = Boolean(rootNavigationState?.key);

  const [status, setStatus] = useState<Status>("loading");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [votesMap, setVotesMap] = useState<Record<string, VoteData>>({});
  const [totalExpected, setTotalExpected] = useState<number | undefined>(undefined);
  const [savedItems, setSavedItems] = useState<MapItem[]>([]);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const sheetRef = useRef<BottomSheetRef>(null);
  const fetchingRef = useRef(false);
  const accumulatedRef = useRef<Restaurant[]>([]);

  const loadVotes = useCallback((items: Restaurant[]) => {
    getVotesBatch(items.map((item) => item.id))
      .then(setVotesMap)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!isHydrated || fetchingRef.current) return;

    // Fetch bookmarks
    getBookmarks().then((bookmarks) => {
      const mapItems: MapItem[] = bookmarks.map(b => ({
        item_type: b.item_type,
        item_id: b.item_id,
        category_id: b.category_id,
        title: b.title,
        lat: b.lat,
        lng: b.lng,
        distance_m: 0,
        color: '#FFD700', // Gold color for saved items
        icon: '⭐',
        metadata: b.metadata
      }));
      setSavedItems(mapItems);
    }).catch(() => {});

    if (results !== null) {
      setRestaurants(results.slice(0, MAX_RESULTS));
      setStatus("success");
      loadVotes(results.slice(0, MAX_RESULTS));
      return;
    }

    if (!parentCategory || !category || !mood) {
      if (canNavigate) router.replace("/(flow)/category");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setRestaurants([]);
    setTotalExpected(undefined);
    accumulatedRef.current = [];
    fetchingRef.current = true;

    const lang = mapPreferences.language === "system" ? "es" : mapPreferences.language;

    try {
      await recommendRestaurantsStream(
        { parentCategory, subcategory: category, mood, priceLevel, language: lang },
        {
          onMeta: ({ total }) => {
            setTotalExpected(Math.min(total, MAX_RESULTS));
          },
          onResult: (restaurant) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            if (accumulatedRef.current.length >= MAX_RESULTS) return;
            accumulatedRef.current = [...accumulatedRef.current, restaurant].slice(0, MAX_RESULTS);
            // Progressive UI update
            setRestaurants([...accumulatedRef.current]);
            setResults([...accumulatedRef.current]);
            if (accumulatedRef.current.length === 1) {
              setStatus("streaming");
            }
          },
          onDone: (_total) => {
            setResults(accumulatedRef.current.slice(0, MAX_RESULTS));
            setStatus("success");
            loadVotes(accumulatedRef.current.slice(0, MAX_RESULTS));
          },
          onError: (err) => {
            if (accumulatedRef.current.length > 0) {
              setResults(accumulatedRef.current.slice(0, MAX_RESULTS));
              setStatus("success");
            } else {
              setErrorMsg(err.message);
              setStatus("error");
            }
          },
        },
      );
    } catch {
      // Fallback to non-streaming
      try {
        const { top } = await recommendRestaurants({
          parentCategory,
          subcategory: category,
          mood,
          priceLevel,
          language: lang,
        });
        const limited = top.slice(0, MAX_RESULTS);
        setRestaurants(limited);
        setResults(limited);
        setStatus("success");
        loadVotes(limited);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : t("flow.requestFailed"));
        setStatus("error");
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [canNavigate, category, isHydrated, loadVotes, mapPreferences.language, mood, parentCategory, priceLevel, results, setResults, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePinSelect = useCallback((id: string) => {
    setSelectedId(id);
    const idx = restaurants.findIndex((restaurant) => restaurant.id === id);
    if (idx >= 0) {
      sheetRef.current?.snapToIndex(1);
      sheetRef.current?.scrollToIndex(idx, CARD_HEIGHT);
    }
  }, [restaurants]);

  const handleCardPress = useCallback((id: string) => {
    setSelectedId(id);
    router.push({ pathname: "/(flow)/details", params: { id } });
  }, []);

  const handleCompare = async () => {
    if (!selectedId) return;
    const currentPlace = restaurants.find(r => r.id === selectedId);
    if (!currentPlace) return;

    setIsComparing(true);
    setCompareResult(null);
    try {
      const context = {
        current_place: currentPlace,
        saved_places: savedItems
      };
      const res = await askBrain(`Compara el lugar actual (${currentPlace.name}) con mis lugares guardados. ¿Cuál me recomiendas más y por qué?`, context);
      setCompareResult(res.response);
    } catch (e) {
      setCompareResult("Error al comparar.");
    } finally {
      setIsComparing(false);
    }
  };

  const fmt = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const categoryLabel = category ? fmt(category) : "";
  const moodLabel = mood ? fmt(mood) : "";
  const priceLabel = priceLevel ? formatPriceLevel(priceLevel) : "";

  // Imperatively advance the sheet when streaming finishes — initialSnapIndex is
  // only read at mount, so we need an explicit snap call on the success transition.
  useEffect(() => {
    if (status === "success") {
      sheetRef.current?.snapToIndex(1);
    }
  }, [status]);

  const isStreaming = status === "streaming";
  const hasResults = (restaurants || []).length > 0;
  const showMap = hasResults;

  // ── Sheet header ────────────────────────────────────────────────────────

  // Aggregate review source counts across all loaded restaurants
  const reviewSourceCounts = useMemo(() => {
    const totals = { google: 0, yelp: 0, tripadvisor: 0 };
    for (const r of restaurants) {
      if (r.reviewSources) {
        totals.google += r.reviewSources.google || 0;
        totals.yelp += r.reviewSources.yelp || 0;
        totals.tripadvisor += r.reviewSources.tripadvisor || 0;
      } else {
        for (const rev of r.reviews || []) {
          if (rev.source === "google") totals.google += 1;
          else if (rev.source === "yelp") totals.yelp += 1;
          else if (rev.source === "tripadvisor") totals.tripadvisor += 1;
        }
      }
    }
    // Add log here
    console.log('[WHIM:REVIEWS] Total sources:', totals);
    return totals;
  }, [restaurants]);

  const sheetHeader = (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{t("explore.resultsForYou")}</Text>
      {status === "loading" ? (
        <Text style={styles.sheetCount}>{t("flow.searchingNearbyDots")}</Text>
      ) : null}
      <View style={styles.pills}>
        {categoryLabel ? <View style={styles.pill}><WhimIcon name="bookmark" size={14} color={colors.ink} /><Text style={styles.pillText}>{categoryLabel}</Text></View> : null}
        {moodLabel ? <View style={styles.pill}><WhimIcon name="happy" size={14} color={colors.ink} /><Text style={styles.pillText}>{moodLabel}</Text></View> : null}
        {priceLabel ? <View style={styles.pill}><WhimIcon name="cash" size={14} color={colors.ink} /><Text style={styles.pillText}>{priceLabel}</Text></View> : null}
      </View>
      {selectedId && savedItems.length > 0 && (
        <TouchableOpacity style={styles.compareBtn} onPress={handleCompare} disabled={isComparing}>
          <Text style={styles.compareBtnText}>
            {isComparing ? "Comparando..." : "Comparar con guardados"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Sheet content ───────────────────────────────────────────────────────

  const sheetContent = (() => {
    if (status === "loading" && (!results || results.length === 0)) {
      return (
        <>
          <LoadingEmojis category={category} />
          <LoadingIndicator
            message={t("flow.searchingBestPlaces")}
            sub={t("flow.analyzingDescriptionShort")}
          />
        </>
      );
    }

    if (status === "error") {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{t("flow.searchError")}</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <View style={styles.retryBtn}>
            <PrimaryButton label={t("common.retry")} onPress={() => void load()} />
          </View>
        </View>
      );
    }

    if (status === "success" && restaurants.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{t("flow.noResults")}</Text>
          <Text style={styles.errorMsg}>{t("flow.noResultsMsg")}</Text>
          <View style={styles.retryBtn}>
            <PrimaryButton label={t("flow.changeFilters")} onPress={() => router.back()} />
          </View>
        </View>
      );
    }

    return (
      <>
        {restaurants.map((restaurant, index) => (
          <AnimatedCard key={restaurant.id}>
            <RestaurantCard
              restaurant={restaurant}
              index={index}
              selected={selectedId === restaurant.id}
              onPress={() => handleCardPress(restaurant.id)}
              voteData={votesMap[restaurant.id]}
            />
          </AnimatedCard>
        ))}
        {isStreaming && (
          <StreamingIndicator found={restaurants.length} total={totalExpected != null ? Math.min(totalExpected, MAX_RESULTS) : undefined} />
        )}
      </>
    );
  })();

  return (
    <View style={StyleSheet.absoluteFill}>
      {showMap ? (
        <Map
          restaurants={restaurants}
          items={savedItems}
          selectedId={selectedId}
          onSelectRestaurant={handlePinSelect}
          votesMap={votesMap}
          mapType={mapPreferences.mapStyle}
          minimalist={mapPreferences.mapStyle === "minimal"}
          gadoOverlay={mapPreferences.gadoOverlay}
        />
      ) : (
        <MapStatusHero
          status={status}
          categoryLabel={categoryLabel}
          moodLabel={moodLabel}
          priceLabel={priceLabel}
          errorMsg={errorMsg}
        />
      )}

      <SafeAreaView style={styles.topSafe} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/(tabs)")}
          accessibilityLabel={t("common.back")}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>{t("flow.backWithArrow")}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <BottomSheet
        ref={sheetRef}
        snapPoints={["15%", "50%", "92%"]}
        initialSnapIndex={status === "loading" ? 0 : 1}
        header={sheetHeader}
      >
        {sheetContent}
      </BottomSheet>

      <Modal visible={!!compareResult} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Comparativa</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.modalText}>{compareResult}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCompareResult(null)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
