/**
 * LocationGate
 *
 * The whole map experience is location-driven (nearby search, deals radius,
 * "recentrar", reverse geocoded city name…) so when geolocation is missing or
 * denied we hard-stop the UI behind a full-bleed prompt that re-requests the
 * permission on every interaction. Children only render once we have a valid
 * `(lat, lng)` pair.
 *
 * On the web there's no programmatic permission re-prompt — the Permissions
 * API can revoke programmatically only when the user clears it themselves —
 * so we trigger a fresh `getCurrentPosition()` on every "Activar ubicación"
 * tap, which surfaces the browser's permission UI when relevant and otherwise
 * fast-fails (we then suggest opening the site permissions page).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { useLocation } from '../hooks/useLocation';
import { useTheme } from '../utils/theme';

declare const require: (m: string) => any;

interface Props {
  children: React.ReactNode;
}

export default function LocationGate({ children }: Props) {
  const { colors, typography, shadows } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const [requesting, setRequesting] = useState(false);
  const [tick, setTick] = useState(0); // bump to force re-evaluation on retry

  const hasLocation = !!(location.lat && location.lng) && !location.error;

  const requestPermission = useCallback(async () => {
    setRequesting(true);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            () => resolve(),
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
          );
        });
      } else if (Platform.OS !== 'web') {
        try {
          const ExpoLocation = require('expo-location');
          await ExpoLocation.requestForegroundPermissionsAsync();
        } catch {
          /* expo-location not installed in this build — fall through */
        }
      }
    } finally {
      setRequesting(false);
      setTick((n) => n + 1);
    }
  }, []);

  // Re-prompt automatically whenever we land here without a fix. Without this,
  // a user who refused once and reloaded would never see a permission dialog
  // again — they'd just be stuck on the gate.
  useEffect(() => {
    if (location.loading) return;
    if (hasLocation) return;
    void requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.loading, hasLocation, tick]);

  if (location.loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.shell }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[styles.hint, { color: colors.inkMuted, fontFamily: typography.body }]}>
          {t('location.locating') || 'Localizándote…'}
        </Text>
      </View>
    );
  }

  if (hasLocation) {
    return <>{children}</>;
  }

  const openSettings = () => {
    if (Platform.OS === 'web') {
      // chrome://settings/content/location is blocked from JS; provide a tip.
      Linking.openURL('https://support.google.com/chrome/answer/142065').catch(() => {});
      return;
    }
    Linking.openSettings().catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.shell }]}>
      <View style={styles.card}>
        <BlurView
          intensity={70}
          tint="dark"
          style={[styles.cardInner, shadows.lift]}
        >
          <View style={[styles.glyph, { borderColor: colors.brand }]}>
            <Icon name="crosshair" size={36} color={colors.brand} strokeWidth={2.2} />
          </View>
          <Text style={[styles.title, { color: '#FFFFFF', fontFamily: typography.heading }]}>
            {t('location.gateTitle') || 'Activa tu ubicación'}
          </Text>
          <Text style={[styles.body, { color: 'rgba(255,255,255,0.78)', fontFamily: typography.body }]}>
            {t('location.gateBody') ||
              'Necesitamos saber dónde estás para mostrarte ofertas, restaurantes y eventos a tu alrededor en tiempo real.'}
          </Text>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.brand }]}
            onPress={requestPermission}
            disabled={requesting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('location.enable') || 'Activar ubicación'}
          >
            {requesting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.ctaText, { fontFamily: typography.body }]}>
                {t('location.enable') || 'Activar ubicación'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={openSettings} activeOpacity={0.7} style={styles.secondary}>
            <Text style={[styles.secondaryText, { fontFamily: typography.body }]}>
              {t('location.openSettings') || 'Abrir ajustes del navegador'}
            </Text>
          </TouchableOpacity>

          {location.error ? (
            <Text style={[styles.error, { fontFamily: typography.mono }]}>
              {location.error}
            </Text>
          ) : null}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hint: {
    marginTop: 18,
    fontSize: 14,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 22, 32, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  glyph: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: {
    marginTop: 22,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondary: {
    marginTop: 10,
    paddingVertical: 6,
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    fontWeight: '500',
  },
  error: {
    marginTop: 16,
    fontSize: 11,
    color: '#FCA5A5',
    textAlign: 'center',
  },
});
