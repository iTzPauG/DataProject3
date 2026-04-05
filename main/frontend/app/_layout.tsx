import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStateProvider, useAppState } from '../hooks/useAppState';
import { useAuth } from '../hooks/useAuth';
import { BASE_URL } from '../services/api';
import { GADOLogger } from '../utils/logger';

// Loads remote preferences into AppState whenever the user logs in
function PreferencesSyncer() {
  const { idToken } = useAuth();
  const { setMapPreferences } = useAppState();

  useEffect(() => {
    if (!idToken) return;
    fetch(`${BASE_URL}/preferences/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setMapPreferences({
          mapStyle: data.map_minimal ? 'minimal' : (data.map_style ?? 'standard'),
          gadoOverlay: data.gado_overlay_on ?? true,
          defaultRadiusM: data.default_radius_m ?? 10000,
          language: data.language ?? 'system',
          theme: data.theme ?? 'system',
          showRealTimeEvents: data.show_real_time_events ?? true,
        });
      })
      .catch(() => {});
  }, [idToken]);

  return null;
}

export default function RootLayout() {
  GADOLogger.info('App starting...');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <PreferencesSyncer />
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
