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
  }), [colors, typography, TAB_H]);

  return (
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
      <Tabs.Screen
        name="carta"
        options={{
          title: 'Carta',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? dynamicStyles.activeIconContainer : undefined}>
              <GADOIcon name="restaurant" category="food" size={size} color={color} />
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
      <Tabs.Screen
        name="report"
        options={{ href: null }}
      />
    </Tabs>
  );
}
