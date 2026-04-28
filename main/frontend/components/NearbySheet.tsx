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
import { useTranslation } from "react-i18next";
import { useDeviceType } from '../hooks/useDeviceType';
import { MapItem } from '../types/map';
import { formatDistance } from '../utils/format';
import { useTheme } from '../utils/theme';
import GADOIcon from './GADOIcon';
import Icon from './Icon';

const CATEGORY_COLORS: Record<string, string> = {
  food:       '#FF6B35',
  restaurant: '#FF6B35',
  nightlife:  '#3B82F6',
  shopping:   '#10B981',
  health:     '#EF4444',
  nature:     '#22C55E',
  culture:    '#F59E0B',
  services:   '#94A3B8',
  sport:      '#0EA5E9',
  education:  '#8B5CF6',
  event:      '#EC4899',
  market:     '#F97316',
  music:      '#A855F7',
  report:     '#EF4444',
};

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
  const { t } = useTranslation();
  const { colors, radii, typography, shadows } = useTheme();
  const catColor = CATEGORY_COLORS[item.category_id] ?? colors.inkWhisper;
  const rating = item.metadata?.rating as number | undefined;
  const distance = item.distance_m > 0 ? formatDistance(item.distance_m) : '';

  const styles = useMemo(() => StyleSheet.create({
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 18,
      marginBottom: 6,
      backgroundColor: selected ? colors.surface : 'transparent',
      borderWidth: 1,
      borderColor: selected ? colors.strokeStrong : 'transparent',
      ... (selected ? shadows.soft : {}),
    },
    itemIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      marginRight: 14,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: typography.heading,
      color: colors.ink,
      marginBottom: 3,
    },
    itemMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    itemRating: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFB800',
      fontFamily: typography.mono,
    },
    itemDistance: {
      fontSize: 12,
      fontFamily: typography.body,
      color: colors.inkMuted,
      fontWeight: '500',
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    }
  }), [colors, radii, typography, selected, shadows]);

  return (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.itemIconBox}>
        <GADOIcon name={item.category_id || 'explore'} category={item.item_type as any} size={22} color={catColor} />
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
          style={styles.navBtn}
          activeOpacity={0.8}
        >
          <Icon name="arrow-right" size={16} color={colors.shell} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function NearbySheet({ items, selectedId, onSelectItem, loading, hasSearched }: Props) {
  const { t } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();
  const { isDesktop } = useDeviceType();
  const [expanded, setExpanded] = useState(false);
  const animHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

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
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
      ...shadows.lift,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    header: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 14,
      paddingHorizontal: 20,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.strokeStrong,
      borderRadius: 2,
      marginBottom: 10,
    },
    headerText: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
      letterSpacing: -0.1,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 30,
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
          setExpanded(true);
          Animated.spring(animHeight, {
            toValue: EXPANDED_HEIGHT,
            useNativeDriver: false,
            friction: 10,
          }).start();
        } else if (g.dy > 30) {
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

  const desktopWidth = 400;
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
          borderRadius: 24,
          maxHeight: SCREEN_HEIGHT - 240,
        },
      ]}
    >
      <View {...panResponder.panHandlers}>
        <TouchableOpacity 
          style={styles.header} 
          onPress={toggle} 
          activeOpacity={0.9}
        >
          <View style={styles.handle} />
          <Text style={styles.headerText}>
            {loading
              ? t('common.loading')
              : (items && items.length > 0)
                ? t('explore.showingPlaces', { count: items.length })
                : (hasSearched ? t('flow.noResults') : '')}
          </Text>
        </TouchableOpacity>
      </View>

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
