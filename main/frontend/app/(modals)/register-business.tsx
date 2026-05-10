import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';

type Step = 'form' | 'verifying' | 'otp' | 'email_fallback' | 'done';

const CUISINE_OPTIONS = [
  'Mediterránea',
  'Española',
  'Tapas',
  'Paella',
  'Italiana',
  'Japonesa',
  'China',
  'India',
  'Mexicana',
  'Vegetariana',
  'Vegana',
  'Marisco',
  'Parrilla',
  'Fusión',
  'Internacional',
];

export default function RegisterBusinessModal() {
  const { colors, typography } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { getToken, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [cuisineDropdownOpen, setCuisineDropdownOpen] = useState(false);

  // Verification result
  const [placeData, setPlaceData] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [corpEmail, setCorpEmail] = useState('');

  async function authFetch(path: string, body: object) {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || t('businessRegistration.serverError'));
    return data;
  }

  async function handleVerify() {
    if (!name || !address || !phone) {
      setError(t('businessRegistration.fillRequired'));
      return;
    }
    setError(null);
    setLoading(true);
    setStep('verifying');
    try {
      const data = await authFetch('/auth/register-business/verify', {
        restaurant_name: name,
        restaurant_address: address,
        restaurant_phone: phone,
        google_maps_url: mapsUrl || null,
      });
      setPlaceData(data);
      if (data.phone_match) {
        // Phone matches → send OTP via Firebase Phone Auth
        setStep('otp');
      } else {
        // Phone doesn't match → offer corporate email fallback
        setStep('email_fallback');
      }
    } catch (e: any) {
      setError(e.message);
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!placeData) return;
    if (selectedCuisines.length === 0) {
      setError(t('businessRegistration.pickCuisine'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authFetch('/auth/register-business/complete', {
        place_id: placeData.place_id,
        restaurant_name: placeData.name || name,
        restaurant_address: placeData.address || address,
        restaurant_phone: phone,
        lat: placeData.lat,
        lng: placeData.lng,
        cuisines: selectedCuisines,
      });
      await refreshProfile();
      setStep('done');
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.shell },
    scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.stroke,
      alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    title: { fontSize: 26, fontWeight: '800', color: colors.ink, fontFamily: typography.heading, marginBottom: 6 },
    subtitle: { fontSize: 15, color: colors.inkMuted, fontFamily: typography.body, marginBottom: 28 },
    label: { fontSize: 12, color: colors.inkMuted, fontFamily: typography.body, marginBottom: 4, marginTop: 12 },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, padding: 14,
      color: colors.ink, fontFamily: typography.body, fontSize: 15,
      borderWidth: 1, borderColor: colors.stroke,
    },
    selectHeader: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.stroke,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectHeaderText: {
      color: colors.ink,
      fontFamily: typography.body,
      fontSize: 15,
      flex: 1,
      marginRight: 8,
    },
    selectMenu: {
      marginTop: 8,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.stroke,
      overflow: 'hidden',
    },
    selectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    selectRowLabel: {
      color: colors.ink,
      fontFamily: typography.body,
      fontSize: 14,
    },
    error: { color: '#EF4444', fontFamily: typography.body, fontSize: 13, marginTop: 8, textAlign: 'center' },
    btn: { backgroundColor: colors.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: typography.heading },
    infoBox: {
      backgroundColor: colors.surface, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: colors.stroke, marginBottom: 20,
    },
    infoLabel: { fontSize: 12, color: colors.inkMuted, fontFamily: typography.body },
    infoValue: { fontSize: 15, color: colors.ink, fontFamily: typography.body, fontWeight: '600', marginTop: 2 },
    matchBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: '#22C55E20', borderRadius: 8, padding: 10, marginTop: 12,
    },
    noMatchBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: '#EF444420', borderRadius: 8, padding: 10, marginTop: 12,
    },
    badgeText: { fontSize: 13, fontFamily: typography.body, color: colors.ink },
    doneText: { fontSize: 22, fontWeight: '800', color: colors.ink, fontFamily: typography.heading, textAlign: 'center', marginTop: 60 },
  });

  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={s.doneText}>{t('businessRegistration.doneTitle')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cuisinesLabel = selectedCuisines.length
    ? selectedCuisines.join(', ')
    : t('businessRegistration.cuisinePlaceholder');

  const toggleCuisine = (value: string) => {
    setSelectedCuisines((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      return [...prev, value];
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={16} color={colors.ink} />
          </TouchableOpacity>

          {/* ── STEP: form ── */}
          {(step === 'form' || step === 'verifying') && (
            <>
              <Text style={s.title}>Registra tu restaurante</Text>
              <Text style={s.subtitle}>{t('businessRegistration.formSubtitle')}</Text>

              <Text style={s.label}>{t('businessRegistration.restaurantName')}</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder={t('businessRegistration.restaurantNamePlaceholder')} placeholderTextColor={colors.inkFaint} />

              <Text style={s.label}>{t('businessRegistration.address')}</Text>
              <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder={t('businessRegistration.addressPlaceholder')} placeholderTextColor={colors.inkFaint} />

              <Text style={s.label}>{t('businessRegistration.phone')}</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder={t('businessRegistration.phonePlaceholder')} placeholderTextColor={colors.inkFaint} keyboardType="phone-pad" />

              <Text style={s.label}>{t('businessRegistration.mapsLink')}</Text>
              <TextInput style={s.input} value={mapsUrl} onChangeText={setMapsUrl} placeholder={t('businessRegistration.mapsLinkPlaceholder')} placeholderTextColor={colors.inkFaint} autoCapitalize="none" />

              <Text style={s.label}>{t('businessRegistration.cuisineLabel')}</Text>
              <TouchableOpacity
                style={s.selectHeader}
                onPress={() => setCuisineDropdownOpen((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Text style={s.selectHeaderText}>{cuisinesLabel}</Text>
                <Ionicons name={cuisineDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMuted} />
              </TouchableOpacity>
              {cuisineDropdownOpen && (
                <View style={s.selectMenu}>
                  {CUISINE_OPTIONS.map((option, index) => {
                    const selected = selectedCuisines.includes(option);
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[
                          s.selectRow,
                          index === CUISINE_OPTIONS.length - 1 ? { borderBottomWidth: 0 } : null,
                        ]}
                        onPress={() => toggleCuisine(option)}
                        activeOpacity={0.85}
                      >
                        <Text style={s.selectRowLabel}>{option}</Text>
                        <Ionicons
                          name={selected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={selected ? colors.brand : colors.inkMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {error && <Text style={s.error}>{error}</Text>}

              <TouchableOpacity style={s.btn} onPress={handleVerify} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('businessRegistration.verifyCta')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP: OTP (phone matched) ── */}
          {step === 'otp' && placeData && (
            <>
              <Text style={s.title}>{t('businessRegistration.otpTitle')}</Text>
              <Text style={s.subtitle}>{t('businessRegistration.otpSubtitle')}</Text>

              <View style={s.infoBox}>
                <Text style={s.infoLabel}>{t('businessRegistration.foundRestaurant')}</Text>
                <Text style={s.infoValue}>{placeData.name}</Text>
                <Text style={[s.infoLabel, { marginTop: 8 }]}>{t('common.address')}</Text>
                <Text style={s.infoValue}>{placeData.address}</Text>
                <View style={s.matchBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={s.badgeText}>{t('businessRegistration.phoneVerified')}</Text>
                </View>
              </View>

              <Text style={s.subtitle}>
                {t('businessRegistration.otpSent', { phone: placeData.maps_phone })}
              </Text>

              <Text style={s.label}>{t('businessRegistration.otpCode')}</Text>
              <TextInput style={s.input} value={otp} onChangeText={setOtp} placeholder={t('businessRegistration.otpPlaceholder')} placeholderTextColor={colors.inkFaint} keyboardType="number-pad" maxLength={6} />

              {error && <Text style={s.error}>{error}</Text>}

              <TouchableOpacity style={s.btn} onPress={handleComplete} disabled={loading || otp.length < 4}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('businessRegistration.confirmCta')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP: email fallback (phone didn't match) ── */}
          {step === 'email_fallback' && placeData && (
            <>
              <Text style={s.title}>{t('businessRegistration.altTitle')}</Text>
              <Text style={s.subtitle}>{t('businessRegistration.altSubtitle')}</Text>

              <View style={s.infoBox}>
                <Text style={s.infoLabel}>{t('businessRegistration.foundRestaurant')}</Text>
                <Text style={s.infoValue}>{placeData.name}</Text>
                <View style={s.noMatchBadge}>
                  <Ionicons name="warning" size={16} color="#EF4444" />
                  <Text style={s.badgeText}>{t('businessRegistration.phoneMismatch')}</Text>
                </View>
              </View>

              <Text style={s.label}>{t('businessRegistration.businessEmail')}</Text>
              <TextInput
                style={s.input} value={corpEmail} onChangeText={setCorpEmail}
                placeholder={t('businessRegistration.businessEmailPlaceholder')} placeholderTextColor={colors.inkFaint}
                keyboardType="email-address" autoCapitalize="none"
              />

              {error && <Text style={s.error}>{error}</Text>}

              <TouchableOpacity
                style={s.btn}
                onPress={handleComplete}
                disabled={loading || !corpEmail.includes('@')}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('businessRegistration.sendVerification')}</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
