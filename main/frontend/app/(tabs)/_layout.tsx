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
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const { profile } = useAuth();
  const isBusiness = profile?.role === 'business';

  const TAB_H = Platform.OS === 'ios' ? 78 : Platform.OS === 'web' ? 60 : 64;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          backgroundColor: colors.shell,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          height: TAB_H,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 18 : 6,
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
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingTop: 2,
          paddingBottom: 2,
        },
        label: {
          fontSize: 11,
          letterSpacing: 0.2,
          fontFamily: typography.body,
          fontWeight: '600',
          textAlign: 'center',
        },
        underline: {
          marginTop: 2,
          width: 16,
          height: 2,
          borderRadius: 1,
          backgroundColor: colors.ink,
        },
        underlinePlaceholder: {
          marginTop: 2,
          height: 2,
          width: 16,
          backgroundColor: 'transparent',
        },
      }),
    [colors, typography, TAB_H],
  );

  const renderTab = (routeName: 'index' | 'explore' | 'publish' | 'mis-ofertas', focused: boolean) => {
    const label = t(`tabs.${routeName}`);
    const glyph = TAB_GLYPHS[routeName];
    const color = focused ? colors.ink : colors.inkFaint;
    return (
      <View style={styles.item}>
        <Icon name={glyph} size={20} color={color} strokeWidth={1.6} />
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={focused ? styles.underline : styles.underlinePlaceholder} />
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
        tabBarItemStyle: { flex: 1 },
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
      {/* Profile is now a floating avatar on the map; hide from bottom tab bar */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
