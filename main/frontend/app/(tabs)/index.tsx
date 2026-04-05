import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Map from '../../components/map/Map';
import CategoryFilter from '../../components/CategoryFilter';
import NearbySheet from '../../components/NearbySheet';
import { useAppState } from '../../hooks/useAppState';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useLocation } from '../../hooks/useLocation';
import { fetchNearbyItems, fetchCategories } from '../../services/mapService';
import { BASE_URL } from '../../services/api';
import { Category, MapItem } from '../../types';
import { useTheme } from '../../utils/theme';

type AutocompleteResult = { display: string; lat: number; lng: number };

export default function MapTab() {
  const { colors, theme, shadows } = useTheme();
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

  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    glassContainer: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme === 'dark' ? 'rgba(23, 27, 41, 0.85)' : 'rgba(255, 255, 255, 0.85)',
      borderWidth: 1,
      borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      ...shadows.soft,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.ink,
      paddingHorizontal: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.stroke,
      opacity: 0.5,
      marginHorizontal: 16,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme === 'dark' ? 'rgba(23, 27, 41, 0.97)' : 'rgba(255, 255, 255, 0.97)',
      borderWidth: 1,
      borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
      ...shadows.soft,
      zIndex: 20,
    },
    dropdownItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.stroke,
    },
    dropdownName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
    },
    dropdownAddress: {
      fontSize: 12,
      color: colors.inkMuted,
      marginTop: 2,
    },
  }), [colors, theme, shadows]);

  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Autocomplete ───────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setSelectedSearchItem(null);
    if (acTimer.current) clearTimeout(acTimer.current);
    if (text.length < 2) { setAcResults([]); return; }
    acTimer.current = setTimeout(async () => {
      try {
        const lat = location.lat ?? mapRegion?.lat ?? 39.4699;
        const lng = location.lng ?? mapRegion?.lng ?? -0.3763;
        const res = await fetch(`${BASE_URL}/search/autocomplete?q=${encodeURIComponent(text)}&lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data: AutocompleteResult[] = await res.json();
          setAcResults(data.slice(0, 5));
        }
      } catch {}
    }, 300);
  }, [location.lat, location.lng, mapRegion]);

  const handleSelectResult = useCallback((item: AutocompleteResult) => {
    setSearchQuery(item.display);
    setAcResults([]);
    setSelectedSearchItem(item);
    setMapRegion({ lat: item.lat, lng: item.lng, latDelta: 0.01, lngDelta: 0.01 });
  }, [setMapRegion]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSheetItemPress = useCallback((id: string) => {
    setSelectedId(id);
    const item = nearbyItems.find((i) => i.item_id === id);
    if (item) {
      const pathname = item.item_type === 'report' 
        ? '/(modals)/report-details' 
        : item.item_type === 'event'
          ? '/(modals)/event-details'
          : '/(modals)/place-details';
      router.push({
        pathname: pathname as any,
        params: { id: item.item_id, type: item.item_type },
      });
    }
  }, [nearbyItems]);

  const handleRegionChange = useCallback(
    (lat: number, lng: number, latDelta: number, lngDelta: number) => {
      setMapRegion({ lat, lng, latDelta, lngDelta });
    },
    [setMapRegion],
  );

  const handleCenterOnUser = useCallback(() => {
    if (location.lat && location.lng) {
      setMapRegion({ lat: location.lat, lng: location.lng, latDelta: 0.015, lngDelta: 0.015 });
    }
  }, [location, setMapRegion]);

  const handleCategorySelect = useCallback(
    (categoryId: string | null) => { setSelectedCategory(categoryId); },
    [setSelectedCategory],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { fetchCategories().then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    if (params.category && params.category !== selectedCategory) {
      setSelectedCategory(params.category);
    }
  }, [params.category, selectedCategory, setSelectedCategory]);

  useEffect(() => {
    if (!location.loading && !location.error && !hasAutoCentered.current && location.lat && location.lng) {
      handleCenterOnUser();
      hasAutoCentered.current = true;
    }
  }, [location.loading, location.error, location.lat, location.lng, handleCenterOnUser]);

  useEffect(() => {
    if (location.loading && !mapRegion) return;
    const searchLat = mapRegion?.lat ?? location.lat;
    const searchLng = mapRegion?.lng ?? location.lng;
    if (searchLat === null || searchLng === null) return;

    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const lang = mapPreferences.language === 'system' ? 'es' : mapPreferences.language;
        const itemTypes: string[] = [];
        if (mapPreferences.showRealTimeEvents) itemTypes.push('event', 'report');

        let items: MapItem[] = [];
        if (itemTypes.length > 0) {
          items = await fetchNearbyItems(searchLat, searchLng, mapPreferences.defaultRadiusM, selectedCategory, lang, itemTypes);
        }
        setNearbyItems(items);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => { if (fetchTimer.current) clearTimeout(fetchTimer.current); };
  }, [
    mapRegion?.lat,
    mapRegion?.lng,
    selectedCategory,
    setNearbyItems,
    mapPreferences.defaultRadiusM,
    mapPreferences.showRealTimeEvents,
  ]);

  const desktopWidth = Math.min(windowWidth - 40, 600);
  const leftOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 16;
  const rightOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 16;
  const minimalist = mapPreferences.mapStyle === 'minimal';

  // Merge selected search item as a pin on the map
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
    return [pin, ...nearbyItems.filter(i => i.item_id !== '__search_pin__')];
  }, [nearbyItems, selectedSearchItem]);

  return (
    <AnimatedTabScene>
    <View style={dynamicStyles.container}>
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
        style={[
          styles.topControls,
          { top: insets.top + 12, left: leftOffset, right: rightOffset },
        ]}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={theme as any} style={dynamicStyles.glassContainer}>
          <View style={styles.searchRow}>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={handleCenterOnUser}
              accessibilityLabel="Centrar en mi ubicación"
              accessibilityRole="button"
            >
              <Ionicons name="locate" size={20} color={colors.brand} />
            </TouchableOpacity>

            <TextInput
              style={dynamicStyles.searchInput}
              placeholder="Buscar lugares o eventos..."
              placeholderTextColor={colors.inkMuted}
              value={searchQuery}
              onChangeText={handleSearchChange}
              clearButtonMode="while-editing"
              accessibilityLabel="Campo de búsqueda"
            />

            {searchQuery.length > 0 && Platform.OS === 'android' && (
              <TouchableOpacity
                onPress={() => { setSearchQuery(''); setAcResults([]); setSelectedSearchItem(null); }}
                style={styles.iconBtn}
                accessibilityLabel="Limpiar búsqueda"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={18} color={colors.inkMuted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/(modals)/settings')}
              accessibilityLabel="Abrir ajustes"
              accessibilityRole="button"
            >
              <Ionicons name="options-outline" size={20} color={colors.brand} />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.divider} />

          <View style={styles.categoryContainer}>
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={handleCategorySelect}
            />
          </View>
        </BlurView>

        {acResults.length > 0 && (
          <View style={dynamicStyles.dropdown}>
            <FlatList
              data={acResults}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    dynamicStyles.dropdownItem,
                    index === acResults.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  <Text style={dynamicStyles.dropdownName} numberOfLines={1}>{item.display}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      <NearbySheet
        items={nearbyItems}
        selectedId={selectedId}
        onSelectItem={handleSheetItemPress}
        loading={loading}
      />
    </View>
    </AnimatedTabScene>
  );
}

const styles = StyleSheet.create({
  topControls: {
    position: 'absolute',
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 52,
  },
  iconBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
