import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStateProvider, useAppState } from '../hooks/useAppState';
import { useAuth } from '../hooks/useAuth';
import { getCurrentUserInteractions } from '../services/api';
import { fetchRemotePreferences, toLocalPreferences } from '../services/preferences';
import { GADOLogger } from '../utils/logger';
import { resolveI18nLanguage } from '../utils/language';
import WebFontLoader from '../components/WebFontLoader';
import '../utils/i18n';
import { useTranslation } from 'react-i18next';

// Sync i18n language with the language set in AppState
function LanguageSyncer() {
  const { mapPreferences, isHydrated } = useAppState();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (isHydrated && mapPreferences.language) {
      const lang = resolveI18nLanguage(mapPreferences.language);
      if (i18n.language !== lang) {
        void i18n.changeLanguage(lang);
      }
    }
  }, [mapPreferences.language, isHydrated, i18n]);

  return null;
}

// On the web, when a user lands on a deep link (e.g. /catalogo, /(tabs)/foryou,
// or any route other than '/'), bounce them through the splash/main screen first
// so AppState, Auth and preferences hydrate before the deep route renders.
// We remember the intended URL in sessionStorage so the splash screen can
// forward them back after the redirect — a refresh on the same deep link
// "just works" but always passes through the bootstrapping flow.
function ColdStartDeepLinkRedirector() {
  const pathname = usePathname();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    handled.current = true;

    // Only act on cold start: if there's already a "boot completed" marker
    // set by the splash screen, the user is navigating in-app — leave them alone.
    const BOOT_KEY = 'whim_boot_completed';
    const bootCompleted = window.sessionStorage?.getItem(BOOT_KEY);
    if (bootCompleted) return;

    if (pathname && pathname !== '/' && pathname !== '/index') {
      try {
        window.sessionStorage?.setItem('whim_intended_path', pathname + (window.location.search || ''));
      } catch {
        /* sessionStorage may be unavailable in private mode — ignore */
      }
      router.replace('/');
    }
  }, [pathname]);

  return null;
}

// Loads remote preferences into AppState whenever the user logs in
function PreferencesSyncer() {
  const { idToken, loading } = useAuth();
  const { mapPreferences, setMapPreferences } = useAppState();
  const latestPreferencesRef = useRef(mapPreferences);

  useEffect(() => {
    latestPreferencesRef.current = mapPreferences;
  }, [mapPreferences]);

  useEffect(() => {
    if (loading || !idToken) return;

    let cancelled = false;

    async function syncRemotePreferences() {
      const remote = await fetchRemotePreferences(idToken);
      if (!remote || cancelled) return;

      setMapPreferences(toLocalPreferences(remote, latestPreferencesRef.current));
    }

    void syncRemotePreferences();

    return () => {
      cancelled = true;
    };
  }, [idToken, loading, setMapPreferences]);

  return null;
}

// Prefetch user interactions as soon as the user logs in so ForYou tab loads instantly
function ForYouPrefetcher() {
  const { idToken } = useAuth();
  useEffect(() => {
    if (!idToken) return;
    void getCurrentUserInteractions();
  }, [idToken]);
  return null;
}

export default function RootLayout() {
  GADOLogger.info('App starting...');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <WebFontLoader />
        <ColdStartDeepLinkRedirector />
        <ForYouPrefetcher />
        <PreferencesSyncer />
        <LanguageSyncer />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(flow)" />
          <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        </Stack>
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}
