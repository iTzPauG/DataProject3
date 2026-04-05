/**
 * NearbySheet — collapsible bottom panel listing nearby map items.
 *
 * Simple implementation using Animated + PanResponder.
 * Two states: collapsed (peek header) and expanded (scrollable list).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useDeviceType } from '../hooks/useDeviceType';
import { MapItem } from '../types/map';
import { formatDistance } from '../utils/format';
import { useTheme } from '../utils/theme';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { color: string; icon: string }> = {
  // Place categories matching FALLBACK_CATEGORIES in mapService
  food:       { color: '#FF6B35', icon: '🍴' },
  restaurant: { color: '#FF6B35', icon: '🍽️' },
  nightlife:  { color: '#3B82F6', icon: '🌙' },
  shopping:   { color: '#10B981', icon: '🛒' },
  health:     { color: '#EF4444', icon: '💊' },
  nature:     { color: '#22C55E', icon: '🌿' },
  culture:    { color: '#F59E0B', icon: '🎭' },
  services:   { color: '#94A3B8', icon: '🛠️' },
  sport:      { color: '#0EA5E9', icon: '⚽' },
  education:  { color: '#8B5CF6', icon: '📚' },
  event:      { color: '#EC4899', icon: '🎉' },
  market:     { color: '#F97316', icon: '🏪' },
  music:      { color: '#A855F7', icon: '🎵' },
  report:     { color: '#EF4444', icon: '📢' },
  // Legacy / extra
  cinema:     { color: '#EF4444', icon: '🎬' },
};

const DEFAULT_STYLE = { color: '#9E9E9E', icon: '📍' };

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;
const COLLAPSED_HEIGHT = 100;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.5;

interface Props {
  items: MapItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  loading?: boolean;
  hasSearched?: boolean;
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function NearbyItem({
  item,
  selected,
  onPress,
  onNavigate,
}: {
  item: MapItem;
  selected: boolean;
  onPress: () => void;
  onNavigate: () => void;
}) {
  const { colors, radii, typography } = useTheme();
  const catStyle = CATEGORY_STYLES[item.category_id] ?? DEFAULT_STYLE;
  const rating = item.metadata?.rating as number | undefined;
  const distance = item.distance_m > 0 ? formatDistance(item.distance_m) : '';

  const styles = useMemo(() => StyleSheet.create({
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: radii.md,
      marginBottom: 4,
    },
    itemRowSelected: {
      backgroundColor: colors.brand + '15',
    },
    itemIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemIconText: {
      fontSize: 18,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: typography.heading,
      color: colors.ink,
      marginBottom: 2,
    },
    itemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemRating: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFCC00',
    },
    itemDistance: {
      fontSize: 12,
      fontFamily: typography.body,
      color: colors.inkMuted,
    },
  }), [colors, radii, typography]);

  return (
    <TouchableOpacity
      style={[styles.itemRow, selected && styles.itemRowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.itemIcon, { backgroundColor: catStyle.color }]}>
        <Text style={styles.itemIconText}>{catStyle.icon}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.itemMeta}>
          {rating != null && (
            <Text style={styles.itemRating}>★ {rating.toFixed(1)}</Text>
          )}
          {distance ? (
            <Text style={styles.itemDistance}>
              {rating != null ? ' · ' : ''}{distance}
            </Text>
          ) : null}
        </View>
      </View>
      {selected && (
        <TouchableOpacity
          onPress={onNavigate}
          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.brand, borderRadius: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Ver →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export default function NearbySheet({ items, selectedId, onSelectItem, loading, hasSearched }: Props) {
  const { colors, radii, shadows, typography } = useTheme();
  const { isDesktop } = useDeviceType();
  const [expanded, setExpanded] = useState(false);
  const animHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  // Auto-expand when an item is selected
  React.useEffect(() => {
    if (selectedId) {
      setExpanded(true);
      Animated.spring(animHeight, { toValue: EXPANDED_HEIGHT, useNativeDriver: false, friction: 10 }).start();
    }
  }, [selectedId]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      overflow: 'hidden',
      ...shadows.soft,
    },
    header: {
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.stroke,
      borderRadius: 2,
      marginBottom: 8,
    },
    headerText: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
    },
    list: {
      paddingHorizontal: 12,
      paddingBottom: 20,
    },
  }), [colors, radii, shadows, typography]);

  const toggle = useCallback(() => {
    const toExpanded = !expanded;
    setExpanded(toExpanded);
    Animated.spring(animHeight, {
      toValue: toExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
      useNativeDriver: false,
      friction: 10,
    }).start();
  }, [expanded, animHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30) {
          // Swipe up
          setExpanded(true);
          Animated.spring(animHeight, {
            toValue: EXPANDED_HEIGHT,
            useNativeDriver: false,
            friction: 10,
          }).start();
        } else if (g.dy > 30) {
          // Swipe down
          setExpanded(false);
          Animated.spring(animHeight, {
            toValue: COLLAPSED_HEIGHT,
            useNativeDriver: false,
            friction: 10,
          }).start();
        }
      },
    }),
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: MapItem }) => (
      <NearbyItem
        item={item}
        selected={selectedId === item.item_id}
        onPress={() => onSelectItem(item.item_id)}
        onNavigate={() => {
          const pathname = item.item_type === 'event' ? '/(modals)/event-details' : '/(modals)/place-details';
          router.push({ pathname: pathname as any, params: { id: item.item_id, type: item.item_type } });
        }}
      />
    ),
    [selectedId, onSelectItem],
  );

  const desktopWidth = 360;
  const desktopLeft = 24;

  if (!selectedId && !hasSearched && (!items || items.length === 0) && !loading) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { height: animHeight },
        isDesktop && {
          width: desktopWidth,
          left: desktopLeft,
          bottom: 24,
          borderRadius: 20,
          maxHeight: SCREEN_HEIGHT - 200,
        },
      ]}
    >
      {/* Drag handle */}
      <View {...panResponder.panHandlers}>
        <TouchableOpacity 
          style={styles.header} 
          onPress={toggle} 
          activeOpacity={0.9}
          hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }}
        >
          <View style={styles.handle} />
          <Text style={styles.headerText}>
            {loading
              ? 'Buscando...'
              : (items && items.length > 0)
                ? `${items.length} cerca de ti`
                : (hasSearched ? 'Sin resultados' : '')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.item_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        scrollEnabled={expanded}
      />
    </Animated.View>
  );
}

