import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useDeviceType } from '../hooks/useDeviceType';
import { MapItem } from '../types/map';
import { formatDistance } from '../utils/format';
import { useTheme } from '../utils/theme';
import CategoryMonogram from './CategoryMonogram';
import Icon from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const COLLAPSED_HEIGHT = 52;

const BACKEND_URL =
  (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_BACKEND_URL : undefined) ||
  'https://restaurant-api-gcfbpra65a-ew.a.run.app';

function resolvePhotoUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string' || raw.length === 0) return null;
  if (raw.startsWith('/')) return `${BACKEND_URL}${raw}`;
  return raw;
}

function priceLabel(level: unknown): string {
  const n = Number(level);
  if (!n || n < 1) return '';
  return '€'.repeat(Math.min(n, 4));
}

interface Props {
  items: MapItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  loading?: boolean;
  hasSearched?: boolean;
  topOffset?: number;
  containerHeight?: number;
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
  const { t } = useTranslation();
  const isDeal = item.item_id.startsWith('deal:');
  const photoUrl = isDeal ? null : resolvePhotoUrl(item.metadata?.photo_url);
  const rating = item.metadata?.rating as number | undefined;
  const distance = item.distance_m > 0 ? formatDistance(item.distance_m) : '';
  const address = item.metadata?.address as string | undefined;
  const cuisine = ((item.metadata?.cuisine_type ?? item.metadata?.cuisine) as string | undefined);
  const priceLbl = priceLabel(item.metadata?.price_level);
  const dealPrice = isDeal ? (item.metadata?.price as number | undefined) : undefined;
  const dealOriginal = isDeal ? (item.metadata?.original_price as number | undefined) : undefined;

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: space.md,
      backgroundColor: selected ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
      gap: 10,
    },
    photo: {
      width: 64,
      height: 64,
      borderRadius: 10,
    },
    photoFallback: {
      width: 64,
      height: 64,
      borderRadius: 10,
      overflow: 'hidden',
    },
    info: {
      flex: 1,
      gap: 3,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
      lineHeight: 18,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    rating: {
      fontSize: 12,
      fontWeight: '700',
      color: '#F59E0B',
      fontFamily: typography.mono,
    },
    dist: {
      fontSize: 11,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    sep: {
      fontSize: 11,
      color: colors.inkMuted,
      opacity: 0.4,
    },
    badge: {
      fontSize: 11,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    priceBadge: {
      fontSize: 11,
      color: '#22C55E',
      fontFamily: typography.body,
      fontWeight: '700',
    },
    address: {
      fontSize: 11,
      color: colors.inkMuted,
      fontFamily: typography.body,
      opacity: 0.7,
    },
    actions: {
      gap: 6,
      alignItems: 'stretch',
    },
    mapBtn: {
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: '#22C55E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapBtnText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
      fontFamily: typography.body,
    },
    detailBtn: {
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailBtnText: {
      color: colors.ink,
      fontSize: 10,
      fontWeight: '600',
      fontFamily: typography.body,
    },
  }), [colors, typography, selected, space]);

  return (
    <View style={styles.row}>
      {/* Thumbnail */}
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photoFallback}>
          <CategoryMonogram
            categoryId={item.category_id}
            label={item.title}
            size={64}
            variant={selected ? 'filled' : 'ring'}
          />
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {/* Rating + distance */}
        {(rating != null || distance) ? (
          <View style={styles.metaRow}>
            {rating != null && <Text style={styles.rating}>★ {rating.toFixed(1)}</Text>}
            {rating != null && distance ? <Text style={styles.sep}>·</Text> : null}
            {distance ? <Text style={styles.dist}>{distance}</Text> : null}
          </View>
        ) : null}

        {/* Cuisine + price */}
        {(cuisine || priceLbl || dealPrice != null) ? (
          <View style={styles.metaRow}>
            {cuisine ? <Text style={styles.badge}>{cuisine}</Text> : null}
            {cuisine && (priceLbl || dealPrice != null) ? <Text style={styles.sep}>·</Text> : null}
            {dealPrice != null ? (
              <Text style={styles.priceBadge}>
                {dealPrice.toFixed(2)}€{dealOriginal != null ? ` (antes ${dealOriginal.toFixed(2)}€)` : ''}
              </Text>
            ) : priceLbl ? (
              <Text style={styles.priceBadge}>{priceLbl}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Address */}
        {address ? (
          <Text style={styles.address} numberOfLines={1}>{address}</Text>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={onShowInMap} style={styles.mapBtn} activeOpacity={0.85}>
          <Text style={styles.mapBtnText}>{t('nearbySheet.showOnMap')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenDetails} style={styles.detailBtn} activeOpacity={0.85}>
          <Text style={styles.detailBtnText}>{t('nearbySheet.viewDetails')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NearbySheet({ items, selectedId, onSelectItem, loading, hasSearched, topOffset, containerHeight }: Props) {
  const { colors, typography, space } = useTheme();
  const { t } = useTranslation();
  const { isDesktop } = useDeviceType();
  const [expanded, setExpanded] = useState(false);

  // Expanded height stops exactly at the bottom of the filter panel (topOffset),
  // growing upward from bottom: 0 of the actual map container (not full SCREEN_HEIGHT).
  const availableHeight = containerHeight && containerHeight > 0 ? containerHeight : SCREEN_HEIGHT;
  const expandedHeight = availableHeight - (topOffset ?? availableHeight * 0.2) - 8;
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
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignSelf: 'center',
      marginTop: 8,
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
      paddingBottom: 100,
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
      toValue: expandedHeight,
      useNativeDriver: false,
      friction: 10,
      tension: 80,
    }).start();
  }, [animHeight, expandedHeight]);

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
          if (item.item_id.startsWith('deal:')) {
            onSelectItem(item.item_id);
            return;
          }
          const pathname = item.item_type === 'event' ? '/(modals)/event-details' : '/(modals)/place-details';
          router.push({ pathname: pathname as any, params: { id: item.item_id, type: item.item_type } });
        }}
      />
    ),
    [selectedId, onSelectItem, collapse],
  );

  const desktopWidth = 600;
  const desktopLeft = 40;
  const count = items?.length ?? 0;
  const pillLabel = loading
    ? t('nearbySheet.loadingPlaces')
    : count > 0
      ? `${t('nearbySheet.showListMode')} (${count})`
      : t('nearbySheet.showListMode');

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
        <View style={styles.handle} />
        {!expanded ? (
          <TouchableOpacity style={styles.collapsedLauncher} onPress={expand} activeOpacity={0.9}>
            <View style={styles.launcherPill}>
              <Icon name="tag" size={14} color={colors.ink} strokeWidth={2} />
              <Text style={styles.launcherText}>{pillLabel}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.topRow}>
              <Text style={styles.topTitle}>{t('nearbySheet.listMode')}{count > 0 ? ` (${count})` : ''}</Text>
              <TouchableOpacity style={styles.mapBackBtn} onPress={collapse} activeOpacity={0.85}>
                <Icon name="map" size={14} color={colors.ink} strokeWidth={2} />
                <Text style={styles.mapBackText}>{t('nearbySheet.backToMap')}</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <Text style={styles.emptyState}>{t('nearbySheet.loadingPlaces')}</Text>
            ) : items.length === 0 ? (
              <Text style={styles.emptyState}>{t('nearbySheet.noResults')}</Text>
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
