/**
 * Map.native.tsx — react-native-maps for iOS.
 *
 * Supports two rendering modes:
 *   1. MapItem[] (Phase 2+) — category-colored icon markers
 *   2. Restaurant[] (legacy recommendation flow) — photo-circle markers with sentiment ring
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { MINIMALIST_MAP_STYLE } from '../../utils/mapStyles';
import { VoteData } from '../../services/api';
import { Restaurant } from '../../types/restaurant';
import { MapItem } from '../../types/map';
import { formatDistance } from '../../utils/format';
import { useTheme } from '../../utils/theme';

export interface MapProps {
  // New: generic map items (Phase 2+)
  items?: MapItem[];
  selectedId: string | null;
  onSelectItem?: (id: string) => void;
  onRegionChange?: (lat: number, lng: number, latDelta: number, lngDelta: number) => void;
  region?: { lat: number; lng: number; latDelta: number; lngDelta: number };
  // Format
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'minimal';
  minimalist?: boolean;
  gadoOverlay?: boolean;
  showZoomControls?: boolean; // ignored on native — uses pinch gesture
  // Legacy: restaurant flow
  restaurants?: Restaurant[];
  onSelectRestaurant?: (id: string) => void;
  votesMap?: Record<string, VoteData>;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { color: string; icon: string }> = {
  restaurant: { color: '#FF6B35', icon: '🍽️' },
  event:      { color: '#8B5CF6', icon: '📅' },
  nightlife:  { color: '#3B82F6', icon: '🌙' },
  cinema:     { color: '#EF4444', icon: '🎬' },
  market:     { color: '#10B981', icon: '🛍️' },
  report:     { color: '#F59E0B', icon: '📢' },
};

const DEFAULT_STYLE = { color: '#9E9E9E', icon: '📍' };

// ─── Sentiment color (legacy) ─────────────────────────────────────────────────

function sentimentColor(votes?: VoteData): string {
  if (!votes || (votes.likes === 0 && votes.dislikes === 0)) return '#9E9E9E';
  const total = votes.likes + votes.dislikes;
  const ratio = votes.likes / total;

  let r: number, g: number, b: number;
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    r = 244 + (255 - 244) * t;
    g = 67 + (193 - 67) * t;
    b = 54 + (7 - 54) * t;
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = 255 + (76 - 255) * t;
    g = 193 + (175 - 193) * t;
    b = 7 + (80 - 7) * t;
  }

  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Map({
  items,
  selectedId,
  onSelectItem,
  onRegionChange,
  region,
  mapType = 'standard',
  minimalist = true,
  gadoOverlay = false,
  restaurants,
  onSelectRestaurant,
  votesMap,
}: MapProps) {
  const { colors, radii, shadows, typography } = useTheme();
  const mapRef = useRef<MapView>(null);
  const lastRegion = useRef({ lat: 0, lng: 0 });
  const effectiveMinimalist = minimalist || mapType === 'minimal';
  const nativeMapType = mapType === 'minimal' ? 'standard' : mapType;

  const styles = useMemo(() => StyleSheet.create({
    markerContainer: {
      alignItems: 'center',
    },
    liveHalo: {
      position: 'absolute',
      borderWidth: 2,
      backgroundColor: 'transparent',
    },
    categoryMarker: {
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    ratingBadge: {
      position: 'absolute',
      bottom: -4,
      right: -6,
      borderRadius: 8,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
    },
    ratingBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    callout: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 10,
      minWidth: 160,
      maxWidth: 220,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    calloutName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 2,
    },
    calloutMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    calloutRating: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFCC00',
    },
    calloutDistance: {
      fontSize: 12,
      color: colors.inkMuted,
    },
    calloutTagline: {
      fontSize: 11,
      color: colors.inkMuted,
      fontStyle: 'italic',
    },
  }), [colors, radii, shadows, typography]);

  // Fly to selected item
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;

    const item = items?.find((i) => i.item_id === selectedId);
    if (item) {
      mapRef.current.animateToRegion(
        { latitude: item.lat, longitude: item.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        400,
      );
      return;
    }

    const r = restaurants?.find((r) => r.id === selectedId);
    if (r) {
      mapRef.current.animateToRegion(
        { latitude: r.lat, longitude: r.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        400,
      );
    }
  }, [selectedId, items, restaurants]);

  // Handle external region changes
  useEffect(() => {
    if (!region || !mapRef.current) return;
    // Prevent loop: only animate if significantly different from the last reported region
    const dLat = Math.abs(region.lat - lastRegion.current.lat);
    const dLng = Math.abs(region.lng - lastRegion.current.lng);
    if (dLat > 0.0001 || dLng > 0.0001) {
      mapRef.current.animateToRegion(
        {
          latitude: region.lat,
          longitude: region.lng,
          latitudeDelta: region.latDelta,
          longitudeDelta: region.lngDelta,
        },
        400,
      );
    }
  }, [region]);

  // Determine initial center
  const firstItem = items?.[0];
  const firstRestaurant = restaurants?.[0];
  const centerLat = firstItem?.lat ?? firstRestaurant?.lat ?? 39.4699;
  const centerLng = firstItem?.lng ?? firstRestaurant?.lng ?? -0.3763;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      mapType={nativeMapType}
      customMapStyle={effectiveMinimalist ? (MINIMALIST_MAP_STYLE as any) : undefined}
      showsUserLocation
      showsMyLocationButton
      initialRegion={{
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }}
      onRegionChangeComplete={(region) => {
        lastRegion.current = { lat: region.latitude, lng: region.longitude };
        onRegionChange?.(
          region.latitude,
          region.longitude,
          region.latitudeDelta,
          region.longitudeDelta,
        );
      }}
    >
      {/* Category item markers */}
      {(items ?? []).map((item) => {
        // Use backend color if available, otherwise fall back to category styles
        const backendColor = item.color;
        const backendIcon = item.icon;
        const catStyle = backendColor
          ? { color: backendColor, icon: backendIcon ?? '📍' }
          : (CATEGORY_STYLES[item.category_id] ?? DEFAULT_STYLE);
        const isSelected = selectedId === item.item_id;
        const highlightLive = gadoOverlay && (item.item_type === 'report' || item.item_type === 'event');
        const size = isSelected ? 48 : highlightLive ? 44 : 38;
        const photoUrl = item.metadata?.photo_url as string | undefined;
        const ratingVal = item.metadata?.rating as number | undefined;
        const distance = item.distance_m > 0 ? formatDistance(item.distance_m) : '';

        return (
          <Marker
            key={item.item_id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            onPress={() => onSelectItem?.(item.item_id)}
          >
            <View style={styles.markerContainer}>
              {highlightLive ? (
                <View
                  style={[
                    styles.liveHalo,
                    {
                      width: size + 10,
                      height: size + 10,
                      borderRadius: (size + 10) / 2,
                      borderColor: `${catStyle.color}80`,
                    },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.categoryMarker,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: catStyle.color,
                  },
                  isSelected && { shadowColor: catStyle.color, shadowOpacity: 0.6 },
                ]}
              >
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={{
                      width: size - 8,
                      height: size - 8,
                      borderRadius: (size - 8) / 2,
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0.9)',
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#FFFFFF' }}>
                    {(item.title?.[0] ?? item.category_id?.[0] ?? '?').toUpperCase()}
                  </Text>
                )}
              </View>
              {ratingVal != null && (
                <View style={[styles.ratingBadge, { backgroundColor: catStyle.color }]}>
                  <Text style={styles.ratingBadgeText}>{ratingVal.toFixed(1)}</Text>
                </View>
              )}
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutName} numberOfLines={1}>
                  {catStyle.icon} {item.title}
                </Text>
                <View style={styles.calloutMeta}>
                  {ratingVal != null && (
                    <Text style={styles.calloutRating}>★ {ratingVal.toFixed(1)}</Text>
                  )}
                  {distance ? (
                    <Text style={styles.calloutDistance}>
                      {ratingVal != null ? ' · ' : ''}{distance}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Callout>
          </Marker>
        );
      })}

      {/* Legacy restaurant markers */}
      {(restaurants ?? []).map((r, i) => {
        const isSelected = selectedId === r.id;
        const distance = r.distanceM > 0 ? formatDistance(r.distanceM) : '';
        const size = isSelected ? 52 : 44;
        const ringColor = sentimentColor(votesMap?.[r.id]);
        return (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.lat, longitude: r.lng }}
            onPress={() => onSelectRestaurant?.(r.id)}
          >
            <View style={styles.markerContainer}>
              <View
                style={[
                  styles.categoryMarker,
                  { width: size, height: size, borderRadius: size / 2, backgroundColor: ringColor },
                  isSelected && { shadowColor: ringColor, shadowOpacity: 0.6 },
                ]}
              >
                <Image
                  source={{ uri: r.photoUrl }}
                  style={{
                    width: size - 8,
                    height: size - 8,
                    borderRadius: (size - 8) / 2,
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.9)',
                  }}
                  resizeMode="cover"
                />
              </View>
              <View style={[styles.ratingBadge, { backgroundColor: ringColor }]}>
                <Text style={styles.ratingBadgeText}>{r.rating.toFixed(1)}</Text>
              </View>
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutName} numberOfLines={1}>
                  {r.name}
                </Text>
                <View style={styles.calloutMeta}>
                  <Text style={styles.calloutRating}>★ {r.rating.toFixed(1)}</Text>
                  {distance ? (
                    <Text style={styles.calloutDistance}> · {distance}</Text>
                  ) : null}
                </View>
                {r.tagline ? (
                  <Text style={styles.calloutTagline} numberOfLines={1}>
                    {r.tagline}
                  </Text>
                ) : null}
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}
