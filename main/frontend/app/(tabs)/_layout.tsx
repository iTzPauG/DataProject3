import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from '../../components/Icon';
import { useAppState } from '../../hooks/useAppState';
import { useTheme } from '../../utils/theme';
import { resolveUiLanguage } from '../../utils/language';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_GLYPHS: Record<string, IconName> = {
  index: 'map',
  explore: 'compass',
  foryou: 'heart',
  profile: 'person',
};

export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const { colors, typography } = useTheme();
  const { mapPreferences, setMapPreferences } = useAppState();
  const insets = useSafeAreaInsets();

  const TAB_H = Platform.OS === 'ios' ? 88 : Platform.OS === 'web' ? 70 : 72;
  const activeLanguage = resolveUiLanguage(i18n.resolvedLanguage || mapPreferences.language);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          backgroundColor: colors.shell,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          height: TAB_H,
          paddingHorizontal: 12,
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
          paddingHorizontal: 18,
          paddingVertical: 6,
          borderRadius: 14,
          minWidth: 90,
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
        languageDock: {
          position: 'absolute',
          right: 12,
          zIndex: 500,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.shell + 'D9',
          padding: 2,
        },
        languageChip: {
          minWidth: 32,
          height: 26,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
        },
        languageChipActive: {
          backgroundColor: colors.brand,
        },
        languageChipText: {
          fontSize: 11,
          fontFamily: typography.body,
          fontWeight: '800',
          color: colors.inkFaint,
          letterSpacing: 0.3,
        },
        languageChipTextActive: {
          color: '#FFFFFF',
        },
      }),
    [colors, typography, TAB_H],
  );

  const setLanguage = (next: 'es' | 'en') => {
    setMapPreferences({ language: next });
    if (i18n.language !== next) {
      void i18n.changeLanguage(next);
    }
  };

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
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: { flex: 1, paddingHorizontal: 12 },
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

      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.languageDock, { bottom: TAB_H + (insets.bottom > 0 ? 8 : 12) }]}>
          {(['es', 'en'] as const).map((lang) => {
            const active = activeLanguage === lang;
            return (
              <Pressable
                key={lang}
                style={[styles.languageChip, active && styles.languageChipActive]}
                onPress={() => setLanguage(lang)}
                accessibilityRole="button"
                accessibilityLabel={`${t('settings.language.title')}: ${lang.toUpperCase()}`}
              >
                <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
