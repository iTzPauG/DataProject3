/**
 * Mis Ofertas — tab visible only for restaurant accounts.
 * Shows published deals with reservation info and management actions.
 * Real-time notifications via WebSocket when a customer reserves.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useAuth } from '../../hooks/useAuth';
import { BASE_URL } from '../../services/api';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firebaseConfigured, firestoreDb } from '../../services/firebase';
import { useTheme } from '../../utils/theme';

interface DealWithReservation {
  id: string;
  restaurant_name: string;
  price: number;
  original_price?: number | null;
  seats: number;
  description?: string | null;
  is_active: number | boolean;
  available_at?: string | null;
  created_at?: string;
  expires_at?: string | null;
  reservation_deadline_at?: string | null;
  cancelled_at?: string | null;
  not_presented_at?: string | null;
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

type ReasonAction = 'withdraw' | 'no_show';
type DealFilter = 'all' | 'active' | 'reserved' | 'cancelled' | 'no_show' | 'finalized';

function formatDealDate(value?: string | null): string {
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

function formatDealWindow(start?: string | null, end?: string | null): string {
  const from = formatDealDate(start);
  const to = formatDealDate(end);
  return `${from} -> ${to}`;
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
    available_at: raw.available_at ?? null,
    created_at: raw.created_at ?? undefined,
    expires_at: raw.expires_at ?? null,
    reservation_deadline_at: raw.reservation_deadline_at ?? null,
    cancelled_at: raw.cancelled_at ?? null,
    not_presented_at: raw.not_presented_at ?? null,
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
  const { t } = useTranslation();
  const { colors, typography, shadows } = useTheme();
  const { profile, getToken } = useAuth();
  const [deals, setDeals] = useState<DealWithReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonDealId, setReasonDealId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonSubmitting, setReasonSubmitting] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DealFilter>('all');
  const previousReservationsRef = useRef<Record<string, string | null>>({});
  const reservationsPrimedRef = useRef(false);
  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string) => {
    setToast(message);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

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

      const previous = previousReservationsRef.current;
      const current: Record<string, string | null> = {};
      for (const deal of normalized) {
        const status = deal.reservation?.status ?? null;
        current[deal.id] = status;
        if (
          reservationsPrimedRef.current &&
          previous[deal.id] !== 'confirmed' &&
          status === 'confirmed' &&
          deal.reservation?.customer_name
        ) {
          showToast(`🎉 Nueva reserva: ${deal.reservation.customer_name}`);
        }
      }
      reservationsPrimedRef.current = true;
      previousReservationsRef.current = current;

      setDeals(normalized);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar tus ofertas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, getToken, showToast]);

  useEffect(() => {
    if (profile?.role !== 'business' || !profile.firebase_uid) return;
    if (!firebaseConfigured || !firestoreDb) return;

    const dealsQuery = query(
      collection(firestoreDb, 'deals'),
      where('owner_uid', '==', profile.firebase_uid),
    );

    setConnected(true);
    const unsubscribe = onSnapshot(
      dealsQuery,
      () => {
        // Firestore acts as realtime trigger; data source remains API to avoid race/inconsistent shapes.
        void fetchDeals();
      },
      () => {
        setConnected(false);
      },
    );

    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, [profile?.role, profile?.firebase_uid, fetchDeals]);

  useEffect(() => {
    void fetchDeals();
  }, [fetchDeals]);

  const openReasonModal = useCallback((dealId: string, action: ReasonAction) => {
    setReasonDealId(dealId);
    setReasonAction(action);
    setReasonText('');
    setReasonError(null);
    setReasonModalOpen(true);
  }, []);

  const closeReasonModal = useCallback(() => {
    if (reasonSubmitting) return;
    setReasonModalOpen(false);
    setReasonAction(null);
    setReasonDealId(null);
    setReasonText('');
    setReasonError(null);
  }, [reasonSubmitting]);

  const submitReasonAction = useCallback(async () => {
    if (!reasonAction || !reasonDealId) return;
    const reason = reasonText.trim();
    if (!reason) {
      setReasonError('El comentario es necesario para cancelar o presentar una reclamacion de no presentado.');
      return;
    }

    setReasonError(null);
    setReasonSubmitting(true);
    try {
      const token = await getToken();
      if (reasonAction === 'withdraw') {
        const res = await fetch(`${BASE_URL}/deals/${reasonDealId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? 'local-token'}`,
          },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || 'No se pudo retirar la oferta');
        }
      } else {
        const res = await fetch(`${BASE_URL}/deals/${reasonDealId}/reservation`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? 'local-token'}`,
          },
          body: JSON.stringify({ status: reasonAction, reason }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || 'No se pudo actualizar la reserva');
        }
      }

      setDeals((prev) => prev.map((d) => d.id === reasonDealId ? { ...d, cancelled_at: reasonAction === 'withdraw' ? new Date().toISOString() : d.cancelled_at, not_presented_at: reasonAction === 'no_show' ? new Date().toISOString() : d.not_presented_at } : d));
      closeReasonModal();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo completar la acción.');
    } finally {
      setReasonSubmitting(false);
    }
  }, [getToken, reasonAction, reasonDealId, reasonText]);

  const filteredDeals = useMemo(() => {
    const nowMs = Date.now();
    const isFinalized = (deal: DealWithReservation) => {
      if (!deal.expires_at) return false;
      const expiresMs = Date.parse(deal.expires_at);
      return Number.isFinite(expiresMs) && expiresMs < nowMs;
    };

    return deals.filter((deal) => {
      const cancelled = Boolean(deal.cancelled_at);
      const notPresented = Boolean(deal.not_presented_at);
      const reserved = deal.reservation?.status === 'confirmed';
      const active = Boolean(deal.is_active);
      const finalized = isFinalized(deal);

      switch (activeFilter) {
        case 'active':
          return active && !reserved && !cancelled && !notPresented && !finalized;
        case 'reserved':
          return reserved && !cancelled && !notPresented && !finalized;
        case 'cancelled':
          return cancelled;
        case 'no_show':
          return notPresented;
        case 'finalized':
          return finalized && !cancelled && !notPresented;
        case 'all':
        default:
          return true;
      }
    });
  }, [activeFilter, deals]);

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
        filterRow: {
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          gap: 8,
        },
        filterScrollContent: {
          paddingRight: 16,
          gap: 8,
        },
        filterBtn: {
          height: 34,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        filterBtnActive: {
          borderColor: colors.brand,
          backgroundColor: 'rgba(34,197,94,0.14)',
        },
        filterText: {
          color: colors.ink,
          fontSize: 12,
          fontWeight: '600',
          fontFamily: typography.body,
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
        cardCancelled: {
          borderColor: '#EF4444',
          opacity: 0.5,
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
        cardDate: {
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
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        },
        modalCard: {
          width: '100%',
          maxWidth: 460,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.stroke,
          padding: 16,
          gap: 10,
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        modalSubtitle: {
          fontSize: 13,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        reasonInput: {
          minHeight: 100,
          borderWidth: 1,
          borderColor: colors.stroke,
          borderRadius: 12,
          backgroundColor: colors.shell,
          color: colors.ink,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontFamily: typography.body,
          fontSize: 14,
        },
        modalActions: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 4,
        },
        reasonError: {
          marginTop: -2,
          color: '#EF4444',
          fontSize: 12,
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
            <Text style={styles.emptyTitle}>{t('myOffers.accessRestricted')}</Text>
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
    const isCancelled = Boolean(item.cancelled_at);
    const isNotPresented = Boolean(item.not_presented_at);
    const isActive = Boolean(item.is_active);
    const isFinalized = Boolean(item.expires_at) && (Date.parse(item.expires_at || '') || 0) < Date.now();
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isCancelled || isNotPresented ? styles.cardCancelled : isReserved ? styles.cardReserved : isActive && !isFinalized ? styles.cardActive : styles.cardInactive,
        ]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardEmoji}>{isCancelled || isNotPresented ? '❌' : isFinalized ? '🕓' : isReserved ? '✅' : isActive ? '🔥' : '⏸️'}</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>
              {item.price.toFixed(2)} €{item.original_price ? ` (antes ${item.original_price.toFixed(2)} €)` : ''} · {item.seats} {item.seats === 1 ? 'persona' : 'personas'}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.description ?? 'Sin descripción'}
            </Text>
            <Text style={styles.cardDate}>
              Franja: {formatDealWindow(item.available_at, item.expires_at)}
            </Text>
            {item.reservation_deadline_at ? (
              <Text style={styles.cardDate}>
                Reserva hasta: {formatDealDate(item.reservation_deadline_at)}
              </Text>
            ) : null}
          </View>
          {isReserved && (
            <View style={styles.reservedBadge}>
              <Text style={{ fontSize: 10 }}>●</Text>
              <Text style={styles.reservedText}>{t('myOffers.reserved')}</Text>
            </View>
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {isReserved && item.reservation && (
              <View style={styles.clientRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientLabel}>{t('myOffers.client')}</Text>
                  <Text style={styles.clientValue}>{item.reservation.customer_name}</Text>
                  <Text style={styles.clientLabel}>{t('common.phone')}</Text>
                  <Text style={styles.clientValue}>{item.reservation.customer_phone}</Text>
                </View>
              </View>
            )}

            {isNoShow && (
              <Text style={styles.noShowStatus}>⚠️ Cliente no presentado</Text>
            )}

            {isCancelled && (
              <Text style={styles.noShowStatus}>❌ Oferta cancelada</Text>
            )}

            {isNotPresented && !isCancelled && (
              <Text style={styles.noShowStatus}>❌ No presentado</Text>
            )}

            {isFinalized && !isCancelled && !isNotPresented && (
              <Text style={styles.noShowStatus}>🕓 Oferta finalizada</Text>
            )}

            <View style={styles.actionRow}>
              {!isReserved && isActive && !isCancelled && !isFinalized && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.withdrawBtn]}
                  onPress={() => openReasonModal(item.id, 'withdraw')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.withdrawText}>{t('myOffers.withdrawOffer')}</Text>
                </TouchableOpacity>
              )}
              {isReserved && !isNoShow && !isCancelled && !isNotPresented && !isFinalized && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.noShowBtn]}
                  onPress={() => openReasonModal(item.id, 'no_show')}
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

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {(['all', 'active', 'reserved', 'cancelled', 'no_show', 'finalized'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterBtn, activeFilter === key ? styles.filterBtnActive : null]}
                onPress={() => setActiveFilter(key as DealFilter)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterText}>{t(`myOffers.filters.${key}`)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading && filteredDeals.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : filteredDeals.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.empty}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchDeals(); }} />}
          >
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>{t('myOffers.noOffersFiltered')}</Text>
            <Text style={styles.emptySubtitle}>
              Ve a la pestaña Publicar para crear tu primera oferta de última hora.
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={filteredDeals}
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

        <Modal
          visible={reasonModalOpen}
          animationType="fade"
          transparent
          onRequestClose={closeReasonModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {reasonAction === 'no_show'
                  ? 'Motivo de no presentado'
                  : 'Motivo de retirada'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Este comentario se guarda en la base de datos.
              </Text>
              <TextInput
                value={reasonText}
                onChangeText={(value) => {
                  setReasonText(value);
                  if (reasonError) setReasonError(null);
                }}
                style={styles.reasonInput}
                placeholder={t('myOffers.reasonPlaceholder')}
                placeholderTextColor={colors.inkMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!reasonSubmitting}
              />
              {reasonError ? (
                <Text style={styles.reasonError}>{reasonError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.noShowBtn]}
                  onPress={closeReasonModal}
                  disabled={reasonSubmitting}
                >
                  <Text style={styles.noShowText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.withdrawBtn]}
                  onPress={() => { void submitReasonAction(); }}
                  disabled={reasonSubmitting}
                >
                  <Text style={styles.withdrawText}>{reasonSubmitting ? 'Guardando...' : 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}
