import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyReports } from '../../services/api';
import type { CommunityReport } from '../../types';
import { formatExpiry } from '../../utils/format';
import { useTheme } from '../../utils/theme';

export default function MyReportsModal() {
  const { colors, radii, shadows, typography } = useTheme();
  const router = useRouter();
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.shell, // Using darker background
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
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.display,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 16,
    },
    emptyIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `${colors.brand}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 15,
      color: colors.inkMuted,
      textAlign: 'center',
      lineHeight: 24,
      fontFamily: typography.body,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 14,
      backgroundColor: colors.brand,
      borderRadius: radii.md,
      marginTop: 8,
    },
    retryText: {
      color: '#FFF',
      fontWeight: '800',
      fontFamily: typography.heading,
      fontSize: 16,
    },
    listContent: {
      padding: 20,
      gap: 16, // using gap for spacing between items instead of marginBottom
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.stroke,
      ...shadows.soft,
    },
    itemIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    itemContent: {
      flex: 1,
    },
    itemType: {
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    itemTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 8,
      fontFamily: typography.heading,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statText: {
      fontSize: 13,
      color: colors.inkMuted,
      fontWeight: '600',
    },
    timeAgo: {
      fontSize: 12,
      color: colors.inkMuted,
      marginLeft: 'auto', // Pushes it to the right
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${colors.danger}20`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      gap: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
    liveText: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.danger,
      letterSpacing: 0.5,
    },
  }), [colors, radii, shadows, typography]);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getMyReports();
      setReports(data);
    } catch (err) {
      setError('No se pudieron cargar tus reportes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => fetchReports(true), []);

  function renderItem({ item }: { item: CommunityReport }) {
    const isExpired = new Date(item.expires_at).getTime() < Date.now();
    const expiry = isExpired ? 'Expirado' : formatExpiry(item.expires_at);

    const iconBg = isExpired ? colors.chip : `${colors.warning}20`;
    const iconColor = isExpired ? colors.inkMuted : colors.warning;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => router.push({ pathname: '/(modals)/report-details', params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>
          <Ionicons name="megaphone" size={24} color={iconColor} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.typeRow}>
            <Text style={[styles.itemType, { color: isExpired ? colors.inkMuted : colors.warning }]}>
              {item.report_type.replace(/_/g, ' ').toUpperCase()}
            </Text>
            {!isExpired && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>EN VIVO</Text>
              </View>
            )}
          </View>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.statText}>{item.confirmations}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="close-circle" size={14} color={colors.danger} />
              <Text style={styles.statText}>{item.denials}</Text>
            </View>
            <Text style={[styles.timeAgo, isExpired && { color: colors.inkMuted }]}>{expiry}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.stroke} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis Reportes</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={56} color={colors.stroke} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchReports()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="megaphone-outline" size={48} color={colors.brandDeep} />
          </View>
          <Text style={styles.emptyTitle}>Aún no has enviado reportes</Text>
          <Text style={styles.emptyText}>
            Informa a la comunidad sobre eventos, incidencias o lugares de interés cerca de ti
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

