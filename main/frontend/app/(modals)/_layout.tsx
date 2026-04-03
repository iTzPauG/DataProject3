import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../utils/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
        contentStyle: { backgroundColor: colors.shell },
      }}
    >
      <Stack.Screen name="place-details" />
      <Stack.Screen name="event-details" />
      <Stack.Screen name="report-details" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
