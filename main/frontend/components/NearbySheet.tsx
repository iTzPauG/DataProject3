import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useDeviceType } from '../hooks/useDeviceType';
import { MapItem } from '../types/map';
import { formatDistance } from '../utils/format';
import { useTheme } from '../utils/theme';
import CategoryMonogram from './CategoryMonogram';
import Icon from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const COLLAPSED_HEIGHT = 52;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.82;

interface Props {
  items: MapItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  loading?: boolean;
  hasSearched?: boolean;
}

function NearbyItem({
  item,
  selected,
  onShowInMap,
  onOpenDetails,
}: {
  item: MapItem;
  selected: boolean;
  onShowInMap: () => void;
  onOpenDetails: () => void;
}) {
  const { colors, typography, space } = useTheme();
  const rating = item.metadata?.rating as number | undefined;
  const distance = item.distance_m > 0 ? formatDistance(item.distance_m) : '';

  const styles = useMemo(() => StyleSheet.create({
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      marginBottom: 1,
      backgroundColor: selected ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    itemIconBox: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: space.md,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: typography.heading,
      color: colors.ink,
      marginBottom: 2,
    },
    itemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    itemRating: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
      fontFamily: typography.mono,
    },
    itemDistance: {
      fontSize: 12,
      fontFamily: typography.body,
      color: colors.inkMuted,
      fontWeight: '500',
    },
    actionsCol: {
      gap: 8,
      marginLeft: 8,
    },
    mapBtn: {
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: '#22C55E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapBtnText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: typography.body,
    },
    detailBtn: {
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailBtnText: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: '600',
      fontFamily: typography.body,
    },
  }), [colors, typography, selected, space]);

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemIconBox}>
        <CategoryMonogram
          categoryId={item.category_id}
          label={item.title}
          size={44}
          variant={selected ? 'filled' : 'ring'}
        />
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.itemMeta}>
          {rating != null ? <Text style={styles.itemRating}>★ {rating.toFixed(1)}</Text> : null}
          {distance ? <Text style={styles.itemDistance}>{rating != null ? ' · ' : ''}{distance}</Text> : null}
        </View>
      </View>

      <View style={styles.actionsCol}>
        <TouchableOpacity onPress={onShowInMap} style={styles.mapBtn} activeOpacity={0.85}>
          <Text style={styles.mapBtnText}>Mostrar en mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenDetails} style={styles.detailBtn} activeOpacity={0.85}>
          <Text style={styles.detailBtnText}>Ver ficha</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NearbySheet({ items, selectedId, onSelectItem, loading, hasSearched }: Props) {
  const { colors, typography, space } = useTheme();
  const { isDesktop } = useDeviceType();
  const [expanded, setExpanded] = useState(false);
  const animHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      overflow: 'hidden',
    },
    blurView: {
      flex: 1,
      backgroundColor: 'rgba(24, 26, 35, 0.88)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    collapsedLauncher: {
      height: COLLAPSED_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    launcherPill: {
      height: 34,
      borderRadius: 999,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      flexDirection: 'row',
      gap: 8,
    },
    launcherText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '700',
      fontFamily: typography.body,
    },
    topRow: {
      paddingTop: space.md,
      paddingHorizontal: space.md,
      paddingBottom: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topTitle: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '800',
      fontFamily: typography.heading,
    },
    mapBackBtn: {
      height: 34,
      borderRadius: 999,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      flexDirection: 'row',
      gap: 6,
    },
    mapBackText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '700',
      fontFamily: typography.body,
    },
    list: {
      paddingBottom: 36,
    },
    emptyState: {
      paddingHorizontal: 20,
      paddingVertical: 28,
      color: colors.inkMuted,
      fontSize: 14,
      fontFamily: typography.body,
    },
  }), [colors, typography, space]);

  const expand = useCallback(() => {
    setExpanded(true);
    Animated.spring(animHeight, {
      toValue: EXPANDED_HEIGHT,
      useNativeDriver: false,
      friction: 10,
      tension: 80,
    }).start();
  }, [animHeight]);

  const collapse = useCallback(() => {
    Animated.spring(animHeight, {
      toValue: COLLAPSED_HEIGHT,
      useNativeDriver: false,
      friction: 10,
      tension: 80,
    }).start(() => setExpanded(false));
  }, [animHeight]);

  const renderItem = useCallback(
    ({ item }: { item: MapItem }) => (
      <NearbyItem
        item={item}
        selected={selectedId === item.item_id}
        onShowInMap={() => {
          onSelectItem(item.item_id);
          collapse();
        }}
        onOpenDetails={() => {
          const pathname = item.item_type === 'event' ? '/(modals)/event-details' : '/(modals)/place-details';
          router.push({ pathname: pathname as any, params: { id: item.item_id, type: item.item_type } });
        }}
      />
    ),
    [selectedId, onSelectItem, collapse],
  );

  const desktopWidth = 600;
  const desktopLeft = 40;

  if ((!items || items.length === 0) && !loading) return null;
  if (!expanded && !selectedId) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { height: animHeight },
        isDesktop && {
          width: desktopWidth,
          left: desktopLeft,
          bottom: 24,
          borderRadius: 24,
          maxHeight: SCREEN_HEIGHT - 120,
        },
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blurView}>
        {!expanded ? (
          <TouchableOpacity style={styles.collapsedLauncher} onPress={expand} activeOpacity={0.9}>
            <View style={styles.launcherPill}>
              <Icon name="tag" size={14} color={colors.ink} strokeWidth={2} />
              <Text style={styles.launcherText}>Mostrar en modo lista</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.topRow}>
              <Text style={styles.topTitle}>Modo lista</Text>
              <TouchableOpacity style={styles.mapBackBtn} onPress={collapse} activeOpacity={0.85}>
                <Icon name="map" size={14} color={colors.ink} strokeWidth={2} />
                <Text style={styles.mapBackText}>Volver al mapa</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <Text style={styles.emptyState}>Cargando lugares...</Text>
            ) : (hasSearched && items.length === 0) ? (
              <Text style={styles.emptyState}>No hay resultados para mostrar.</Text>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.item_id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                scrollEnabled
              />
            )}
          </>
        )}
      </BlurView>
    </Animated.View>
  );
}
