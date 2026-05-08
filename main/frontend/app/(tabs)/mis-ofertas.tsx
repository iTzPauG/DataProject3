/**
 * Mis Ofertas — tab visible only for restaurant accounts.
 * Shows published deals with reservation info and management actions.
 * Real-time notifications via WebSocket when a customer reserves.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
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
import { useLiveDeals, type ReservationEvent } from '../../hooks/useLiveDeals';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';

interface DealWithReservation {
  id: string;
  restaurant_name: string;
  price: number;
  original_price?: number | null;
  seats: number;
  description?: string | null;
  is_active: number | boolean;
  created_at?: string;
  expires_at?: string | null;
  reservation?: {
    id: string;
    customer_name: string;
    customer_phone: string;
    status: string;
    created_at: string;
  } | null;
  // local state: newly reserved (for green flash)
  justReserved?: boolean;
}

function normalizeDeal(raw: any): DealWithReservation {
  return {
    id: String(raw.id),
    restaurant_name: String(raw.restaurant_name ?? 'Restaurante'),
    price: Number(raw.price ?? 0),
    original_price: raw.original_price == null ? null : Number(raw.original_price),
    seats: Number(raw.seats ?? 0),
    description: raw.description ?? null,
    is_active: raw.is_active,
    created_at: raw.created_at ?? undefined,
    expires_at: raw.expires_at ?? null,
    reservation: raw.reservation
      ? {
          id: String(raw.reservation.id),
          customer_name: String(raw.reservation.customer_name ?? ''),
          customer_phone: String(raw.reservation.customer_phone ?? ''),
          status: String(raw.reservation.status ?? ''),
          created_at: String(raw.reservation.created_at ?? ''),
        }
      : null,
  };
}

export default function MisOfertasTab() {
  const { colors, typography, shadows } = useTheme();
  const { profile, getToken } = useAuth();
  const [deals, setDeals] = useState<DealWithReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  const handleReservation = useCallback(
    (event: ReservationEvent) => {
      // Mark the deal as just reserved in real-time
      setDeals((prev) =>
        prev.map((d) =>
          d.id === event.deal_id
            ? { ...d, reservation: event.reservation as any, justReserved: true }
            : d,
        ),
      );
      showToast(`🎉 Nueva reserva: ${event.reservation.customer_name}`);
    },
    [showToast],
  );

  // WebSocket connection (for reservation notifications)
  const { connected } = useLiveDeals({
    enabled: profile?.role === 'business',
    ownerUid: profile?.firebase_uid ?? null,
    onReservation: handleReservation,
  });

  const fetchDeals = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/deals?owner=me`, {
        headers: { Authorization: `Bearer ${token ?? 'local-token'}` },
      });
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(errorBody || 'No se pudieron cargar tus ofertas');
      }
      const data = await res.json();
      const normalized = Array.isArray(data.deals) ? data.deals.map(normalizeDeal) : [];
      setDeals(normalized);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar tus ofertas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, getToken]);

  useEffect(() => {
    void fetchDeals();
  }, [fetchDeals]);

  const handleWithdraw = useCallback(
    async (dealId: string) => {
      Alert.alert('Retirar oferta', '¿Seguro que quieres retirar este anuncio?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${BASE_URL}/deals/${dealId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token ?? 'local-token'}` },
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.detail || 'No se pudo retirar la oferta');
              }
              setDeals((prev) => prev.filter((d) => d.id !== dealId));
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'No se pudo retirar la oferta.');
            }
          },
        },
      ]);
    },
    [getToken],
  );

  const handleNoShow = useCallback(
    async (dealId: string) => {
      Alert.alert('Denunciar no presentación', '¿El cliente no se ha presentado?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              await fetch(`${BASE_URL}/deals/${dealId}/reservation`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token ?? 'local-token'}`,
                },
                body: JSON.stringify({ status: 'no_show' }),
              });
              setDeals((prev) =>
                prev.map((d) =>
                  d.id === dealId
                    ? { ...d, reservation: d.reservation ? { ...d.reservation, status: 'no_show' } : null }
                    : d,
                ),
              );
            } catch {
              Alert.alert('Error', 'No se pudo actualizar la reserva.');
            }
          },
        },
      ]);
    },
    [getToken],
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
        statusDot: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: connected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        statusDotCircle: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: connected ? '#22C55E' : '#EF4444',
        },
        statusDotText: {
          fontSize: 10,
          fontWeight: '700',
          color: connected ? '#22C55E' : '#EF4444',
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
        card: {
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          overflow: 'hidden',
        },
        cardReserved: {
          borderColor: '#22C55E',
        },
        cardActive: {
          borderColor: colors.stroke,
        },
        cardInactive: {
          borderColor: colors.stroke,
          opacity: 0.6,
        },
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
        reservedBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(34,197,94,0.15)',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          gap: 4,
        },
        reservedText: {
          fontSize: 11,
          fontWeight: '700',
          color: '#22C55E',
        },
        expandedContent: {
          paddingHorizontal: 14,
          paddingBottom: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          paddingTop: 12,
          gap: 8,
        },
        clientRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(34,197,94,0.08)',
          borderRadius: 10,
          padding: 10,
        },
        clientLabel: {
          fontSize: 11,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        clientValue: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.ink,
          fontFamily: typography.body,
        },
        actionRow: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 4,
        },
        actionBtn: {
          flex: 1,
          height: 38,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
        },
        withdrawBtn: {
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239,68,68,0.08)',
        },
        noShowBtn: {
          borderColor: colors.stroke,
          backgroundColor: colors.shell,
        },
        withdrawText: {
          color: '#EF4444',
          fontSize: 12,
          fontWeight: '700',
          fontFamily: typography.body,
        },
        noShowText: {
          color: colors.ink,
          fontSize: 12,
          fontWeight: '600',
          fontFamily: typography.body,
        },
        noShowStatus: {
          fontSize: 12,
          color: '#EF4444',
          fontFamily: typography.body,
          fontStyle: 'italic',
        },
        // Toast
        toast: {
          position: 'absolute',
          top: Platform.OS === 'ios' ? 60 : 20,
          left: 20,
          right: 20,
          backgroundColor: '#22C55E',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
          zIndex: 100,
          ...shadows.lift,
        },
        toastText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '700',
          fontFamily: typography.body,
        },
      }),
    [colors, typography, shadows, connected],
  );

  if (profile?.role !== 'business') {
    return (
      <AnimatedTabScene>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyTitle}>Acceso restringido</Text>
            <Text style={styles.emptySubtitle}>
              Esta sección es solo para cuentas de restaurante verificadas.
            </Text>
          </View>
        </SafeAreaView>
      </AnimatedTabScene>
    );
  }

  const renderDeal = ({ item }: { item: DealWithReservation }) => {
    const isReserved = item.reservation?.status === 'confirmed';
    const isNoShow = item.reservation?.status === 'no_show';
    const isActive = Boolean(item.is_active);
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isReserved ? styles.cardReserved : isActive ? styles.cardActive : styles.cardInactive,
        ]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardEmoji}>{isReserved ? '✅' : isActive ? '🔥' : '⏸️'}</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>
              {item.price.toFixed(2)} €{item.original_price ? ` (antes ${item.original_price.toFixed(2)} €)` : ''} · {item.seats} {item.seats === 1 ? 'persona' : 'personas'}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.description ?? 'Sin descripción'}
            </Text>
          </View>
          {isReserved && (
            <View style={styles.reservedBadge}>
              <Text style={{ fontSize: 10 }}>●</Text>
              <Text style={styles.reservedText}>Reservada</Text>
            </View>
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {isReserved && item.reservation && (
              <View style={styles.clientRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientLabel}>Cliente</Text>
                  <Text style={styles.clientValue}>{item.reservation.customer_name}</Text>
                  <Text style={styles.clientLabel}>Teléfono</Text>
                  <Text style={styles.clientValue}>{item.reservation.customer_phone}</Text>
                </View>
              </View>
            )}

            {isNoShow && (
              <Text style={styles.noShowStatus}>⚠️ Cliente no presentado</Text>
            )}

            <View style={styles.actionRow}>
              {!isReserved && isActive && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.withdrawBtn]}
                  onPress={() => handleWithdraw(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.withdrawText}>Retirar oferta</Text>
                </TouchableOpacity>
              )}
              {isReserved && !isNoShow && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.noShowBtn]}
                  onPress={() => handleNoShow(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.noShowText}>⚠️ No presentado</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <AnimatedTabScene>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Mis Ofertas</Text>
          <View style={styles.statusDot}>
            <View style={styles.statusDotCircle} />
            <Text style={styles.statusDotText}>LIVE</Text>
          </View>
        </View>

        {loading && deals.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : deals.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.empty}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchDeals(); }} />}
          >
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Sin ofertas publicadas</Text>
            <Text style={styles.emptySubtitle}>
              Ve a la pestaña Publicar para crear tu primera oferta de última hora.
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={deals}
            keyExtractor={(item) => item.id}
            renderItem={renderDeal}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); void fetchDeals(); }}
              />
            }
          />
        )}

        {/* Toast notification */}
        {toast && (
          <Animated.View
            style={[
              styles.toast,
              { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
            ]}
          >
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </SafeAreaView>
    </AnimatedTabScene>
  );
}
