import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBookmarks } from '../../services/api';
import type { SavedItem } from '../../types';
import { useTheme } from '../../utils/theme';

const ITEM_TYPE_CONFIG: Record<SavedItem['item_type'], { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  place: { icon: 'location', color: '#FF6B35', label: 'Lugar' },
  event: { icon: 'calendar', color: '#8B5CF6', label: 'Evento' },
  report: { icon: 'megaphone', color: '#F59E0B', label: 'Reporte' },
};

export default function SavedItemsModal() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => StyleSheet.create({
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    closeIcon: {
      fontSize: 14,
      color: colors.ink,
      lineHeight: 18,
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
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
      }),
    },
    itemIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    itemContent: {
      flex: 1,
    },
    itemType: {
      fontSize: 10,
      fontWeight: '800',
      marginBottom: 4,
      letterSpacing: 0.5,
      fontFamily: typography.heading,
    },
    itemId: {
      fontSize: 13,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
  }), [colors, typography]);

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

  const renderItem = ({ item }: { item: SavedItem }) => {
    const config = ITEM_TYPE_CONFIG[item.item_type] ?? { icon: 'bookmark', color: '#999', label: item.item_type };
    return (
      <TouchableOpacity style={styles.itemCard} accessibilityRole="button" accessibilityLabel={`${config.label} guardado`}>
        <View style={[styles.itemIcon, { backgroundColor: config.color + '22' }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemType, { color: config.color }]}>{config.label.toUpperCase()}</Text>
          <Text style={styles.itemId} numberOfLines={1}>{item.item_id}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Ionicons name="close" size={16} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Guardados</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>Error</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBookmarks} accessibilityRole="button" accessibilityLabel="Reintentar">
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>Sin guardados</Text>
          <Text style={styles.emptyText}>Los lugares, eventos y reportes que guardes aparecerán aquí.</Text>
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
