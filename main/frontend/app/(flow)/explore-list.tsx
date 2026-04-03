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

type ItemTypeParam = 'place' | 'event';

export default function ExploreListScreen() {
  const { colors, typography } = useTheme();
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
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    counter: {
      marginTop: 4,
      fontSize: 13,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    listContent: {
      padding: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    cardSubtitle: {
      marginTop: 6,
      fontSize: 13,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    cardMeta: {
      marginTop: 8,
      fontSize: 12,
      color: colors.inkMuted,
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
    },
  }), [colors, typography]);

  const categoryId = params.categoryId ?? null;
  const itemType: ItemTypeParam = params.itemType === 'event' ? 'event' : 'place';
  const title = params.title ?? (itemType === 'event' ? 'Eventos' : 'Lugares');

  useEffect(() => {
    if (location.loading || location.lat === null || location.lng === null) return;
    setLoading(true);
    fetchNearbyItems(
      location.lat,
      location.lng,
      5000,
      categoryId,
      'es',
      [itemType],
    )
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location.loading, location.lat, location.lng, categoryId, itemType]);

  const emptyText = useMemo(() => {
    if (itemType === 'event') return 'No hay eventos cerca ahora';
    return 'No hay lugares cerca ahora';
  }, [itemType]);

  function renderItem({ item }: { item: MapItem }) {
    const metadata = item.metadata ?? {};
    const subtitle =
      item.item_type === 'event'
        ? String(metadata.price_info ?? 'Evento cercano')
        : String(metadata.address ?? '');
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/(modals)/place-details',
            params: { id: item.item_id, type: item.item_type },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </View>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        {'distance_m' in item && (
          <Text style={styles.cardMeta}>
            {(item.distance_m / 1000).toFixed(2)} km
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.counter}>Showing {items.length} places</Text>
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
          />
        )}
      </View>
    </SafeAreaView>
  );
}

