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
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const { profile } = useAuth();
  const isBusiness = profile?.role === 'business';

  // A few extra px on every platform so the icon + label + underline never get
  // clipped together (iOS already adds safe-area padding inside `paddingBottom`).
  const TAB_H = Platform.OS === 'ios' ? 82 : Platform.OS === 'web' ? 68 : 70;

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
          minWidth: 56,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingTop: 4,
          paddingBottom: 2,
        },
        label: {
          fontSize: 12,
          letterSpacing: 0.1,
          fontFamily: typography.body,
          fontWeight: '600',
          textAlign: 'center',
          marginTop: 2,
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

  const renderTab = (
    routeName: 'index' | 'explore' | 'publish' | 'mis-ofertas' | 'profile',
    focused: boolean,
  ) => {
    // Mapped Spanish-friendly labels with safe fallbacks. We keep them short so
    // none get clipped at small widths (4–5 visible tabs).
    const labelMap: Record<string, string> = {
      index: t('tabs.index') || 'Mapa',
      explore: t('tabs.explore') || 'Explorar',
      publish: t('tabs.publish') || 'Publicar',
      'mis-ofertas': t('tabs.mis-ofertas') || 'Ofertas',
      profile: t('tabs.profile') || 'Perfil',
    };
    const label = labelMap[routeName];
    const glyph = TAB_GLYPHS[routeName];
    const color = focused ? colors.ink : colors.inkFaint;
    return (
      <View style={styles.item}>
        <Icon name={glyph} size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
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
      {/* Profile lives in the bottom tab bar (the floating map avatar was removed). */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => renderTab('profile', focused),
        }}
      />
    </Tabs>
  );
}
