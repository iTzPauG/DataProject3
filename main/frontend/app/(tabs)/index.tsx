import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Icon from '../../components/Icon';
import Map from '../../components/map/Map';
import NearbySheet from '../../components/NearbySheet';
import { useAppState } from '../../hooks/useAppState';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useLocation } from '../../hooks/useLocation';
import { BASE_URL } from '../../services/api';
import { fetchCategories, fetchNearbyItems } from '../../services/mapService';
import { Category, MapItem } from '../../types';
import { useTheme } from '../../utils/theme';

type AutocompleteResult = {
  display: string;
  lat: number;
  lng: number;
  id?: string;
  address?: string;
  raw?: any;
};

export default function MapTab() {
  const { t } = useTranslation();
  const { colors, typography, shadows } = useTheme();
  const params = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const { isDesktop, width: windowWidth } = useDeviceType();
  const location = useLocation();
  const {
    nearbyItems,
    setNearbyItems,
    selectedCategory,
    setSelectedCategory,
    mapRegion,
    setMapRegion,
    mapPreferences,
  } = useAppState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [acResults, setAcResults] = useState<AutocompleteResult[]>([]);
  const [selectedSearchItem, setSelectedSearchItem] = useState<AutocompleteResult | null>(null);
  const hasAutoCentered = useRef(false);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopWidth = Math.min(windowWidth - 40, 620);
  const leftOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 14;
  const rightOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 14;
  const minimalist = mapPreferences.mapStyle === 'minimal';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.shell },

        panel: {
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.stroke,
          borderRadius: 20,
          overflow: 'hidden',
          ...shadows.lift,
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
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '700',
        },
        eyebrowAction: {
          fontSize: 12,
          color: colors.inkMuted,
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
          color: colors.ink,
          paddingVertical: 8,
          fontFamily: typography.body,
          // @ts-ignore web-only outline removal
          outlineStyle: 'none',
        } as any,
        iconBtn: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        reportFab: {
          position: 'absolute',
          right: rightOffset,
          bottom: isDesktop ? 34 : Math.max(insets.bottom + 122, 136),
          minHeight: 52,
          paddingHorizontal: 20,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.strokeStrong,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          zIndex: 11,
          ...shadows.lift,
        },
        reportFabText: {
          fontSize: 14,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '700',
          letterSpacing: -0.1,
        },

        dropdown: {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 8,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.stroke,
          ...shadows.lift,
          zIndex: 20,
        },
        dropdownItem: {
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.stroke,
        },
        dropdownName: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.ink,
          fontFamily: typography.body,
          letterSpacing: -0.1,
        },
        dropdownAddress: {
          fontSize: 13,
          color: colors.inkFaint,
          marginTop: 4,
          fontFamily: typography.body,
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
    setSelectedId(id);
  }, []);

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

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    setSelectedCategory(null);
  }, []);

  useEffect(() => {
    if (params.category && params.category !== selectedCategory) {
      setSelectedCategory(params.category);
    }
  }, [params.category, selectedCategory, setSelectedCategory]);

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

  useEffect(() => {
    if (!selectedCategory) {
      setNearbyItems([]);
      return;
    }
    const searchLat = mapRegion?.lat ?? location.lat;
    const searchLng = mapRegion?.lng ?? location.lng;
    if (searchLat === null || searchLng === null) return;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const lang =
          mapPreferences.language === 'system' ? 'es' : mapPreferences.language;
        const itemTypes: string[] = ['place'];
        if (mapPreferences.showRealTimeEvents) itemTypes.push('event', 'report');
        const items = await fetchNearbyItems(
          searchLat,
          searchLng,
          mapPreferences.defaultRadiusM,
          selectedCategory,
          lang,
          itemTypes,
        );
        setNearbyItems(items);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [selectedCategory]);

  const displayItems = useMemo(() => {
    if (!selectedSearchItem) return nearbyItems;
    const pin: MapItem = {
      item_id: '__search_pin__',
      item_type: 'place',
      title: selectedSearchItem.display,
      lat: selectedSearchItem.lat,
      lng: selectedSearchItem.lng,
      category_id: null,
      metadata: {},
    } as any;
    return [pin, ...nearbyItems.filter((i) => i.item_id !== '__search_pin__')];
  }, [nearbyItems, selectedSearchItem]);

  return (
    <AnimatedTabScene>
      <View style={styles.container}>
        <Map
          items={displayItems}
          selectedId={selectedId}
          onSelectItem={handleSheetItemPress}
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
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrow}>{t("home.locationNow")}</Text>
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
                  color={colors.inkMuted}
                  strokeWidth={1.2}
                />
                <Text style={styles.eyebrowAction}>{t("home.recenter")}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.iconBtn}>
                <Icon
                  name="search"
                  size={20}
                  color={colors.inkMuted}
                  strokeWidth={1.8}
                />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder={t("home.searchPlaceholder")}
                placeholderTextColor={colors.inkFaint}
                value={searchQuery}
                onChangeText={handleSearchChange}
                clearButtonMode="while-editing"
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
                    color={colors.inkMuted}
                    strokeWidth={1.6}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {acResults.length > 0 && (
            <View style={styles.dropdown}>
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
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.reportFab}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/report')}
          accessibilityRole="button"
          accessibilityLabel={t("report.title")}
        >
          <Icon
            name="plus"
            size={16}
            color={colors.brand}
            strokeWidth={1.8}
          />
          <Text style={styles.reportFabText}>{t("home.liveReport")}</Text>
        </TouchableOpacity>

        <NearbySheet
          items={nearbyItems}
          selectedId={selectedId}
          onSelectItem={handleSheetItemPress}
          loading={loading}
          hasSearched={selectedCategory !== null}
        />
      </View>
    </AnimatedTabScene>
  );
}
