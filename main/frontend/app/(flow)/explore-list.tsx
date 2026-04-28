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
  const { colors, typography, shadows, radii } = useTheme();
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
      ...shadows.soft,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
      letterSpacing: -0.5,
    },
    counter: {
      fontSize: 13,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginTop: 2,
    },
    listContent: {
      padding: 16,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.stroke,
      ...shadows.soft,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    cardTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    cardSubtitle: {
      marginTop: 6,
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
      lineHeight: 20,
    },
    cardFooter: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.stroke,
    },
    distanceTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.bg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    distanceText: {
      fontSize: 12,
      color: colors.ink,
      fontFamily: typography.mono,
      fontWeight: '600',
    },
    viewText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.brand,
      fontFamily: typography.heading,
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
  }), [colors, typography, shadows]);

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
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/(modals)/place-details',
            params: { id: item.item_id, type: item.item_type },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkWhisper} />
        </View>
        {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        
        <View style={styles.cardFooter}>
          {distance ? (
            <View style={styles.distanceTag}>
              <Ionicons name="navigate" size={12} color={colors.brand} />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          ) : <View />}
          <Text style={styles.viewText}>{t('common.view')} →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.counter}>{t('explore.showingPlaces', { count: items.length })}</Text>
          </View>
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
