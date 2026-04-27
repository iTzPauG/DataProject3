/**
 * Map.web.tsx — Leaflet-based map for Expo Web.
 *
 * Supports two rendering modes:
 *   1. MapItem[] (Phase 2+) — category-colored icon markers
 *   2. Restaurant[] (legacy recommendation flow) — photo-circle markers with sentiment ring
 */
import L from 'leaflet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VoteData } from '../../services/api';
import { Restaurant } from '../../types/restaurant';
import { MapItem } from '../../types/map';
import { formatDistance } from '../../utils/format';
import type { MapProps } from './types';

// ─── Category config ──────────────────────────────────────────────────────────
//
// Markers are identified by colour + the title's first-letter monogram
// (rendered in the HTML template below).  No emoji icon — the old colored
// glyph approach was the single biggest "AI slop" tell on the map.

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#C97A5C',   // terracotta
  event:      '#D2A257',   // warm amber
  nightlife:  '#8A7ED6',   // muted violet
  cinema:     '#9C7BB0',   // lilac
  market:     '#C98E6A',   // clay
  report:     '#B5A050',   // mustard
};

const DEFAULT_COLOR = '#7F8392'; // slate

// ─── Category marker icon ─────────────────────────────────────────────────────

function createCategoryIcon(
  item: MapItem,
  selected: boolean,
  minimalist: boolean,
  gadoOverlay: boolean,
): L.DivIcon {
  const color =
    item.color ??
    CATEGORY_COLORS[item.category_id] ??
    DEFAULT_COLOR;

  const style = { color }; // For backward compatibility
  const highlightLive = gadoOverlay && (item.item_type === 'report' || item.item_type === 'event');
  const size = selected ? 48 : highlightLive ? 44 : 38;
  const shadow = selected
    ? `0 2px 12px ${style.color}88`
    : '0 2px 6px rgba(0,0,0,0.25)';
  const photoUrl = item.metadata?.photo_url as string | undefined;
  const isReport = item.item_type === 'report';
  const isEvent = item.item_type === 'event';

  const pulseAnim = (isReport || (gadoOverlay && isEvent))
    ? `<div style="
        position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;
        border-radius:50%;border:2px solid ${style.color};
        animation:gadoPulse 2s ease-out infinite;
      "></div>`
    : '';
  const liveHalo = highlightLive
    ? `<div style="
        position:absolute;top:-8px;left:-8px;right:-8px;bottom:-8px;
        border-radius:50%;border:1.5px solid ${style.color}66;
      "></div>`
    : '';

  const initial = (item.title?.[0] ?? item.category_id?.[0] ?? '?').toUpperCase();
  const content = photoUrl
    ? `<div style="
        width:${size - 8}px;height:${size - 8}px;border-radius:50%;
        background-image:url('${photoUrl}');background-size:cover;background-position:center;
        border:2px solid rgba(255,255,255,0.9);
      "></div>`
    : `<span style="font-size:${size * 0.38}px;font-weight:800;color:white;line-height:1;">${initial}</span>`;

  const ratingVal = item.metadata?.rating as number | undefined;
  const ratingBadge = ratingVal != null
    ? `<div style="
        position:absolute;bottom:-4px;right:-6px;
        background:${style.color};border-radius:8px;
        padding:1px 5px;border:1.5px solid white;
        font-size:9px;font-weight:800;color:white;
        line-height:14px;
      ">${ratingVal.toFixed(1)}</div>`
    : '';

  const bg = minimalist ? '#FFFFFF' : style.color;
  const iconColor = minimalist ? style.color : '#FFFFFF';
  const border = minimalist ? `2px solid ${style.color}` : 'none';

  return L.divIcon({
    className: '',
    iconSize: [size + 12, size + 8],
    iconAnchor: [(size + 12) / 2, (size + 8) / 2],
    popupAnchor: [0, -(size / 2 + 4)],
    html: `<div style="
      position:relative;width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};
      border:${border};
      display:flex;align-items:center;justify-content:center;
      box-shadow:${shadow};
      transition:all 0.2s ease;
      color:${iconColor};
    ">
      ${liveHalo}
      ${pulseAnim}
      ${content}
      ${ratingBadge}
    </div>`,
  });
}

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
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function createPhotoIcon(photoUrl: string, selected: boolean, color: string, rating?: number): L.DivIcon {
  const size = selected ? 56 : 44;
  const ringWidth = 4;
  const imgSize = size - ringWidth * 2;
  const shadow = selected
    ? `0 2px 10px ${color}88`
    : `0 2px 6px rgba(0,0,0,0.3)`;
  const ratingBadge = rating != null
    ? `<div style="
        position:absolute;bottom:-4px;right:-6px;
        background:${color};border-radius:8px;
        padding:1px 5px;border:1.5px solid white;
        font-size:9px;font-weight:800;color:white;
        line-height:14px;
      ">${rating.toFixed(1)}</div>`
    : '';
  return L.divIcon({
    className: '',
    iconSize: [size + 12, size + 8],
    iconAnchor: [(size + 12) / 2, (size + 8) / 2],
    popupAnchor: [0, -(size / 2 + 4)],
    html: `<div style="
      position:relative;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      box-shadow:${shadow};
      transition:all 0.2s ease;
    ">
      <div style="
        width:${imgSize}px;height:${imgSize}px;border-radius:50%;
        background-image:url('${photoUrl}');background-size:cover;background-position:center;
        border:2px solid rgba(255,255,255,0.9);
      "></div>
      ${ratingBadge}
    </div>`,
  });
}

// ─── User location hook ─────────────────────────────────────────────────────

function useUserLocation(): [number, number] | null {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return pos;
}

// ─── Map camera + events ────────────────────────────────────────────────────

function MapController({
  restaurants,
  items,
  selectedId,
  region,
  onRegionChange,
}: {
  restaurants?: Restaurant[];
  items?: MapItem[];
  selectedId: string | null;
  region?: { lat: number; lng: number; latDelta: number; lngDelta: number };
  onRegionChange?: (lat: number, lng: number, latDelta: number, lngDelta: number) => void;
}) {
  const map = useMap();
  const isInternalMove = useRef(false);

  useEffect(() => {
    if (!selectedId) return;
    const item = items?.find((i) => i.item_id === selectedId);
    if (item) {
      isInternalMove.current = true;
      map.setView([item.lat, item.lng], 15, { animate: true });
      return;
    }
    const r = restaurants?.find((r) => r.id === selectedId);
    if (r) {
      isInternalMove.current = true;
      map.setView([r.lat, r.lng], 15, { animate: true });
    }
  }, [selectedId, items, restaurants, map]);

  // Handle external region changes (e.g., center on user button)
  useEffect(() => {
    if (!region) return;
    // Don't act on external regions if we recently moved the map ourselves
    if (isInternalMove.current) {
      isInternalMove.current = false;
      return;
    }
    const center = map.getCenter();
    // Only move if significantly different to avoid feedback loops
    const distance = Math.sqrt(Math.pow(center.lat - region.lat, 2) + Math.pow(center.lng - region.lng, 2));
    if (distance > 0.001) {
      // For web Leaflet, we generally don't control zoom via delta easily without fitBounds.
      // We will keep the current zoom level to avoid auto-zooming out.
      map.setView([region.lat, region.lng], map.getZoom(), { animate: true });
    }
  }, [region, map]);

  useMapEvents({
    movestart: () => {
      // If the user starts dragging, it's an internal move
      isInternalMove.current = true;
    },
    moveend: () => {
      // Mark internal move as done after a tiny delay so the region effect doesn't bounce
      setTimeout(() => {
        isInternalMove.current = false;
      }, 50);

      if (!onRegionChange) return;
      const center = map.getCenter();
      const bounds = map.getBounds();
      const latDelta = bounds.getNorth() - bounds.getSouth();
      const lngDelta = bounds.getEast() - bounds.getWest();
      onRegionChange(center.lat, center.lng, latDelta, lngDelta);
    },
  });

  return null;
}

function MapLayoutFixer({
  refreshKey,
}: {
  refreshKey: string;
}) {
  const map = useMap();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => map.invalidateSize({ animate: false });

    refresh();
    requestAnimationFrame(refresh);
    timeoutId = setTimeout(refresh, 120);

    const container = map.getContainer();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => refresh())
      : null;
    observer?.observe(container);

    const onWindowResize = () => refresh();
    window.addEventListener('resize', onWindowResize);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, refreshKey]);

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

// Captures the Leaflet map instance into a MutableRefObject so we can call
// zoomIn/zoomOut from outside the MapContainer context.
function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

export default function Map({
  items,
  selectedId,
  onSelectItem,
  onRegionChange,
  region,
  mapType = 'standard',
  minimalist = true,
  gadoOverlay = false,
  showZoomControls = true,
  restaurants,
  onSelectRestaurant,
  votesMap,
}: MapProps) {
  const userLocation = useUserLocation();
  const cssInjected = useRef(false);
  const leafletMapRef = useRef<L.Map | null>(null);

  // Inject Leaflet CSS + pulse animation once
  useEffect(() => {
    if (cssInjected.current) return;
    cssInjected.current = true;

    const CSS_ID = 'leaflet-cdn-css';
    if (!document.getElementById(CSS_ID)) {
      const link = document.createElement('link');
      link.id = CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const PULSE_ID = 'gado-pulse-css';
    if (!document.getElementById(PULSE_ID)) {
      const style = document.createElement('style');
      style.id = PULSE_ID;
      style.textContent = `
        @keyframes gadoPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Legacy restaurant icons
  const restaurantIcons = useMemo(
    () =>
      (restaurants ?? []).map((r) => {
        const color = sentimentColor(votesMap?.[r.id]);
        return createPhotoIcon(r.photoUrl, selectedId === r.id, color, r.rating);
      }),
    [restaurants, selectedId, votesMap],
  );

  // Category item icons
  const itemIcons = useMemo(
    () => (items ?? []).map((item) => createCategoryIcon(
      item,
      selectedId === item.item_id,
      minimalist || mapType === 'minimal',
      gadoOverlay,
    )),
    [items, selectedId, minimalist, mapType, gadoOverlay],
  );

  // Determine initial center. MapContainer won't re-center automatically if this changes,
  // but if it unmounts, we want the best fallback. We prioritize region over the first item.
  const center: [number, number] = useMemo(() => {
    if (region) return [region.lat, region.lng];
    if (userLocation) return userLocation;
    if (items && items.length > 0) return [items[0].lat, items[0].lng];
    if (restaurants && restaurants.length > 0) return [restaurants[0].lat, restaurants[0].lng];
    return [39.4699, -0.3763]; // Valencia fallback
  }, [region, userLocation, items, restaurants]);

  const effectiveMinimalist = minimalist || mapType === 'minimal';
  const refreshKey = `${mapType}:${effectiveMinimalist}:${gadoOverlay}:${items?.length ?? 0}:${restaurants?.length ?? 0}`;

  const tileUrl = useMemo(() => {
    switch (mapType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'hybrid':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return effectiveMinimalist
          ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }, [mapType, effectiveMinimalist]);

  const overlayTileUrl = useMemo(() => {
    if (mapType === 'hybrid') {
      return 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
    }
    if (gadoOverlay && mapType !== 'satellite') {
      return 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
    }
    return null;
  }, [mapType, gadoOverlay]);

  const attribution = useMemo(() => {
    switch (mapType) {
      case 'satellite':
        return 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community';
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    }
  }, [mapType]);

  return (
    <View style={styles.container}>
      <MapContainer
        center={center}
        zoom={13}
        // @ts-ignore
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer attribution={attribution} url={tileUrl} />
        {overlayTileUrl ? (
          <TileLayer
            attribution={attribution}
            opacity={mapType === 'hybrid' ? 0.85 : 0.16}
            url={overlayTileUrl}
          />
        ) : null}
        <MapLayoutFixer refreshKey={refreshKey} />
        <MapRefCapture mapRef={leafletMapRef} />
        <MapController
          restaurants={restaurants}
          items={items}
          selectedId={selectedId}
          region={region}
          onRegionChange={onRegionChange}
        />

        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={8}
            pathOptions={{
              color: '#FFFFFF',
              weight: 3,
              fillColor: '#4A90D9',
              fillOpacity: 1,
            }}
          />
        )}

        {/* Category item markers */}
        {(items ?? []).map((item, i) => {
          // Use backend color if available, otherwise fall back to category styles
          const backendColor = item.color;
          const catStyle = backendColor
            ? { color: backendColor, icon: item.icon ?? '📍' } 
            : (CATEGORY_STYLES[item.category_id] ?? DEFAULT_STYLE);
          const distance = item.distance_m > 0 ? formatDistance(item.distance_m) : '';
          const liveLabel = gadoOverlay && item.item_type !== 'place'
            ? ` · ${item.item_type === 'report' ? 'EN VIVO' : 'evento'}`
            : '';
          return (
            <Marker
              key={item.item_id}
              position={[item.lat, item.lng]}
              icon={itemIcons[i]}
              eventHandlers={{ click: () => onSelectItem?.(item.item_id) }}
            >
              <Popup>
                <strong>
                  <span style={{ color: catStyle.color }}>{catStyle.icon}</span>{' '}
                  {item.title}
                </strong>
                {distance ? (
                  <>
                    <br />
                    <span style={{ fontSize: '12px', color: '#636366' }}>{distance}</span>
                  </>
                ) : null}
                {liveLabel ? (
                  <>
                    <br />
                    <span style={{ fontSize: '12px', color: catStyle.color, fontWeight: 700 }}>
                      {liveLabel.trim()}
                    </span>
                  </>
                ) : null}
                {item.metadata?.rating != null ? (
                  <>
                    {' '}
                    <span style={{ color: '#FFCC00' }}>★</span>{' '}
                    {(item.metadata.rating as number).toFixed(1)}
                  </>
                ) : null}
              </Popup>
            </Marker>
          );
        })}

        {/* Legacy restaurant markers */}
        {(restaurants ?? []).map((r, i) => {
          const distance = r.distanceM > 0 ? formatDistance(r.distanceM) : '';
          const votes = votesMap?.[r.id];
          const voteLabel = votes
            ? `+${votes.likes}  −${votes.dislikes}`
            : '';
          return (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={restaurantIcons[i]}
              eventHandlers={{ click: () => onSelectRestaurant?.(r.id) }}
            >
              <Popup>
                <strong>
                  {r.name}
                </strong>
                <br />
                <span style={{ color: '#FFCC00' }}>★</span> {r.rating.toFixed(1)}
                {distance ? ` · ${distance}` : ''}
                {voteLabel ? (
                  <>
                    <br />
                    <span style={{ fontSize: '12px' }}>{voteLabel}</span>
                  </>
                ) : null}
                <br />
                <em style={{ color: '#636366', fontSize: '12px' }}>{r.tagline}</em>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {showZoomControls && (
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => leafletMapRef.current?.zoomIn()} activeOpacity={0.75}>
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={() => leafletMapRef.current?.zoomOut()} activeOpacity={0.75}>
            <Text style={styles.zoomBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  zoomControls: {
    position: 'absolute',
    bottom: 100,
    right: 12,
    zIndex: 1000,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  zoomBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 22,
    fontWeight: '300',
    color: '#1C1C1E',
    lineHeight: 26,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
