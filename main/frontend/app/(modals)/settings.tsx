import { Ionicons } from '../../components/SafeIonicons';
import { BASE_URL } from '../../services/api';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { MapStyle, useAppState } from '../../hooks/useAppState';
import { useTheme } from '../../utils/theme';
import { useTranslation } from 'react-i18next';

function formatRadius(value: number): string {
  return value >= 1000 ? `${value / 1000} km` : `${value} m`;
}

const RADIUS_OPTIONS = [2000, 5000, 10000, 20000];

export default function SettingsModal() {
  const { colors, radii, typography, shadows } = useTheme();
  const { idToken } = useAuth();
  const { mapPreferences, setMapPreferences } = useAppState();
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const { t } = useTranslation();

  const MAP_STYLE_OPTIONS = useMemo(() => [
    { value: 'minimal', label: t('settings.mapLayer.minimal.label'), description: t('settings.mapLayer.minimal.desc') },
    { value: 'standard', label: t('settings.mapLayer.standard.label'), description: t('settings.mapLayer.standard.desc') },
    { value: 'hybrid', label: t('settings.mapLayer.hybrid.label'), description: t('settings.mapLayer.hybrid.desc') },
    { value: 'satellite', label: t('settings.mapLayer.satellite.label'), description: t('settings.mapLayer.satellite.desc') },
    { value: 'terrain', label: t('settings.mapLayer.terrain.label'), description: t('settings.mapLayer.terrain.desc') },
  ], [t]);

  const THEME_OPTIONS = useMemo(() => [
    { value: 'system', label: t('settings.appearance.system'), description: t('settings.appearance.systemDesc') },
    { value: 'dark', label: t('settings.appearance.dark'), description: t('settings.appearance.darkDesc') },
    { value: 'light', label: t('settings.appearance.light'), description: t('settings.appearance.lightDesc') },
  ], [t]);

  const LANGUAGE_OPTIONS = useMemo(() => [
    { value: 'system', label: t('settings.language.system') },
    { value: 'es', label: t('settings.language.es') },
    { value: 'en', label: t('settings.language.en') },
    { value: 'fr', label: t('settings.language.fr') },
  ], [t]);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 16,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.soft,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    subtitle: {
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      backgroundColor: colors.brand + '15',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 20,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brandDeep,
      fontFamily: typography.body,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.inkMuted,
      lineHeight: 18,
      fontFamily: typography.body,
      marginBottom: 16,
    },
    themeGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    themeChip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.chip,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    themeChipActive: {
      backgroundColor: colors.brand + '15',
      borderColor: colors.brand,
    },
    themeLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.inkMuted,
      fontFamily: typography.heading,
    },
    themeLabelActive: {
      color: colors.brand,
    },
    styleCard: {
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.stroke,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    styleLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    styleDescription: {
      marginTop: 4,
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    toggleTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    toggleText: {
      marginTop: 4,
      fontSize: 12,
      color: colors.inkMuted,
      lineHeight: 18,
      fontFamily: typography.body,
    },
    radiusChip: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.chip,
    },
    radiusChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    doneButton: {
      backgroundColor: colors.brand,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      marginBottom: 40,
      ...shadows.lift,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: typography.heading,
    },
  }), [colors, typography, shadows, radii]);

  useEffect(() => {
    async function loadRemote() {
      if (!idToken) {
        setRemoteLoaded(true);
        return;
      }
      try {
        const res = await fetch(`${BASE_URL}/preferences/me`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        const prefs = data.preferences ?? data;
        setMapPreferences({
          mapStyle: prefs.map_minimal ? 'minimal' : (prefs.map_style ?? mapPreferences.mapStyle),
          gadoOverlay: prefs.gado_overlay_on ?? mapPreferences.gadoOverlay,
          showRealTimeEvents: prefs.show_real_time_events ?? mapPreferences.showRealTimeEvents,
          defaultRadiusM: prefs.default_radius_m ?? mapPreferences.defaultRadiusM,
          theme: prefs.theme ?? mapPreferences.theme,
          language: prefs.language ?? mapPreferences.language,
        });
      } catch {
        // Keep local preferences when remote sync is unavailable.
      } finally {
        setRemoteLoaded(true);
      }
    }

    void loadRemote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  useEffect(() => {
    async function syncRemote() {
      if (!idToken || !remoteLoaded) return;
      setSyncState('saving');
      try {
        const res = await fetch(`${BASE_URL}/preferences/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            map_style: mapPreferences.mapStyle === 'minimal' ? 'standard' : mapPreferences.mapStyle,
            map_minimal: mapPreferences.mapStyle === 'minimal',
            map_preset: mapPreferences.gadoOverlay ? 'drive' : 'classic',
            gado_overlay_on: mapPreferences.gadoOverlay,
            show_real_time_events: mapPreferences.showRealTimeEvents,
            default_radius_m: mapPreferences.defaultRadiusM,
            theme: mapPreferences.theme,
            language: mapPreferences.language,
          }),
        });
        setSyncState(res.ok ? 'saved' : 'error');
      } catch {
        setSyncState('error');
      }
    }

    void syncRemote();
  }, [mapPreferences, remoteLoaded, idToken]);

  const syncLabel = useMemo(() => {
    if (!idToken) return t('settings.sync.local');
    switch (syncState) {
      case 'saving':
        return t('settings.sync.saving');
      case 'saved':
        return t('settings.sync.saved');
      case 'error':
        return t('settings.sync.error');
      default:
        return t('settings.sync.cloud');
    }
  }, [idToken, syncState, t]);

  return (
    <SafeAreaView style={dynamicStyles.safe}>
      <View style={dynamicStyles.header}>
        <View style={styles.headerTextGroup}>
           <Text style={dynamicStyles.title}>{t('settings.title')}</Text>
           <Text style={dynamicStyles.subtitle}>{t('settings.subtitle')}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Close settings"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={dynamicStyles.closeButton}
        >
          <Ionicons name="close" size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={dynamicStyles.statusPill}>
          <Ionicons name="cloud-done-outline" size={16} color={colors.brandDeep} />
          <Text style={dynamicStyles.statusText}>{syncLabel}</Text>
        </View>

        {/* Theme Selection */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('settings.appearance.title')}</Text>
          <Text style={dynamicStyles.sectionSubtitle}>{t('settings.appearance.subtitle')}</Text>
          <View style={dynamicStyles.themeGrid}>
            {THEME_OPTIONS.map((option) => {
              const selected = mapPreferences.theme === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.82}
                  onPress={() => setMapPreferences({ theme: option.value as any })}
                  style={[
                    dynamicStyles.themeChip, 
                    selected && dynamicStyles.themeChipActive
                  ]}
                >
                  <Text style={[dynamicStyles.themeLabel, selected && dynamicStyles.themeLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Language Selection */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('settings.language.title')}</Text>
          <Text style={dynamicStyles.sectionSubtitle}>{t('settings.language.subtitle')}</Text>
          <View style={dynamicStyles.themeGrid}>
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = (mapPreferences.language || 'system') === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.82}
                  onPress={() => setMapPreferences({ language: option.value as any })}
                  style={[
                    dynamicStyles.themeChip, 
                    selected && dynamicStyles.themeChipActive
                  ]}
                >
                  <Text style={[dynamicStyles.themeLabel, selected && dynamicStyles.themeLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Map Style */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('settings.mapLayer.title')}</Text>
          <Text style={dynamicStyles.sectionSubtitle}>{t('settings.mapLayer.subtitle')}</Text>
          <View style={styles.cardGrid}>
            {MAP_STYLE_OPTIONS.map((option) => {
              const selected = mapPreferences.mapStyle === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.82}
                  onPress={() => setMapPreferences({ mapStyle: option.value as any })}
                  style={[
                    dynamicStyles.styleCard,
                    selected && { borderColor: colors.brand, backgroundColor: colors.brand + '08' }
                  ]}
                >
                  <Text style={[dynamicStyles.styleLabel, selected && { color: colors.brandDeep }]}>
                    {option.label}
                  </Text>
                  <Text style={[dynamicStyles.styleDescription, selected && { color: colors.brandDeep }]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('settings.gadoOverlay.title')}</Text>
          <Text style={dynamicStyles.sectionSubtitle}>{t('settings.gadoOverlay.subtitle')}</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={dynamicStyles.toggleTitle}>{t('settings.gadoOverlay.liveActivity')}</Text>
              <Text style={dynamicStyles.toggleText}>{t('settings.gadoOverlay.liveActivityDesc')}</Text>
            </View>
            <Switch
              onValueChange={(value) => setMapPreferences({ gadoOverlay: value })}
              value={mapPreferences.gadoOverlay}
              trackColor={{ false: '#D5D7DB', true: colors.brandDeep }}
              thumbColor={mapPreferences.gadoOverlay ? colors.brand : '#FFFFFF'}
            />
          </View>
        </View>

        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>{t('settings.defaultRadius.title')}</Text>
          <Text style={dynamicStyles.sectionSubtitle}>{t('settings.defaultRadius.subtitle')}</Text>
          <View style={styles.cardGrid}>
            <View style={styles.toggleCopy}>
              <Text style={dynamicStyles.toggleTitle}>{t('settings.defaultRadius.realTime')}</Text>
              <Text style={dynamicStyles.toggleText}>{t('settings.defaultRadius.realTimeDesc')}</Text>
            </View>
            <Switch
              onValueChange={(value) => setMapPreferences({ showRealTimeEvents: value })}
              value={mapPreferences.showRealTimeEvents}
              trackColor={{ false: '#D5D7DB', true: colors.brandDeep }}
              thumbColor={mapPreferences.showRealTimeEvents ? colors.brand : '#FFFFFF'}
            />
          </View>

          <Text style={dynamicStyles.sectionSubtitle} style={{marginTop: 16, marginBottom: 8}}>{t('settings.defaultRadius.autoSearch')}</Text>
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map((value) => {
              const selected = mapPreferences.defaultRadiusM === value;
              return (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.82}
                  onPress={() => setMapPreferences({ defaultRadiusM: value })}
                  style={[
                    dynamicStyles.radiusChip, 
                    selected && { backgroundColor: colors.brand }
                  ]}
                >
                  <Text style={[dynamicStyles.radiusChipText, selected && { color: '#FFFFFF' }]}>
                    {formatRadius(value)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity 
          style={dynamicStyles.doneButton}
          onPress={() => router.back()}
        >
          <Text style={dynamicStyles.doneButtonText}>{t('settings.done')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerTextGroup: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  cardGrid: {
    gap: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toggleCopy: {
    flex: 1,
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
