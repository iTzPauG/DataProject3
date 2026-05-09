/**
 * Mis Reservas — tab visible only for regular (non-business) accounts.
 * Shows reservations made by the user via flash deals.
 * Default: upcoming reservations. Filter toggle shows history.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useAuth } from '../../hooks/useAuth';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';

interface MyReservation {
  id: string;
  deal_id: string;
  status: string;
  status_reason?: string | null;
  created_at: string;
  restaurant_name: string;
  price: number;
  original_price?: number | null;
  seats: number;
  description?: string | null;
  available_at?: string | null;
  expires_at?: string | null;
  reservation_deadline_at?: string | null;
  restaurant_cuisines?: string[];
  cancelled_at?: string | null;
  not_presented_at?: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatWindow(start?: string | null, end?: string | null): string {
  return `${formatDate(start)} → ${formatDate(end)}`;
}

function normalizeReservation(raw: any): MyReservation {
  return {
    id: String(raw.id ?? ''),
    deal_id: String(raw.deal_id ?? ''),
    status: String(raw.status ?? 'confirmed'),
    status_reason: raw.status_reason ?? null,
    created_at: raw.created_at ?? '',
    restaurant_name: String(raw.restaurant_name ?? 'Restaurante'),
    price: Number(raw.price ?? 0),
    original_price: raw.original_price == null ? null : Number(raw.original_price),
    seats: Number(raw.seats ?? 0),
    description: raw.description ?? null,
    available_at: raw.available_at ?? null,
    expires_at: raw.expires_at ?? null,
    reservation_deadline_at: raw.reservation_deadline_at ?? null,
    restaurant_cuisines: Array.isArray(raw.restaurant_cuisines) ? raw.restaurant_cuisines : [],
    cancelled_at: raw.cancelled_at ?? null,
    not_presented_at: raw.not_presented_at ?? null,
  };
}

function isUpcoming(r: MyReservation): boolean {
  const ref = r.expires_at || r.available_at;
  if (!ref) return true;
  const ms = Date.parse(ref);
  return !Number.isFinite(ms) || ms >= Date.now();
}

export default function MisReservasTab() {
  const { colors, typography, shadows } = useTheme();
  const { profile, getToken } = useAuth();
  const [reservations, setReservations] = useState<MyReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fetchedRef = useRef(false);

  const fetchReservations = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/deals/my-reservations`, {
        headers: { Authorization: `Bearer ${token ?? 'local-token'}` },
      });
      if (!res.ok) throw new Error('No se pudieron cargar tus reservas');
      const data = await res.json();
      const normalized = Array.isArray(data.reservations)
        ? data.reservations.map(normalizeReservation)
        : [];
      setReservations(normalized);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar tus reservas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, getToken]);

  useEffect(() => {
    if (!fetchedRef.current && profile?.role !== 'business') {
      fetchedRef.current = true;
      void fetchReservations();
    }
  }, [profile, fetchReservations]);

  const displayed = reservations.filter((r) =>
    showHistory ? !isUpcoming(r) : isUpcoming(r),
  );

  const styles = makeStyles(colors, typography, shadows);

  if (profile?.role === 'business') {
    return (
      <AnimatedTabScene>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyTitle}>Solo para usuarios</Text>
            <Text style={styles.emptySubtitle}>
              Las cuentas de restaurante no tienen reservas de cliente.
            </Text>
          </View>
        </SafeAreaView>
      </AnimatedTabScene>
    );
  }

  const renderItem = ({ item }: { item: MyReservation }) => {
    const isCancelled = item.status === 'cancelled' || Boolean(item.cancelled_at);
    const isNoShow = item.status === 'no_show' || Boolean(item.not_presented_at);
    const isConfirmed = !isCancelled && !isNoShow;

    let badgeColor = '#22C55E';
    let badgeLabel = 'Confirmada';
    if (isCancelled) { badgeColor = '#EF4444'; badgeLabel = 'Cancelada'; }
    else if (isNoShow) { badgeColor = '#F59E0B'; badgeLabel = 'No presentado'; }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.restaurant_name}
            </Text>
            <Text style={styles.cardMeta}>
              {item.price.toFixed(2)} €{item.original_price ? ` (antes ${item.original_price.toFixed(2)} €)` : ''} · {item.seats} {item.seats === 1 ? 'persona' : 'personas'}
            </Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}26` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>● {badgeLabel}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.cardDate}>
          Franja: {formatWindow(item.available_at, item.expires_at)}
        </Text>
        {item.reservation_deadline_at ? (
          <Text style={styles.cardDate}>
            Reserva hasta: {formatDate(item.reservation_deadline_at)}
          </Text>
        ) : null}
        <Text style={styles.cardDateSub}>
          Reservada el {formatDate(item.created_at)}
        </Text>

        {(isCancelled || isNoShow) && item.status_reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Motivo: </Text>
            <Text style={styles.reasonText}>{item.status_reason}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <AnimatedTabScene>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis Reservas</Text>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowHistory((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={styles.filterBtnText}>
              {showHistory ? 'Actuales' : 'Historial'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{showHistory ? '📂' : '🍽️'}</Text>
            <Text style={styles.emptyTitle}>
              {showHistory ? 'Sin historial' : 'Sin reservas próximas'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showHistory
                ? 'Aquí aparecerán tus reservas pasadas.'
                : 'Reserva una oferta flash y aparecerá aquí.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); void fetchReservations(); }}
                tintColor={colors.ink}
              />
            }
          />
        )}
      </SafeAreaView>
    </AnimatedTabScene>
  );
}

function makeStyles(colors: any, typography: any, shadows: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.canvas },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.stroke,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.stroke,
    },
    filterBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.body,
    },
    list: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.stroke,
      ...shadows.card,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginTop: 2,
    },
    cardDesc: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginTop: 2,
    },
    badge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.stroke,
      marginVertical: 10,
    },
    cardDate: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginTop: 2,
    },
    cardDateSub: {
      fontSize: 11,
      color: colors.inkFaint,
      fontFamily: typography.body,
      marginTop: 4,
    },
    reasonBox: {
      flexDirection: 'row',
      marginTop: 8,
      backgroundColor: colors.canvas,
      borderRadius: 8,
      padding: 8,
    },
    reasonLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    reasonText: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
      flex: 1,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyEmoji: { fontSize: 40, marginBottom: 16 },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
