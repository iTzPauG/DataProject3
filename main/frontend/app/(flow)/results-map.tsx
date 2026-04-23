import { router, useRootNavigationState } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import Map from "../../components/map/Map";
import PrimaryButton from "../../components/PrimaryButton";
import RestaurantCard from "../../components/RestaurantCard";
import BottomSheet from "../../components/sheet/BottomSheet";
import GADOIcon from "../../components/GADOIcon";
import { BottomSheetRef } from "../../components/sheet/types";
import { useAppState } from "../../hooks/useAppState";
import { useFlowState } from "../../hooks/useFlowState";
import {
  getVotesBatch,
  recommendRestaurants,
  recommendRestaurantsStream,
  VoteData,
} from "../../services/api";
import { Restaurant } from "../../types/restaurant";
import { formatPriceLevel } from "../../utils/format";
import { useTheme } from "../../utils/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_HEIGHT = 360;

type Status = "loading" | "streaming" | "success" | "error";

// ── Animated loading dots ───────────────────────────────────────────────────

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
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10 }}>
      <ActivityIndicator size="small" color={colors.brand} />
      <Text style={{ fontSize: 13, color: colors.inkMuted, fontFamily: typography.body }}>
        Analizando lugares... ({found}{total ? ` de ${total}` : ""})
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

  const eyebrow = isLoading ? "Buscando cerca" : isError ? "Búsqueda pausada" : "Sin coincidencias";
  const title = isLoading ? "Preparando tu lista" : isError ? "Hubo un problema" : "No encontramos nada";
  const description = isLoading
    ? "Analizando reseñas, calidad y ambiente para recomendarte solo lo mejor."
    : isError
      ? errorMsg || "No se pudo completar la petición."
      : "Prueba con otro mood o amplía la zona.";

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
          {categoryLabel ? <View style={styles.pill}><GADOIcon name="bookmark" size={14} color={colors.ink} /><Text style={styles.pillText}>{categoryLabel}</Text></View> : null}
          {moodLabel ? <View style={styles.pill}><GADOIcon name="happy" size={14} color={colors.ink} /><Text style={styles.pillText}>{moodLabel}</Text></View> : null}
          {priceLabel ? <View style={styles.pill}><GADOIcon name="cash" size={14} color={colors.ink} /><Text style={styles.pillText}>{priceLabel}</Text></View> : null}
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

    if (results !== null) {
      setRestaurants(results);
      setStatus("success");
      loadVotes(results);
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
            setTotalExpected(total);
          },
          onResult: (restaurant) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            accumulatedRef.current = [...accumulatedRef.current, restaurant];
            // Progressive UI update
            setRestaurants([...accumulatedRef.current]);
            setResults([...accumulatedRef.current]);
            if (accumulatedRef.current.length === 1) {
              setStatus("streaming");
            }
          },
          onDone: (_total) => {
            setResults(accumulatedRef.current);
            setStatus("success");
            loadVotes(accumulatedRef.current);
          },
          onError: (err) => {
            if (accumulatedRef.current.length > 0) {
              setResults(accumulatedRef.current);
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
        setRestaurants(top);
        setResults(top);
        setStatus("success");
        loadVotes(top);
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "Algo salió mal.");
        setStatus("error");
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [canNavigate, category, isHydrated, loadVotes, mapPreferences.language, mood, parentCategory, priceLevel, results, setResults]);

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

  const sheetCountText = (() => {
    if (status === "loading") return "Buscando cerca...";
    const count = (restaurants || []).length;
    if (isStreaming) return `Encontrados ${count}${totalExpected ? ` de ${totalExpected}` : ""}...`;
    return `Mostrando ${count} lugares`;
  })();

  const sheetHeader = (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>Resultados para ti</Text>
      <Text style={styles.sheetCount}>{sheetCountText}</Text>
      <View style={styles.pills}>
        {categoryLabel ? <View style={styles.pill}><GADOIcon name="bookmark" size={14} color={colors.ink} /><Text style={styles.pillText}>{categoryLabel}</Text></View> : null}
        {moodLabel ? <View style={styles.pill}><GADOIcon name="happy" size={14} color={colors.ink} /><Text style={styles.pillText}>{moodLabel}</Text></View> : null}
        {priceLabel ? <View style={styles.pill}><GADOIcon name="cash" size={14} color={colors.ink} /><Text style={styles.pillText}>{priceLabel}</Text></View> : null}
      </View>
    </View>
  );

  // ── Sheet content ───────────────────────────────────────────────────────

  const sheetContent = (() => {
    if (status === "loading" && (!results || results.length === 0)) {
      return (
        <LoadingIndicator
          message="Buscando los mejores lugares..."
          sub="Analizando reseñas, calidad y ambiente."
        />
      );
    }

    if (status === "error") {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Error en la búsqueda</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <View style={styles.retryBtn}>
            <PrimaryButton label="Reintentar" onPress={() => void load()} />
          </View>
        </View>
      );
    }

    if (status === "success" && restaurants.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Nada por aquí todavía</Text>
          <Text style={styles.errorMsg}>Prueba con otro mood o amplía el radio de búsqueda.</Text>
          <View style={styles.retryBtn}>
            <PrimaryButton label="Cambiar filtros" onPress={() => router.back()} />
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
          <StreamingIndicator found={restaurants.length} total={totalExpected} />
        )}
      </>
    );
  })();

  return (
    <View style={StyleSheet.absoluteFill}>
      {showMap ? (
        <Map
          restaurants={restaurants}
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
          accessibilityLabel="Volver atrás"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Volver</Text>
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
    </View>
  );
}
