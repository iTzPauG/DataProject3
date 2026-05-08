import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from '../../components/Icon';
import { useTheme } from '../../utils/theme';

const TAB_GLYPHS: Record<string, IconName> = {
  index: 'map',
  explore: 'compass',
  foryou: 'heart',
  profile: 'person',
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();

  const TAB_H = Platform.OS === 'ios' ? 88 : Platform.OS === 'web' ? 70 : 72;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          backgroundColor: colors.shell,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          height: TAB_H,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          minWidth: 72,
        },
        itemActive: {
          backgroundColor: colors.ink + '10',
        },
        label: {
          fontSize: 11,
          fontFamily: typography.body,
          fontWeight: '700',
          letterSpacing: 0,
        },
      }),
    [colors, typography, TAB_H],
  );

  const renderTab = (routeName: keyof typeof TAB_GLYPHS, focused: boolean) => {
    const label = t(`tabs.${routeName === 'index' ? 'index' : routeName}`);
    const glyph = TAB_GLYPHS[routeName];
    const color = focused ? colors.ink : colors.inkFaint;
    return (
      <View style={[styles.item, focused && styles.itemActive]}>
        <Icon name={glyph} size={20} color={color} strokeWidth={focused ? 2 : 1.6} />
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
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
        tabBarItemStyle: { flex: 1, paddingHorizontal: 4 },
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
          tabBarIcon: ({ focused }) => renderTab('explore', focused),
        }}
      />
      <Tabs.Screen
        name="foryou"
        options={{
          tabBarIcon: ({ focused }) => renderTab('foryou', focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null }}
      />
    </Tabs>
  );
}
