/**
 * DealDetailSheet — bottom sheet shown when a user taps a deal pin on the map.
 * Shows: restaurant photo (placeholder), deal info, reviews, and a "Me interesa" CTA.
 * "Me interesa" opens an inline reservation form (name + phone).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { LiveDeal } from '../hooks/useLiveDeals';
import { useAuth } from '../hooks/useAuth';
import { BASE_URL } from '../services/api';
import { formatLocaleDate, formatLocaleDateTime, formatLocaleTime, formatExpiry } from '../utils/format';
import { useTheme } from '../utils/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

interface Props {
  deal: LiveDeal;
  onClose: () => void;
}

type SheetView = 'deal' | 'reserve' | 'confirmed';

export default function DealDetailSheet({ deal, onClose }: Props) {
  const { colors, typography, shadows } = useTheme();
  const { t, i18n } = useTranslation();
  const { profile, getToken } = useAuth();
  const [view, setView] = useState<SheetView>('deal');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isBusinessAccount = profile?.role === 'business';
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  const discount =
    deal.original_price && deal.original_price > deal.price
      ? Math.round(((deal.original_price - deal.price) / deal.original_price) * 100)
      : null;

  const expiresText = useMemo(() => {
    if (!deal.expires_at) return null;
    return formatExpiry(deal.expires_at, t);
  }, [deal.expires_at, t]);

  const scheduleText = useMemo(() => {
    if (!deal.available_at || !deal.expires_at) return null;
    const start = new Date(deal.available_at);
    const end = new Date(deal.expires_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const dateText = formatLocaleDate(start, i18n.language);
    const startText = formatLocaleTime(start, i18n.language);
    const endText = formatLocaleTime(end, i18n.language);
    return `${dateText} · ${startText} - ${endText}`;
  }, [deal.available_at, deal.expires_at, i18n.language]);

  const reservationDeadlineText = useMemo(() => {
    if (!deal.reservation_deadline_at) return null;
    const value = new Date(deal.reservation_deadline_at);
    if (Number.isNaN(value.getTime())) return null;
    return formatLocaleDateTime(value, i18n.language, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [deal.reservation_deadline_at, i18n.language]);

  const handleReserve = useCallback(async () => {
    if (!profile) {
      setLoginPromptOpen(true);
      return;
    }
    if (isBusinessAccount) {
      Alert.alert(t('dealSheet.unavailableTitle'), t('dealSheet.unavailableBody'));
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      Alert.alert(t('dealSheet.requiredTitle'), t('dealSheet.requiredBody'));
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/deals/${deal.id}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? 'local-token'}`,
        },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        Alert.alert(t('dealSheet.takenTitle'), data?.detail || t('dealSheet.takenBody'));
        return;
      }
      if (res.status === 401) {
        setLoginPromptOpen(true);
        return;
      }
      if (!res.ok) throw new Error(data.detail || t('dealSheet.reserveError'));
      setView('confirmed');
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('dealSheet.reserveError'));
    } finally {
      setSubmitting(false);
    }
  }, [deal.id, customerName, customerPhone, getToken, isBusinessAccount, profile, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: SHEET_HEIGHT,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          overflow: 'hidden',
          zIndex: 50,
        },
        blur: {
          flex: 1,
          backgroundColor: 'rgba(18, 20, 30, 0.92)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
        },
        handle: {
          alignSelf: 'center',
          marginTop: 12,
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.3)',
          marginBottom: 4,
        },
        closeBtn: {
          position: 'absolute',
          top: 16,
          right: 16,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        },
        closeTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
        scroll: { paddingHorizontal: 20, paddingBottom: 32 },
        dealBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(249,115,22,0.2)',
          borderWidth: 1,
          borderColor: '#F97316',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 14,
          gap: 10,
        },
        dealBadgeText: {
          flex: 1,
        },
        restaurantName: {
          fontSize: 18,
          fontWeight: '800',
          color: '#fff',
          fontFamily: typography.heading,
        },
        descriptionText: {
          fontSize: 13,
          color: 'rgba(255,255,255,0.65)',
          fontFamily: typography.body,
          marginTop: 2,
        },
        priceRow: {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 8,
          marginTop: 4,
        },
        price: {
          fontSize: 22,
          fontWeight: '800',
          color: '#F97316',
          fontFamily: typography.mono,
        },
        originalPrice: {
          fontSize: 14,
          color: 'rgba(255,255,255,0.4)',
          textDecorationLine: 'line-through',
          fontFamily: typography.mono,
        },
        discountBadge: {
          backgroundColor: '#22C55E',
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        discountText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
          fontFamily: typography.mono,
        },
        metaRow: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 6,
          flexWrap: 'wrap',
        },
        metaChip: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          gap: 4,
        },
        metaText: {
          color: 'rgba(255,255,255,0.7)',
          fontSize: 12,
          fontFamily: typography.body,
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          fontFamily: typography.body,
          marginTop: 18,
          marginBottom: 8,
        },
        ctaButton: {
          marginTop: 20,
          backgroundColor: '#F97316',
          borderRadius: 14,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ctaButtonDisabled: {
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
        },
        ctaText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '800',
          fontFamily: typography.heading,
        },
        ctaTextDisabled: {
          color: 'rgba(255,255,255,0.65)',
        },
        // Reservation form
        label: {
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          fontFamily: typography.body,
          marginTop: 14,
          marginBottom: 4,
        },
        input: {
          backgroundColor: 'rgba(255,255,255,0.07)',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: '#fff',
          fontFamily: typography.body,
        },
        // Confirmed screen
        confirmedContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
        },
        confirmedEmoji: { fontSize: 64, marginBottom: 16 },
        confirmedTitle: {
          fontSize: 26,
          fontWeight: '800',
          color: '#22C55E',
          fontFamily: typography.heading,
          textAlign: 'center',
        },
        confirmedBody: {
          marginTop: 10,
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          fontFamily: typography.body,
          lineHeight: 20,
        },
        returnBtn: {
          marginTop: 28,
          backgroundColor: '#22C55E',
          borderRadius: 14,
          height: 50,
          paddingHorizontal: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        returnText: {
          color: '#fff',
          fontWeight: '700',
          fontSize: 15,
          fontFamily: typography.heading,
        },
      }),
    [colors, typography],
  );

  const renderDealView = () => (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Deal badge */}
      <View style={styles.dealBadge}>
        <Text style={{ fontSize: 28 }}>🔥</Text>
        <View style={styles.dealBadgeText}>
          <Text style={styles.restaurantName}>{deal.restaurant_name}</Text>
          {deal.description ? (
            <Text style={styles.descriptionText} numberOfLines={2}>
              {deal.description}
            </Text>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{deal.price.toFixed(2)} €</Text>
            {deal.original_price ? (
              <Text style={styles.originalPrice}>{deal.original_price.toFixed(2)} €</Text>
            ) : null}
            {discount ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discount}%</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Meta chips */}
      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Text style={styles.metaText}>{t('dealSheet.seats', { count: deal.seats })}</Text>
        </View>
        {expiresText ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>⏱ {expiresText}</Text>
          </View>
        ) : null}
        {deal.available_at ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>
              🕐 {formatLocaleTime(deal.available_at, i18n.language)}
            </Text>
          </View>
        ) : null}
        {reservationDeadlineText ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{t('dealSheet.reserveUntil', { dateTime: reservationDeadlineText })}</Text>
          </View>
        ) : null}
      </View>

      {scheduleText ? (
        <Text style={[styles.descriptionText, { marginTop: 10 }]}>{t('dealSheet.timeWindow', { schedule: scheduleText })}</Text>
      ) : null}

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaButton, isBusinessAccount ? styles.ctaButtonDisabled : null]}
        onPress={() => {
          if (!profile) {
            setLoginPromptOpen(true);
            return;
          }
          if (isBusinessAccount) {
            Alert.alert(t('dealSheet.unavailableTitle'), t('dealSheet.unavailableBody'));
            return;
          }
          setView('reserve');
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.ctaText, isBusinessAccount ? styles.ctaTextDisabled : null]}>
          {isBusinessAccount ? t('dealSheet.unavailableForBusiness') : t('dealSheet.interestedCta')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderReserveView = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>{t('dealSheet.reserveTable')}</Text>
        <Text style={[styles.descriptionText, { marginBottom: 4 }]}>
          {deal.restaurant_name} — {deal.price.toFixed(2)} €
        </Text>

        <Text style={styles.label}>{t('dealSheet.yourName')}</Text>
        <TextInput
          style={styles.input}
          value={customerName}
          onChangeText={setCustomerName}
          placeholder={t('dealSheet.fullNamePlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="words"
        />

        <Text style={styles.label}>{t('dealSheet.contactPhone')}</Text>
        <TextInput
          style={styles.input}
          value={customerPhone}
          onChangeText={setCustomerPhone}
          placeholder={t('dealSheet.phonePlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={[styles.ctaButton, { marginTop: 24 }]}
          onPress={handleReserve}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{t('dealSheet.confirmReservation')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setView('deal')}
          style={{ alignItems: 'center', marginTop: 14 }}
          activeOpacity={0.7}
        >
          <Text style={[styles.descriptionText, { textAlign: 'center' }]}>{t('dealSheet.backToDeal')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderConfirmedView = () => (
    <View style={styles.confirmedContainer}>
      <Text style={styles.confirmedEmoji}>✅</Text>
      <Text style={styles.confirmedTitle}>{t('dealSheet.confirmedTitle')}</Text>
      <Text style={styles.confirmedBody}>
        {t('dealSheet.confirmedBody', { restaurantName: deal.restaurant_name })}
      </Text>
      <TouchableOpacity style={styles.returnBtn} onPress={onClose} activeOpacity={0.85}>
        <Text style={styles.returnText}>{t('dealSheet.returnToMap')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoginPrompt = () => (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 100,
      }}
    >
      <View style={{ width: '100%', maxWidth: 360, borderRadius: 16, backgroundColor: '#181A23', padding: 18, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: typography.heading }}>
          {t('dealSheet.signInTitle')}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20, fontFamily: typography.body }}>
          {t('dealSheet.signInBody')}
        </Text>
        <TouchableOpacity
          style={[styles.ctaButton, { marginTop: 8 }]}
          onPress={() => {
            setLoginPromptOpen(false);
            router.push('/(modals)/login');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{t('dealSheet.goToSignIn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaButton, styles.ctaButtonDisabled]}
          onPress={() => setLoginPromptOpen(false)}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, styles.ctaTextDisabled]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <View style={styles.handle} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        {view === 'deal' && renderDealView()}
        {view === 'reserve' && renderReserveView()}
        {view === 'confirmed' && renderConfirmedView()}
        {loginPromptOpen && renderLoginPrompt()}
      </BlurView>
    </View>
  );
}
