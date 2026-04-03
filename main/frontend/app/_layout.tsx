import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppStateProvider } from '../hooks/useAppState';
import { GADOLogger } from '../utils/logger'; // Activa telemetría total

export default function RootLayout() {
  GADOLogger.info("App starting...");
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
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
