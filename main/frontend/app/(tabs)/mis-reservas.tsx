/**
 * Mis Reservas — tab visible only for customer (non-business) accounts.
 * Shows the user's own reservations. Toggle button switches between
 * "Actuales" (confirmed) and "Historial" (past/cancelled).
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Reservation {
  id: string;
  deal_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  status_reason: string | null;
  created_at: string | null;
  restaurant_name: string | null;
  price: number | null;
  original_price: number | null;
  available_at: string | null;
  expires_at: string | null;
  description: string | null;
  cuisine: string | null;
}

type Tab = 'current' | 'history';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function normalizeReservation(raw: any): Reservation {
  return {
    id: String(raw.id ?? ''),
    deal_id: raw.deal_id != null ? String(raw.deal_id) : null,
    customer_name: String(raw.customer_name ?? ''),
    customer_phone: raw.customer_phone != null ? String(raw.customer_phone) : null,
    status: String(raw.status ?? 'confirmed'),
    status_reason: raw.status_reason != null ? String(raw.status_reason) : null,
    created_at: raw.created_at != null ? String(raw.created_at) : null,
    restaurant_name: raw.restaurant_name != null ? String(raw.restaurant_name) : null,
    price: raw.price != null ? Number(raw.price) : null,
    original_price: raw.original_price != null ? Number(raw.original_price) : null,
    available_at: raw.available_at != null ? String(raw.available_at) : null,
    expires_at: raw.expires_at != null ? String(raw.expires_at) : null,
    description: raw.description != null ? String(raw.description) : null,
    cuisine: raw.cuisine != null ? String(raw.cuisine) : null,
  };
}

function isCurrent(r: Reservation): boolean {
  return r.status === 'confirmed';
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'confirmed': return '✅';
    case 'cancelled': return '❌';
    case 'no_show':   return '⚠️';
    default:          return '📋';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Confirmada';
    case 'cancelled': return 'Cancelada';
    case 'no_show':   return 'No presentado';
    default:          return status;
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MisReservasTab() {
  const { colors, typography, shadows } = useTheme();
  const { profile, getToken } = useAuth();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('current');

  const fetchReservations = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/deals/my-reservations`, {
        headers: { Authorization: `Bearer ${token ?? 'local-token'}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Error al cargar tus reservas');
      }
      const data = await res.json();
      const normalized = Array.isArray(data.reservations)
        ? data.reservations.map(normalizeReservation)
        : [];
      setReservations(normalized);
    } catch (e: any) {
      // non-blocking: list stays empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, getToken]);

  useFocusEffect(
    useCallback(() => {
      void fetchReservations();
    }, [fetchReservations]),
  );

  const displayed = useMemo(
    () => reservations.filter(r => activeTab === 'current' ? isCurrent(r) : !isCurrent(r)),
    [reservations, activeTab],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.shell },
        header: {
          paddingHorizontal: 22,
          paddingTop: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        title: {
          fontSize: 26,
          fontWeight: '800',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        toggleBtn: {
          height: 34,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        toggleText: {
          color: colors.ink,
          fontSize: 12,
          fontWeight: '600',
          fontFamily: typography.body,
        },
        card: {
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          overflow: 'hidden',
        },
        cardConfirmed: { borderColor: '#22C55E' },
        cardCancelled: { borderColor: '#EF4444', opacity: 0.6 },
        cardNoShow:    { borderColor: '#F59E0B', opacity: 0.7 },
        cardDefault:   { borderColor: colors.stroke },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          gap: 10,
        },
        cardEmoji: { fontSize: 24 },
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
        confirmedBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(34,197,94,0.15)',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          gap: 4,
        },
        confirmedBadgeText: {
          fontSize: 11,
          fontWeight: '700',
          color: '#22C55E',
        },
        reasonRow: {
          paddingHorizontal: 14,
          paddingBottom: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          paddingTop: 10,
        },
        reasonLabel: {
          fontSize: 11,
          color: colors.inkMuted,
          fontFamily: typography.body,
          fontStyle: 'italic',
        },
        empty: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          paddingTop: 60,
        },
        emptyEmoji: { fontSize: 48, marginBottom: 12 },
        emptyTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.ink,
          fontFamily: typography.heading,
          textAlign: 'center',
        },
        emptySubtitle: {
          marginTop: 6,
          fontSize: 14,
          color: colors.inkMuted,
          fontFamily: typography.body,
          textAlign: 'center',
          lineHeight: 20,
        },
      }),
    [colors, typography, shadows],
  );

  const renderItem = ({ item }: { item: Reservation }) => {
    const cardStyle =
      item.status === 'confirmed' ? styles.cardConfirmed
      : item.status === 'cancelled' ? styles.cardCancelled
      : item.status === 'no_show'   ? styles.cardNoShow
      : styles.cardDefault;

    return (
      <View style={[styles.card, cardStyle]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardEmoji}>{statusEmoji(item.status)}</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.restaurant_name ?? 'Restaurante'}
              {item.price != null ? ` · ${item.price.toFixed(2)} €` : ''}
            </Text>
            {!!item.description && (
              <Text style={styles.cardMeta} numberOfLines={1}>{item.description}</Text>
            )}
            {(item.available_at || item.expires_at) && (
              <Text style={styles.cardMeta}>{formatDateOnly(item.available_at)}, {formatTime(item.available_at)} → {formatTime(item.expires_at)}</Text>
            )}
          </View>
          {item.status === 'confirmed' && (
            <View style={styles.confirmedBadge}>
              <Text style={{ fontSize: 10 }}>●</Text>
              <Text style={styles.confirmedBadgeText}>{statusLabel(item.status)}</Text>
            </View>
          )}
        </View>
        {!!item.status_reason && (
          <View style={styles.reasonRow}>
            <Text style={styles.reasonLabel}>Motivo: {item.status_reason}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <AnimatedTabScene>
      <SafeAreaView style={styles.safe} edges={['top']}>

        <View style={styles.header}>
          <Text style={styles.title}>Mis Reservas</Text>
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setActiveTab(t => t === 'current' ? 'history' : 'current')}
            activeOpacity={0.8}
          >
            <Text style={styles.toggleText}>
              {activeTab === 'current' ? 'Actuales' : 'Historial'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading && displayed.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : displayed.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.empty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); void fetchReservations(); }}
                tintColor={colors.ink}
              />
            }
          >
            <Text style={styles.emptyEmoji}>
              {activeTab === 'current' ? '🎟️' : '📋'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'current' ? 'Sin reservas activas' : 'Sin historial'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'current'
                ? 'Reserva una oferta desde el mapa para verla aquí.'
                : 'Tus reservas pasadas aparecerán aquí.'}
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
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
