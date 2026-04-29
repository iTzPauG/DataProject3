/**
 * LiveDataAddon — shows real-time info for a place based on its type.
 *
 * Supported addons:
 *   fuel_prices    → gas station current fuel prices (Spain MINETUR API)
 *   pharmacy_duty  → link to local pharmacy-council on-duty page
 *   cinema_info    → link to cinema website for today's showtimes
 *   ev_charging    → EV charging note
 */
import { Ionicons } from './SafeIonicons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LiveDataResult } from '../services/api';
import { useTheme } from '../utils/theme';

// ── Fuel label map ────────────────────────────────────────────────────────────

const FUEL_LABELS: Record<string, string> = {
  gasolina_95:     'Gasolina 95',
  gasolina_98:     'Gasolina 98',
  gasoleo_a:       'Diésel',
  gasoleo_premium: 'Diésel Premium',
  glp:             'GLP',
  gas_natural:     'Gas Natural',
  hidrogeno:       'Hidrógeno',
};

const FUEL_ORDER = ['gasolina_95', 'gasolina_98', 'gasoleo_a', 'gasoleo_premium', 'glp', 'gas_natural', 'hidrogeno'];

// ── Sub-components ────────────────────────────────────────────────────────────

function FuelPricesBlock({ data }: { data: LiveDataResult }) {
  const { t } = useTranslation();
  const { colors, typography, radii } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    notFoundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    notFoundText: {
      fontSize: 13,
      fontFamily: typography.body,
      color: colors.inkMuted,
    },
    brandLabel: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: typography.heading,
      color: colors.inkMuted,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pricesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 10,
    },
    priceCell: {
      backgroundColor: colors.chip,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 100,
      alignItems: 'center',
    },
    priceValue: {
      fontSize: 18,
      fontWeight: '800',
      fontFamily: typography.heading,
      color: colors.ink,
    },
    priceLabel: {
      fontSize: 11,
      fontFamily: typography.body,
      color: colors.inkMuted,
      marginTop: 2,
    },
    scheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    scheduleText: {
      fontSize: 13,
      fontFamily: typography.body,
      color: colors.inkMuted,
    },
    updatedLabel: {
      fontSize: 11,
      fontFamily: typography.body,
      color: colors.inkMuted,
      marginTop: 8,
      fontStyle: 'italic',
    },
  }), [colors, typography, radii]);

  if (!data.found || !data.prices || Object.keys(data.prices).length === 0) {
    return (
      <View style={styles.notFoundRow}>
        <Ionicons name="alert-circle-outline" size={16} color={colors.inkMuted} />
        <Text style={styles.notFoundText}>{t('liveData.notAvailable')}</Text>
      </View>
    );
  }

  const entries = FUEL_ORDER.filter((k) => data.prices![k as keyof typeof data.prices] != null);

  return (
    <>
      {data.brand && (
        <Text style={styles.brandLabel}>{data.brand}</Text>
      )}
      <View style={styles.pricesGrid}>
        {entries.map((key) => (
          <View key={key} style={styles.priceCell}>
            <Text style={styles.priceValue}>
              {(data.prices![key as keyof typeof data.prices] as number).toFixed(3)} €
            </Text>
            <Text style={styles.priceLabel}>{t(`fuel.${key}`)}</Text>
          </View>
        ))}
      </View>
      {data.schedule && (
        <View style={styles.scheduleRow}>
          <Ionicons name="time-outline" size={14} color={colors.inkMuted} />
          <Text style={styles.scheduleText}>{data.schedule}</Text>
        </View>
      )}
      {data.updated_label && (
        <Text style={styles.updatedLabel}>{data.updated_label}</Text>
      )}
    </>
  );
}

function LinkBlock({ data }: { data: LiveDataResult }) {
  const { t } = useTranslation();
  const { colors, typography, radii } = useTheme();
  const hasLink = !!data.link_url;

  const styles = useMemo(() => StyleSheet.create({
    addonDescription: {
      fontSize: 14,
      fontFamily: typography.body,
      color: colors.inkMuted,
      lineHeight: 20,
      marginBottom: 14,
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.brand,
      borderRadius: radii.md,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignSelf: 'flex-start',
    },
    linkButtonText: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: '#FFFFFF',
    },
  }), [colors, typography, radii]);

  return (
    <>
      {data.description && <Text style={styles.addonDescription}>{data.description}</Text>}
      {hasLink && (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL(data.link_url!)}
          activeOpacity={0.75}
        >
          <Ionicons name="open-outline" size={16} color="#FFFFFF" />
          <Text style={styles.linkButtonText}>{data.link_label || t('common.viewMore')}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function EvChargingBlock({ data }: { data: LiveDataResult }) {
  const { colors, typography } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    addonDescription: {
      fontSize: 14,
      fontFamily: typography.body,
      color: colors.inkMuted,
      lineHeight: 20,
      marginBottom: 14,
    },
  }), [colors, typography]);

  return (
    <Text style={styles.addonDescription}>{data.note}</Text>
  );
}

function WeatherBlock({ data }: { data: LiveDataResult }) {
  const { colors, typography, radii } = useTheme();
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: colors.chip,
      padding: 16,
      borderRadius: radii.lg,
      marginBottom: 12,
    },
    mainInfo: {
      flex: 1,
    },
    emoji: {
      fontSize: 40,
    },
    temp: {
      fontSize: 24,
      fontWeight: '800',
      fontFamily: typography.heading,
      color: colors.ink,
    },
    desc: {
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginTop: 2,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    metricContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metric: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    outdoorContainer: {
      backgroundColor: data.outdoor_score && data.outdoor_score >= 80 ? '#10B98120' : 
                      data.outdoor_score && data.outdoor_score >= 50 ? '#F59E0B20' : '#EF444420',
      padding: 12,
      borderRadius: radii.md,
      marginBottom: 8,
    },
    outdoorLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: data.outdoor_score && data.outdoor_score >= 80 ? '#059669' : 
             data.outdoor_score && data.outdoor_score >= 50 ? '#D97706' : '#DC2626',
      fontFamily: typography.heading,
    },
    alertContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#EF444420',
      padding: 12,
      borderRadius: radii.md,
    },
    alertText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#DC2626',
      fontFamily: typography.heading,
      flex: 1,
    },
  }), [colors, typography, radii, data.outdoor_score]);

  return (
    <View>
      <View style={styles.container}>
        <Ionicons name={data.weather_emoji as any || 'partly-sunny'} size={40} color={colors.ink} />
        <View style={styles.mainInfo}>
          <Text style={styles.temp}>{Math.round(data.temperature || 0)}°C</Text>
          <Text style={styles.desc}>{data.weather_label}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricContainer}>
              <Ionicons name="water-outline" size={14} color={colors.inkMuted} />
              <Text style={styles.metric}>{data.humidity}%</Text>
            </View>
            <View style={styles.metricContainer}>
              <Ionicons name="filter-outline" size={14} color={colors.inkMuted} />
              <Text style={styles.metric}>{Math.round(data.wind_kmh || 0)} km/h</Text>
            </View>
            {!!data.precipitation_mm && data.precipitation_mm > 0 && (
              <View style={styles.metricContainer}>
                <Ionicons name="rainy-outline" size={14} color={colors.inkMuted} />
                <Text style={styles.metric}>{data.precipitation_mm}mm</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {data.outdoor_label && (
        <View style={styles.outdoorContainer}>
          <Text style={styles.outdoorLabel}>{data.outdoor_label}</Text>
        </View>
      )}
      {data.alert && (
        <View style={styles.alertContainer}>
          <Ionicons name="warning" size={16} color="#DC2626" />
          <Text style={styles.alertText}>{data.alert}</Text>
        </View>
      )}
    </View>
  );
}

function CinemaShowtimesBlock({ data }: { data: LiveDataResult }) {
  const { t } = useTranslation();
  const { colors, typography, radii } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: 12,
    },
    movieCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      borderRadius: radii.md,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
      marginBottom: 4,
    },
    overview: {
      fontSize: 12,
      color: colors.inkMuted,
      fontFamily: typography.body,
      lineHeight: 16,
      marginBottom: 6,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    rating: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.brand,
      borderRadius: radii.md,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    linkButtonText: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: '#FFFFFF',
    },
    updatedLabel: {
      fontSize: 11,
      fontFamily: typography.body,
      color: colors.inkMuted,
      marginTop: 8,
      fontStyle: 'italic',
    },
  }), [colors, typography, radii]);

  if (!data.movies || data.movies.length === 0) {
    return <LinkBlock data={data} />;
  }

  return (
    <View style={styles.container}>
      {data.movies.map((m, i) => (
        <View key={i} style={styles.movieCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{m.title}</Text>
            <Text style={styles.overview} numberOfLines={2}>{m.overview}</Text>
            {m.rating > 0 && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.rating}>{m.rating.toFixed(1)}/10</Text>
              </View>
            )}
          </View>
        </View>
      ))}
      {data.link_url && (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL(data.link_url!)}
          activeOpacity={0.75}
        >
          <Ionicons name="open-outline" size={16} color="#FFFFFF" />
          <Text style={styles.linkButtonText}>{data.link_label || t('liveData.viewFullSchedule')}</Text>
        </TouchableOpacity>
      )}
      {data.updated_label && (
        <Text style={styles.updatedLabel}>{data.updated_label}</Text>
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data: LiveDataResult;
}

export default function LiveDataAddon({ data }: Props) {
  const { t } = useTranslation();
  const { colors, typography, radii } = useTheme();

  const ADDON_META: Record<string, { icon: string; color: string; title: string }> = {
    fuel_prices:    { icon: 'speedometer', color: '#F97316', title: t('liveData.fuelPrices') },
    pharmacy_duty:  { icon: 'medkit', color: '#EF4444', title: t('liveData.pharmacyDuty') },
    cinema_info:    { icon: 'film', color: '#8B5CF6', title: t('liveData.cinemaShowtimes') },
    cinema_showtimes: { icon: 'film', color: '#8B5CF6', title: t('liveData.cinemaShowtimes') },
    ev_charging:    { icon: 'flash', color: '#0EA5E9', title: t('liveData.evCharging') },
    weather:        { icon: 'partly-sunny', color: '#0EA5E9', title: t('liveData.weatherNow') },
  };
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.stroke,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconEmoji: {
      fontSize: 18,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
    },
  }), [colors, typography, radii]);

  if (data.type === 'none') return null;

  const meta = ADDON_META[data.type] ?? { icon: 'radio', color: '#6366F1', title: t('liveData.realtime') };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
        <Text style={styles.sectionTitle}>{data.title ?? meta.title}</Text>
      </View>

      {data.type === 'fuel_prices' && <FuelPricesBlock data={data} />}
      {(data.type === 'pharmacy_duty' || data.type === 'cinema_info') && <LinkBlock data={data} />}
      {data.type === 'ev_charging' && <EvChargingBlock data={data} />}
      {data.type === 'weather' && <WeatherBlock data={data} />}
      {data.type === 'cinema_showtimes' && <CinemaShowtimesBlock data={data} />}
    </View>
  );
}


