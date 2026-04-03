import { FloatingSearch } from '../../components/FloatingSearch';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import GADOIcon from '../../components/GADOIcon';
import { useTheme } from '../../utils/theme';

export default function TabsLayout() {
  const { colors, typography } = useTheme();

  const TAB_H = Platform.OS === 'ios' ? 90 : Platform.OS === 'web' ? 65 : 70;

  const dynamicStyles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.stroke,
      paddingBottom: Platform.OS === 'ios' ? 24 : 6,
      height: TAB_H,
      elevation: 20,
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      // No border radius — the search bar above provides the visual top edge
      position: Platform.OS === 'web' ? undefined : 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    tabBarLabel: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: typography.heading,
      marginTop: -2,
    },
    activeIconContainer: {
      padding: 5,
      borderRadius: 10,
      backgroundColor: colors.chip,
      borderTopWidth: 2,
      borderTopColor: colors.brand,
    },
    // Report FAB — centered, raised above the tab bar
    reportFab: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Platform.OS === 'ios' ? 24 : 14,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 8,
      borderWidth: 3,
      borderColor: colors.surface,
    },
  }), [colors, typography, TAB_H]);

  return (
    <View style={{ flex: 1 }}>
      {/* Main tab navigator */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: dynamicStyles.tabBar,
          tabBarLabelStyle: dynamicStyles.tabBarLabel,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Mapa',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={focused ? dynamicStyles.activeIconContainer : undefined}>
                <GADOIcon name="map" size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explorar',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={focused ? dynamicStyles.activeIconContainer : undefined}>
                <GADOIcon name="explore" size={size} color={color} />
              </View>
            ),
          }}
        />
        {/* Report — center FAB */}
        <Tabs.Screen
          name="report"
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <View style={dynamicStyles.reportFab}>
                <GADOIcon name="report_tab" size={26} color={colors.surface} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={focused ? dynamicStyles.activeIconContainer : undefined}>
                <GADOIcon name="person" size={size} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>

      {/* Search bar — sits above the tab bar, always visible */}
      <FloatingSearch />
    </View>
  );
}
