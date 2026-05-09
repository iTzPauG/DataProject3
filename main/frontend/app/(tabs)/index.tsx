import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import DealDetailSheet from '../../components/DealDetailSheet';
import Icon from '../../components/Icon';
import Map from '../../components/map/Map';
import NearbySheet from '../../components/NearbySheet';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useLiveDeals, type LiveDeal } from '../../hooks/useLiveDeals';
import { useLocation } from '../../hooks/useLocation';
import { BASE_URL } from '../../services/api';
import { fetchNearbyItems } from '../../services/mapService';
import { MapItem } from '../../types';
import { storage } from '../../utils/storage';
import { useTheme } from '../../utils/theme';
import LocationGate from '../../components/LocationGate';

const SAVED_PINS_KEY = 'whim_saved_pins';

type AutocompleteResult = {
  display: string;
  lat: number;
  lng: number;
  id?: string;
  address?: string;
  raw?: any;
};

const FOOD_SUBCATEGORIES = [
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'sushi', label: 'Sushi', emoji: '🍣' },
  { id: 'tapas', label: 'Tapas', emoji: '🥘' },
  { id: 'burgers', label: 'Burgers', emoji: '🍔' },
  { id: 'asian', label: 'Asiática', emoji: '🍜' },
  { id: 'italian', label: 'Italiana', emoji: '🍝' },
  { id: 'mexican', label: 'Mexicana', emoji: '🌮' },
  { id: 'healthy', label: 'Sano', emoji: '🥗' },
  { id: 'vegan', label: 'Vegano', emoji: '🌱' },
  { id: 'kebab', label: 'Kebab', emoji: '🥙' },
  { id: 'brunch', label: 'Brunch', emoji: '🥞' },
  { id: 'coffee', label: 'Café', emoji: '☕' },
];

export default function MapTab() {
  const { t } = useTranslation();
  const { colors, typography, shadows } = useTheme();
  const params = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const { isDesktop, width: windowWidth } = useDeviceType();
  const location = useLocation();
  // Auth state is consumed elsewhere in the tree (NearbySheet, etc.); this
  // module no longer uses the avatar/profile fields directly so we don't
  // destructure here to avoid lint warnings on unused locals.
  useAuth();
  const {
    nearbyItems,
    setNearbyItems,
    setSelectedCategory,
    mapRegion,
    setMapRegion,
    mapPreferences,
    isHydrated,
  } = useAppState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<LiveDeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFoodSubcat, setSelectedFoodSubcat] = useState<string | null>(null);
  const [showDealsOnly, setShowDealsOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [acResults, setAcResults] = useState<AutocompleteResult[]>([]);
  const [selectedSearchItem, setSelectedSearchItem] = useState<AutocompleteResult | null>(null);
  const [savedPins, setSavedPins] = useState<MapItem[]>([]);
  const hasAutoCentered = useRef(false);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopWidth = Math.min(windowWidth - 40, 620);
  const leftOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 14;
  // Search panel now spans the full available width — the floating avatar was
  // moved into the bottom tab bar, so the previous 70px right reserve isn't
  // needed anymore.
  const rightOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 14;
  const minimalist = mapPreferences.mapStyle === 'minimal';
  const { deals: liveDeals, connected: dealsConnected } = useLiveDeals({
    lat: mapRegion?.lat ?? location.lat ?? undefined,
    lng: mapRegion?.lng ?? location.lng ?? undefined,
    radiusM: mapPreferences.defaultRadiusM,
    enabled: true,
    ownerUid: null,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.shell },

        panel: {
          borderRadius: 20,
          overflow: 'hidden',
          ...shadows.lift,
        },
        panelBlur: {
          backgroundColor: 'rgba(24, 26, 35, 0.65)', // surface with opacity
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        eyebrowRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 4,
        },
        eyebrow: {
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#FFFFFF',
          fontFamily: typography.body,
          fontWeight: '700',
        },
        eyebrowAction: {
          fontSize: 12,
          color: '#FFFFFF',
          fontFamily: typography.body,
          fontWeight: '600',
        },
        searchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingBottom: 14,
          paddingTop: 4,
          gap: 12,
        },
        searchInput: {
          flex: 1,
          fontSize: 17,
          fontWeight: '500',
          color: '#FFFFFF',
          caretColor: '#FFFFFF',
          paddingVertical: 8,
          fontFamily: typography.body,
          // @ts-ignore web-only outline removal
          outlineStyle: 'none',
          // @ts-ignore web-only text fill (Safari/Chromium)
          WebkitTextFillColor: '#FFFFFF',
        } as any,
        iconBtn: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },

        dropdown: {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 8,
          borderRadius: 20,
          overflow: 'hidden',
          ...shadows.lift,
          zIndex: 20,
        },
        dropdownBlur: {
          backgroundColor: 'rgba(24, 26, 35, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        dropdownItem: {
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        },
        dropdownName: {
          fontSize: 15,
          fontWeight: '600',
          color: '#FFFFFF',
          fontFamily: typography.body,
          letterSpacing: -0.1,
        },
        dropdownAddress: {
          fontSize: 13,
          color: '#FFFFFF',
          marginTop: 4,
          fontFamily: typography.body,
        },
        foodSubcatChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.08)',
          gap: 4,
        },
        foodSubcatChipActive: {
          backgroundColor: '#FF6B35',
          borderColor: '#FF6B35',
        },
        foodSubcatChipText: {
          fontSize: 12,
          fontWeight: '600',
          color: '#FFFFFF',
          fontFamily: typography.body,
        },
        foodSubcatChipTextActive: {
          color: '#FFFFFF',
          fontWeight: '700',
        },
        filterPanel: {
          marginTop: 8,
          borderRadius: 16,
          overflow: 'hidden',
          ...shadows.lift,
        },
        foodSubcatRow: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
        },
      }),
    [colors, typography, shadows, rightOffset, isDesktop, insets.bottom],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      setSelectedSearchItem(null);
      if (acTimer.current) clearTimeout(acTimer.current);
      if (text.length < 1) {
        setAcResults([]);
        return;
      }
      acTimer.current = setTimeout(async () => {
        try {
          const lat = location.lat ?? mapRegion?.lat ?? 39.4699;
          const lng = location.lng ?? mapRegion?.lng ?? -0.3763;
          const res = await fetch(
            `${BASE_URL}/search/universal?q=${encodeURIComponent(text)}&lat=${lat}&lng=${lng}&radius_m=5000&use_brain=false`,
          );
          if (res.ok) {
            const data = await res.json();
            const results: AutocompleteResult[] = (data.results ?? [])
              .filter((r: any) => r.name && r.lat && r.lng)
              .slice(0, 5)
              .map((r: any) => ({
                display: r.name,
                lat: r.lat,
                lng: r.lng,
                id: r.id,
                address: r.address ?? r.metadata?.address,
                raw: r,
              }));
            setAcResults(results);
          }
        } catch {}
      }, 300);
    },
    [location.lat, location.lng, mapRegion],
  );

  const handleSelectResult = useCallback(
    (item: AutocompleteResult) => {
      setSearchQuery(item.display);
      setAcResults([]);
      setSelectedSearchItem(item);
      setMapRegion({ lat: item.lat, lng: item.lng, latDelta: 0.008, lngDelta: 0.008 });
      if (item.id && item.raw) {
        const backendUrl =
          process.env.EXPO_PUBLIC_BACKEND_URL ||
          'https://restaurant-api-gcfbpra65a-ew.a.run.app';
        const photoUrl = item.raw.metadata?.photo_url;
        const mapItem = {
          item_id: item.id,
          item_type: 'place',
          title: item.display,
          category_id: item.raw.category_id ?? 'food',
          lat: item.lat,
          lng: item.lng,
          distance_m: 0,
          metadata: {
            ...item.raw.metadata,
            photo_url: photoUrl?.startsWith('/') ? `${backendUrl}${photoUrl}` : photoUrl,
            address: item.address,
            google_reviews: item.raw.google_reviews ?? [],
          },
        } as any;
        setNearbyItems((prev) => {
          const without = prev.filter((i) => i.item_id !== item.id);
          return [mapItem, ...without];
        });
        setSelectedId(item.id);
      }
    },
    [setMapRegion, setNearbyItems],
  );

  const handleSheetItemPress = useCallback((id: string) => {
    if (id.startsWith('deal:')) {
      const dealId = id.replace('deal:', '');
      const deal = liveDeals.find((d: LiveDeal) => d.id === dealId) ?? null;
      setSelectedDeal(deal);
      return;
    }
    setSelectedId(id);
  }, [liveDeals]);

  const handleRegionChange = useCallback(
    (lat: number, lng: number, latDelta: number, lngDelta: number) => {
      setMapRegion({ lat, lng, latDelta, lngDelta });
    },
    [setMapRegion],
  );

  const handleCenterOnUser = useCallback(() => {
    if (location.lat && location.lng) {
      setMapRegion({
        lat: location.lat,
        lng: location.lng,
        latDelta: 0.015,
        lngDelta: 0.015,
      });
    }
  }, [location, setMapRegion]);

  const handleFoodSubcatSelect = useCallback(
    (subcatId: string | null) => {
      setSelectedFoodSubcat(subcatId);
      setShowDealsOnly(false);
    },
    [],
  );

  // Double-click on a map marker → open the place's full details modal.
  // Passing the full item as `prefill` avoids a second backend round-trip
  // when the modal hydrates (the metadata, photo, lat/lng all come along).
  const handleDoubleClickItem = useCallback(
    (id: string, type: string) => {
      if (type === 'event') {
        router.push({ pathname: '/(modals)/event-details', params: { id } });
        return;
      }
      const item = nearbyItems.find((i) => i.item_id === id);
      router.push({
        pathname: '/(modals)/place-details',
        params: {
          id,
          ...(item ? { prefill: JSON.stringify(item) } : {}),
        },
      });
    },
    [nearbyItems],
  );

  useEffect(() => {
    if (!selectedId) return;
    const item = nearbyItems.find((i) => i.item_id === selectedId);
    if (item?.metadata?.photo_url && item?.metadata?.google_reviews) return;
    const lat = item?.lat ?? mapRegion?.lat ?? 39.4699;
    const lng = item?.lng ?? mapRegion?.lng ?? -0.3763;
    const q = item?.title ?? selectedId;
    const backendUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      'https://restaurant-api-gcfbpra65a-ew.a.run.app';
    fetch(
      `${backendUrl}/search/universal?q=${encodeURIComponent(q)}&lat=${lat}&lng=${lng}&radius_m=300&use_brain=false`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const found = (data?.results ?? []).find(
          (r: any) => r.id === selectedId || r.name === q,
        );
        if (!found) return;
        const photoUrl = found.metadata?.photo_url;
        setNearbyItems((prev) =>
          prev.map((i) =>
            i.item_id === selectedId
              ? {
                  ...i,
                  metadata: {
                    ...i.metadata,
                    ...found.metadata,
                    photo_url: photoUrl?.startsWith('/')
                      ? `${backendUrl}${photoUrl}`
                      : photoUrl,
                    address:
                      found.address ?? found.metadata?.address ?? i.metadata?.address,
                    google_reviews:
                      found.google_reviews ?? found.metadata?.google_reviews ?? [],
                  },
                }
              : i,
          ),
        );
      })
      .catch(() => {});
  }, [selectedId]);

  // Default to deals-only view; deep-link param can override to food subcategory
  useEffect(() => {
    if (params.category) {
      const sub = FOOD_SUBCATEGORIES.find((s) => s.id === params.category);
      if (sub) {
        setSelectedFoodSubcat(params.category);
        setShowDealsOnly(false);
        setSelectedCategory('food');
      }
    }
    // else: stay in showDealsOnly=true mode
  }, []);

  // Load locally saved restaurant pins
  useEffect(() => {
    storage.getItem(SAVED_PINS_KEY).then((raw) => {
      if (!raw) return;
      const pins: any[] = JSON.parse(raw);
      const mapItems: MapItem[] = pins.map((p) => ({
        item_id: p.id,
        item_type: 'place' as const,
        title: p.name,
        category_id: 'food',
        lat: p.lat,
        lng: p.lng,
        distance_m: 0,
        color: '#FFD700',
        icon: '⭐',
        metadata: {
          photo_url: p.photoUrl ?? '',
          address: p.address ?? '',
          saved: true,
        },
      }));
      setSavedPins(mapItems);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (
      !location.loading &&
      !location.error &&
      !hasAutoCentered.current &&
      location.lat &&
      location.lng
    ) {
      handleCenterOnUser();
      hasAutoCentered.current = true;
    }
  }, [location.loading, location.error, location.lat, location.lng, handleCenterOnUser]);

  // Search only triggered by subcategory selection (manual)
  const performSearch = useCallback(async () => {
    const searchLat = mapRegion?.lat ?? location.lat ?? 39.4699;
    const searchLng = mapRegion?.lng ?? location.lng ?? -0.3763;
    // Respect the user's "search by radius" vs "search by city" preference (settings).
    // 'city' mode broadens the radius to 25 km so we cover the whole city around
    // the user, regardless of where the map is centered.
    const radius = mapPreferences.searchMode === 'city'
      ? Math.max(mapPreferences.defaultRadiusM, 25_000)
      : mapPreferences.defaultRadiusM;
    setLoading(true);
    try {
      const lang = mapPreferences.language === 'system' ? 'es' : mapPreferences.language;
      const items = await fetchNearbyItems(
        searchLat,
        searchLng,
        radius,
        'food',
        lang,
        ['place'],
        selectedFoodSubcat ?? undefined,
      );
      setNearbyItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedFoodSubcat, mapRegion?.lat, mapRegion?.lng, location.lat, location.lng, mapPreferences.language, mapPreferences.defaultRadiusM, mapPreferences.searchMode]);

  // Initial load once hydrated
  useEffect(() => {
    if (isHydrated && nearbyItems.length === 0) {
      void performSearch();
    }
  }, [isHydrated]);

  // Re-search whenever the user picks a different subcategory chip.
  // Without this, the chip selection only filters locally — the user reported
  // tapping "Pizza"/"Sushi" and getting Valencia results because the request
  // never re-fired with their current location + the new subcategory.
  const lastSubcatRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isHydrated) return;
    if (lastSubcatRef.current === selectedFoodSubcat) return;
    lastSubcatRef.current = selectedFoodSubcat;
    void performSearch();
  }, [selectedFoodSubcat, isHydrated, performSearch]);

  const liveDealItems = useMemo<MapItem[]>(() => {
    return liveDeals.map((deal: LiveDeal) => ({
      item_id: `deal:${deal.id}`,
      item_type: 'place',
      title: `${deal.restaurant_name}${deal.cuisine ? ` (${deal.cuisine})` : ''} · ${deal.price.toFixed(2)} EUR`,
      category_id: 'food',
      lat: deal.lat,
      lng: deal.lng,
      distance_m: 0,
      color: '#F97316',
      icon: '🔥',
      metadata: {
        deal: true,
        deal_id: deal.id,
        cuisine: deal.cuisine,
        restaurant_cuisines: deal.restaurant_cuisines,
        seats: deal.seats,
        price: deal.price,
        original_price: deal.original_price,
        description: deal.description,
      },
    }));
  }, [liveDeals]);

  const displayItems = useMemo(() => {
    // In "deals only" mode, show only deal pins (no restaurants)
    if (showDealsOnly && !selectedSearchItem) {
      return liveDealItems;
    }
    let base: MapItem[] = nearbyItems;
    if (selectedSearchItem) {
      const pin: MapItem = {
        item_id: '__search_pin__',
        item_type: 'place',
        title: selectedSearchItem.display,
        lat: selectedSearchItem.lat,
        lng: selectedSearchItem.lng,
        category_id: null,
        metadata: {},
      } as any;
      base = [pin, ...nearbyItems.filter((i) => i.item_id !== '__search_pin__')];
    }
    // Append locally saved pins that aren't already present
    const baseIds = new Set(base.map((i) => i.item_id));
    const dealPins = liveDealItems.filter((d: MapItem) => !baseIds.has(d.item_id));
    const savedPinsOnly = savedPins.filter((sp: MapItem) => !baseIds.has(sp.item_id));
    const extra = [...dealPins, ...savedPinsOnly];
    return extra.length > 0 ? [...base, ...extra] : base;
  }, [nearbyItems, selectedSearchItem, savedPins, liveDealItems, showDealsOnly]);

  return (
    <AnimatedTabScene>
      <LocationGate>
      <View style={{ flex: 1, position: 'relative' }}>
        <View style={styles.container}>
          <Map
            items={displayItems}
            selectedId={selectedId}
            onSelectItem={handleSheetItemPress}
            onDoubleClickItem={handleDoubleClickItem}
            onRegionChange={handleRegionChange}
            region={mapRegion ?? undefined}
            mapType={mapPreferences.mapStyle}
            minimalist={minimalist}
            gadoOverlay={mapPreferences.gadoOverlay}
          />

          <View
            style={{
              position: 'absolute',
              zIndex: 10,
              top: insets.top + 14,
              left: leftOffset,
              right: rightOffset,
            }}
          >
            <View style={styles.panel}>
              <BlurView intensity={60} tint="dark" style={styles.panelBlur}>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.eyebrow}>{t("home.locationNow")}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: dealsConnected ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)',
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: dealsConnected ? '#22C55E' : '#EF4444',
                        }}
                      />
                      <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '700' }}>
                        LIVE {liveDealItems.length}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleCenterOnUser}
                      activeOpacity={0.7}
                      accessibilityLabel={t("home.recenter")}
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Icon
                        name="crosshair"
                        size={13}
                        color="#FFFFFF"
                        strokeWidth={1.2}
                      />
                      <Text style={styles.eyebrowAction}>{t("home.recenter")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.searchRow}>
                  <View style={styles.iconBtn}>
                    <Icon
                      name="search"
                      size={20}
                      color="#FFFFFF"
                      strokeWidth={1.8}
                    />
                  </View>
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t("home.searchPlaceholder")}
                    placeholderTextColor="#FFFFFF"
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    selectionColor="#FFFFFF"
                    accessibilityLabel={t("common.search")}
                  />
                  {searchQuery.length > 0 ? (
                    <TouchableOpacity
                      style={styles.iconBtn}
                      activeOpacity={0.6}
                      onPress={() => {
                        setSearchQuery('');
                        setAcResults([]);
                        setSelectedSearchItem(null);
                      }}
                      accessibilityLabel={t("common.close")}
                      accessibilityRole="button"
                    >
                      <Icon
                        name="close"
                        size={16}
                        color="#FFFFFF"
                        strokeWidth={1.6}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </BlurView>
            </View>

            {/* Filter chips row: Anuncios → Favoritos → tipologías */}
            <View style={styles.filterPanel}>
              <BlurView intensity={60} tint="dark" style={[styles.panelBlur, { borderRadius: 16 }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.foodSubcatRow}
                >
                  {/* Anuncios */}
                  <TouchableOpacity
                    style={[
                      styles.foodSubcatChip,
                      { borderColor: '#F97316', backgroundColor: showDealsOnly ? '#F97316' : 'rgba(249,115,22,0.15)' },
                    ]}
                    onPress={() => {
                      setShowDealsOnly(true);
                      setSelectedFoodSubcat(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: showDealsOnly ? '#fff' : '#F97316' }}>
                      🔥 Anuncios{liveDealItems.length > 0 ? ` (${liveDealItems.length})` : ''}
                    </Text>
                  </TouchableOpacity>

                  {/* Favoritos */}
                  <TouchableOpacity
                    style={[styles.foodSubcatChip, { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.1)' }]}
                    onPress={() => router.push('/(modals)/saved-items')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFD700' }}>⭐ Favoritos</Text>
                  </TouchableOpacity>

                  {/* Tipologías */}
                  {FOOD_SUBCATEGORIES.map((sub) => {
                    const active = !showDealsOnly && selectedFoodSubcat === sub.id;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.foodSubcatChip, active && styles.foodSubcatChipActive]}
                        onPress={() => {
                          setShowDealsOnly(false);
                          setSelectedCategory('food');
                          handleFoodSubcatSelect(active ? null : sub.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text>{sub.emoji}</Text>
                        <Text style={[styles.foodSubcatChipText, active && styles.foodSubcatChipTextActive]}>
                          {sub.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </BlurView>
            </View>

          {acResults.length > 0 && (
            <View style={styles.dropdown}>
              <BlurView intensity={60} tint="dark" style={styles.dropdownBlur}>
                <FlatList
                  data={acResults}
                  keyExtractor={(_, i) => String(i)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        index === acResults.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => handleSelectResult(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownName} numberOfLines={1}>
                        {item.display}
                      </Text>
                      {item.address ? (
                        <Text style={styles.dropdownAddress} numberOfLines={1}>
                          {item.address}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              </BlurView>
            </View>
          )}
        </View>

        <NearbySheet
          items={displayItems}
          selectedId={selectedId}
          onSelectItem={handleSheetItemPress}
          loading={loading}
          hasSearched={true}
        />

        {selectedDeal && (
          <DealDetailSheet
            deal={selectedDeal}
            onClose={() => setSelectedDeal(null)}
          />
        )}
      </View>
    </View>
      </LocationGate>
    </AnimatedTabScene>
  );
}
