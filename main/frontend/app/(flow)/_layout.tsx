import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../utils/theme';

export default function FlowLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Keep the (flow) screens in a clean canvas
        contentStyle: { backgroundColor: colors.shell },
      }}
    />
  );
}
