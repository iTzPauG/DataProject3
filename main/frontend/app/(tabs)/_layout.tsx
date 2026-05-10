import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from '../../components/Icon';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../utils/theme';

const TAB_GLYPHS: Record<string, IconName> = {
  index: 'map',
  explore: 'compass',
  publish: 'plus',
  'mis-ofertas': 'tag',
  profile: 'person',
  restaurant: 'pin',
  dashboard: 'sliders',
  director: 'chart',
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const { profile } = useAuth();
  const isBusiness = profile?.role === 'business';

  const TAB_H = Platform.OS === 'ios' ? 86 : Platform.OS === 'web' ? 64 : 68;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          backgroundColor: colors.shell,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          height: TAB_H,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          elevation: 0,
          shadowOpacity: 0,
          position: Platform.OS === 'web' ? undefined : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        item: {
          flex: 1,
          maxWidth: 132,
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          paddingTop: 4,
        },
        label: {
          fontSize: 9,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          fontFamily: typography.body,
          fontWeight: '600',
          textAlign: 'center',
          width: '100%',
        },
        underline: {
          marginTop: 5,
          width: 18,
          height: 1,
          backgroundColor: colors.ink,
        },
        underlinePlaceholder: {
          marginTop: 5,
          height: 1,
          width: 18,
          backgroundColor: 'transparent',
        },
      }),
    [colors, typography, TAB_H],
  );

  const renderTab = (routeName: 'index' | 'explore' | 'publish' | 'mis-ofertas' | 'profile' | 'restaurant' | 'dashboard' | 'director', focused: boolean) => {
    const label = t(`tabs.${routeName}`);
    const glyph = TAB_GLYPHS[routeName];
    const color = focused ? colors.ink : colors.inkFaint;
    const labelStyle = routeName === 'mis-ofertas'
      ? { fontSize: 8.2, letterSpacing: 0.2 }
      : null;
    return (
      <View style={styles.item}>
        <Icon name={glyph} size={18} color={color} strokeWidth={1.4} />
        <Text
          style={[styles.label, { color }, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View
          style={focused ? styles.underline : styles.underlinePlaceholder}
        />
      </View>
    );
  };

  return (
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: { flex: 1, marginHorizontal: 10 },
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => renderTab('index', focused),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: isBusiness ? null : undefined,
          tabBarIcon: ({ focused }) => renderTab('explore', focused),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          href: isBusiness ? undefined : null,
          tabBarIcon: ({ focused }) => renderTab('publish', focused),
        }}
      />
      <Tabs.Screen
        name="mis-ofertas"
        options={{
          href: isBusiness ? undefined : null,
          tabBarIcon: ({ focused }) => renderTab('mis-ofertas', focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => renderTab('profile', focused),
        }}
      />
      <Tabs.Screen
        name="restaurant"
        options={{
          tabBarIcon: ({ focused }) => renderTab('restaurant', focused),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => renderTab('dashboard', focused),
        }}
      />
      <Tabs.Screen
        name="director"
        options={{
          tabBarIcon: ({ focused }) => renderTab('director', focused),
        }}
      />
    </Tabs>
  );
}
