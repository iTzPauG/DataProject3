import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStateProvider, useAppState } from '../hooks/useAppState';
import { useAuth } from '../hooks/useAuth';
import { fetchRemotePreferences, toLocalPreferences } from '../services/preferences';
import { GADOLogger } from '../utils/logger';
import WebFontLoader from '../components/WebFontLoader';
import '../utils/i18n';
import { useTranslation } from 'react-i18next';

// Syncs i18n language with the language set in AppState
function LanguageSyncer() {
  const { mapPreferences, isHydrated } = useAppState();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (isHydrated && mapPreferences.language) {
      let lang = mapPreferences.language;
      if (lang === 'system') {
        // Fallback or use expo-localization here if available
        // For now, fallback to 'es' as default
        lang = 'es';
      }
      if (i18n.language !== lang) {
        i18n.changeLanguage(lang);
      }
    }
  }, [mapPreferences.language, isHydrated, i18n]);

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

export default function RootLayout() {
  GADOLogger.info('App starting...');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <WebFontLoader />
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
