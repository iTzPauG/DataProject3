import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from '../../components/Icon';
import { useTheme } from '../../utils/theme';

/**
 * Bottom tab bar — editorial, label-first.
 *
 * A small geometric glyph sits above a label set in small-caps.  The active
 * tab is marked by a hairline rule under the label (think magazine running
 * head), not by a filled chip.  We keep only Map / Explore / Profile in the
 * visible bar; the Report tab is routed via a CTA on Explore.
 */
const TAB_GLYPHS: Record<string, IconName> = {
  index: 'map',
  explore: 'compass',
  profile: 'person',
};

const TAB_LABELS: Record<string, string> = {
  index: 'Mapa',
  explore: 'Explorar',
  profile: 'Perfil',
};

export default function TabsLayout() {
  const { colors, typography } = useTheme();

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
        },
        item: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          paddingTop: 4,
        },
        label: {
          fontSize: 10,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          fontFamily: typography.body,
          fontWeight: '600',
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

  const renderTab = (routeName: keyof typeof TAB_GLYPHS, focused: boolean) => {
    const label = TAB_LABELS[routeName];
    const glyph = TAB_GLYPHS[routeName];
    const color = focused ? colors.ink : colors.inkFaint;
    return (
      <View style={styles.item}>
        <Icon name={glyph} size={18} color={color} strokeWidth={1.4} />
        <Text style={[styles.label, { color }]}>{label}</Text>
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
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => renderTab('profile', focused),
        }}
      />
      <Tabs.Screen name="report" options={{ href: null }} />
    </Tabs>
  );
}
