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
import { BlurView } from 'expo-blur';
import { useDeviceType } from '../hooks/useDeviceType';
import { MapItem } from '../types/map';
import { formatDistance } from '../utils/format';
import { useTheme } from '../utils/theme';
import CategoryMonogram from './CategoryMonogram';
import Icon from './Icon';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_H = 64;
const ITEM_H = 76;
// Collapsed: header + 1 item peeking. Expanded: header + ~5 items.
const COLLAPSED_HEIGHT = HEADER_H + ITEM_H;
const EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.7, HEADER_H + ITEM_H * 5 + 24);

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
      backgroundColor: selected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    }
  }), [colors, typography, selected, space]);

  return (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
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
  const { colors, radii, shadows, typography, space } = useTheme();
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
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
    },
    blurView: {
      flex: 1,
      backgroundColor: 'rgba(24, 26, 35, 0.85)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    header: {
      alignItems: 'center',
      paddingTop: space.sm,
      paddingBottom: space.md,
      paddingHorizontal: space.lg,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.strokeStrong,
      borderRadius: 2,
      marginBottom: space.sm,
    },
    headerText: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
      letterSpacing: -0.1,
    },
    list: {
      paddingBottom: 40,
    },
  }), [colors, radii, shadows, typography, space]);

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

  const desktopWidth = 720;
  const desktopLeft = 40;

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
      <BlurView intensity={80} tint="dark" style={styles.blurView}>
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
      </BlurView>
    </Animated.View>
  );
}
