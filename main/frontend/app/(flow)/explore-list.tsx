import { useTranslation } from "react-i18next";
import { Ionicons } from '../../components/SafeIonicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation } from '../../hooks/useLocation';
import { fetchNearbyItems } from '../../services/mapService';
import { useTheme } from '../../utils/theme';
import { MapItem } from '../../types/map';
import { formatDistance } from '../../utils/format';

type ItemTypeParam = 'place' | 'event';

export default function ExploreListScreen() {
  const { t } = useTranslation();
  const { colors, typography, space } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    categoryId?: string;
    itemType?: ItemTypeParam;
    title?: string;
  }>();
  const location = useLocation();
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    container: {
      flex: 1,
      maxWidth: 600,
      width: '100%',
      alignSelf: 'center',
    },
    header: {
      paddingHorizontal: space.lg,
      paddingTop: space.xl,
      paddingBottom: space.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: space.lg,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
      letterSpacing: -0.8,
    },
    counter: {
      fontSize: 13,
      color: colors.inkMuted,
      fontFamily: typography.mono,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 4,
    },
    listContent: {
      paddingBottom: 40,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: space.xl,
      paddingHorizontal: space.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
      letterSpacing: -0.4,
    },
    itemSubtitle: {
      marginTop: 4,
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    itemFooter: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    distanceText: {
      fontSize: 12,
      color: colors.brand,
      fontFamily: typography.mono,
      fontWeight: '600',
    },
    arrow: {
      color: colors.inkWhisper,
      fontSize: 20,
      fontFamily: typography.mono,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 16,
      color: colors.inkMuted,
      textAlign: 'center',
      fontFamily: typography.body,
    },
  }), [colors, typography, space]);

  const categoryId = params.categoryId ?? null;
  const itemType: ItemTypeParam = params.itemType === 'event' ? 'event' : 'place';
  const displayTitle = params.title ?? (itemType === 'event' ? t('explore.events') : t('common.none'));

  useEffect(() => {
    if (location.loading || location.lat === null || location.lng === null) return;
    setLoading(true);
    fetchNearbyItems(
      location.lat,
      location.lng,
      8000,
      categoryId,
      'es',
      [itemType],
    )
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location.loading, location.lat, location.lng, categoryId, itemType]);

  const emptyText = useMemo(() => {
    if (itemType === 'event') return t('flow.noResults');
    return t('flow.noResults');
  }, [itemType, t]);

  function renderItem({ item }: { item: MapItem }) {
    const metadata = item.metadata ?? {};
    const subtitle =
      item.item_type === 'event'
        ? String(metadata.price_info ?? t('explore.events'))
        : String(metadata.address ?? '');
    const distance = 'distance_m' in item ? formatDistance(item.distance_m) : '';

    return (
      <TouchableOpacity
        style={styles.itemRow}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/(modals)/place-details',
            params: { id: item.item_id, type: item.item_type },
          })
        }
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          {subtitle ? <Text style={styles.itemSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
          {distance ? (
            <View style={styles.itemFooter}>
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.counter}>{t('explore.showingPlaces', { count: items.length })}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.item_id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
