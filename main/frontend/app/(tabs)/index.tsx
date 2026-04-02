import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Map from '../../components/map/Map';
import CategoryFilter from '../../components/CategoryFilter';
import NearbySheet from '../../components/NearbySheet';
import { useAppState } from '../../hooks/useAppState';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useLocation } from '../../hooks/useLocation';
import { fetchNearbyItems, fetchCategories } from '../../services/mapService';
import { Category, MapItem } from '../../types';
import { useTheme } from '../../utils/theme';

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
  const hasAutoCentered = useRef(false);

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
  }), [colors, theme, shadows]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return nearbyItems;
    const query = searchQuery.toLowerCase();
    return nearbyItems.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(query);
      const categoryMatch = item.category_id?.toLowerCase().includes(query);
      return titleMatch || categoryMatch;
    });
  }, [nearbyItems, searchQuery]);

  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setMapRegion({
        lat: location.lat,
        lng: location.lng,
        latDelta: 0.015,
        lngDelta: 0.015,
      });
    }
  }, [location, setMapRegion]);

  const handleCategorySelect = useCallback(
    (categoryId: string | null) => {
      setSelectedCategory(categoryId);
    },
    [setSelectedCategory],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  },[]);

  useEffect(() => {
    if (params.category && params.category !== selectedCategory) {
      setSelectedCategory(params.category);
    }
  }, [params.category, selectedCategory, setSelectedCategory]);

  useEffect(() => {
    if (!location.loading && !location.error && !hasAutoCentered.current && location.lat && location.lng) {
      // ONLY center once on initial load
      handleCenterOnUser();
      hasAutoCentered.current = true;
    }
  }, [location.loading, location.error, location.lat, location.lng, handleCenterOnUser]);

  useEffect(() => {
    if (location.loading && !mapRegion) return;
    
    // Browse priority: use map center if user has moved, otherwise GPS
    const searchLat = mapRegion?.lat ?? location.lat;
    const searchLng = mapRegion?.lng ?? location.lng;
    
    if (searchLat === null || searchLng === null) return;

    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const lang = mapPreferences.language === 'system' ? 'es' : mapPreferences.language;
        // Always send 'place'; conditionally add events/reports based on toggle
        const itemTypes: string[] = [];
        if (mapPreferences.showRealTimeEvents) {
          itemTypes.push('event', 'report');
        }
        
        let items: MapItem[] = [];
        if (itemTypes.length > 0) {
          items = await fetchNearbyItems(searchLat, searchLng, mapPreferences.defaultRadiusM, selectedCategory, lang, itemTypes);
        }
        
        // Fetch full bookmarks details
        try {
          const { supabase } = require('../../services/supabase');
          const { data: bData } = await supabase.from('saved_items').select('item_id, item_type');
          
          if (bData && bData.length > 0) {
             const placeIds = bData.filter((b: any) => b.item_type === 'place').map((b: any) => b.item_id);
             
             if (placeIds.length > 0) {
                // Fetch basic place data for these IDs from our backend or just pass them
                const bookmarksRaw = await fetchNearbyItems(searchLat, searchLng, 50000, null, lang, ['place']);
                const bookmarkedPlaces = bookmarksRaw.filter((p: any) => placeIds.includes(p.item_id));
                
                const existingIds = new Set(items.map(i => i.item_id));
                bookmarkedPlaces.forEach((b: any) => {
                  if (!existingIds.has(b.item_id)) {
                    b.metadata = { ...b.metadata, is_favorite: true };
                    items.push(b);
                  }
                });
             }
          }
        } catch (err) {}
        
        setNearbyItems(items);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 800); // 800ms debounce allows smooth panning

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  },[
    mapRegion?.lat,
    mapRegion?.lng,
    selectedCategory,
    setNearbyItems,
    mapPreferences.defaultRadiusM,
    mapPreferences.showRealTimeEvents,
    // location.lat/lng removed to prevent periodic re-centering bugs
  ]);

  const desktopWidth = Math.min(windowWidth - 40, 600);
  const leftOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 16;
  const rightOffset = isDesktop ? (windowWidth - desktopWidth) / 2 : 16;

  const minimalist = mapPreferences.mapStyle === 'minimal';

  return (
    <AnimatedTabScene>
    <View style={dynamicStyles.container}>
      <Map
        items={filteredItems}
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
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              accessibilityLabel="Campo de búsqueda"
            />

            {searchQuery.length > 0 && Platform.OS === 'android' && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')} 
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
      </View>

      <NearbySheet
        items={filteredItems}
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
