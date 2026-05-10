import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getBookmarks } from '../../services/api';
import type { SavedItem } from '../../types';
import { useTheme } from '../../utils/theme';

const ITEM_TYPE_CONFIG: Record<
  SavedItem['item_type'],
  { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; route: string }
> = {
  place: { icon: 'location', color: '#FF6B35', label: 'Lugar', route: '/(modals)/place-details' },
  event: { icon: 'calendar', color: '#8B5CF6', label: 'Evento', route: '/(modals)/event-details' },
  report: { icon: 'megaphone', color: '#F59E0B', label: 'Reporte', route: '/(modals)/report-details' },
};

export default function SavedItemsModal() {
  const { colors, typography } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.shell,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.stroke,
        },
        closeButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.stroke,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 16,
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          gap: 12,
        },
        emptyTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        emptyText: {
          fontSize: 15,
          color: colors.inkMuted,
          textAlign: 'center',
          lineHeight: 22,
          fontFamily: typography.body,
        },
        retryButton: {
          marginTop: 8,
          paddingHorizontal: 24,
          paddingVertical: 10,
          backgroundColor: colors.brand,
          borderRadius: 10,
        },
        retryText: {
          color: '#FFF',
          fontWeight: '700',
          fontFamily: typography.heading,
        },
        listContent: {
          padding: 16,
        },
        itemCard: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
            android: { elevation: 2 },
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
          }),
        },
        thumb: {
          width: 56,
          height: 56,
          borderRadius: 14,
          marginRight: 14,
          backgroundColor: colors.bg,
        },
        thumbFallback: {
          width: 56,
          height: 56,
          borderRadius: 14,
          marginRight: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        itemContent: {
          flex: 1,
          gap: 4,
        },
        itemType: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.7,
          fontFamily: typography.heading,
        },
        itemTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        itemMeta: {
          fontSize: 12,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
      }),
    [colors, typography],
  );

  const fetchBookmarks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBookmarks();
      setBookmarks(data);
    } catch {
      setError('No se pudieron cargar los guardados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  // Open a saved item by routing into the proper details screen with prefill
  // data so the destination screen renders immediately even when the place is
  // not in the current `nearbyItems` window. Without prefill, place-details
  // showed "Lugar no encontrado" because the search-by-id fallback only finds
  // items whose name happens to match the UUID.
  const openBookmark = (b: SavedItem) => {
    const config = ITEM_TYPE_CONFIG[b.item_type];
    if (!config) return;
    const photo = (b.metadata as any)?.photo_url as string | undefined;
    const prefill = {
      id: b.item_id,
      name: b.title,
      item_type: b.item_type,
      lat: b.lat,
      lng: b.lng,
      category_id: b.category_id,
      address: (b.metadata as any)?.address ?? '',
      metadata: {
        ...(b.metadata as object),
        photo_url: photo,
      },
    };
    router.push({
      pathname: config.route as any,
      params: {
        id: b.item_id,
        prefill: JSON.stringify(prefill),
      },
    });
  };

  const renderItem = ({ item }: { item: SavedItem }) => {
    const config =
      ITEM_TYPE_CONFIG[item.item_type] ?? {
        icon: 'bookmark' as const,
        color: '#999',
        label: item.item_type,
        route: '/(modals)/place-details',
      };
    const photoUrl = (item.metadata as any)?.photo_url as string | undefined;
    const rating = (item.metadata as any)?.rating as number | undefined;
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => openBookmark(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${config.label} guardado: ${item.title}`}
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumbFallback, { backgroundColor: config.color + '22' }]}>
            <Ionicons name={config.icon} size={26} color={config.color} />
          </View>
        )}
        <View style={styles.itemContent}>
          <Text style={[styles.itemType, { color: config.color }]}>
            {config.label.toUpperCase()}
          </Text>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title || 'Sin título'}
          </Text>
          <Text style={styles.itemMeta} numberOfLines={1}>
            {rating != null ? `★ ${rating.toFixed(1)} · ` : ''}
            {(item.metadata as any)?.address || `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close') || 'Cerrar'}
        >
          <Ionicons name="close" size={16} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.menu.saved') || 'Guardados'}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>{t('common.error')}</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchBookmarks}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>{t('savedItems.empty')}</Text>
          <Text style={styles.emptyText}>
            {t('savedItems.emptyBody', { defaultValue: 'Los lugares, eventos y reportes que guardes aparecerán aquí.' })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}
