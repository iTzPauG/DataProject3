import { useTranslation } from "react-i18next";
import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  Layout,
  SlideInDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import WhimIcon from '../../components/WhimIcon';
import Map from '../../components/map/Map';
import { useAppState } from '../../hooks/useAppState';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { useTheme } from '../../utils/theme';
import { createReport, getReportTypes } from '../../services/api';
import { ReportType } from '../../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DURATIONS = [
  { label: '1h', value: 1 },
  { label: '4h', value: 4 },
  { label: '8h', value: 8 },
  { label: '24h', value: 24 },
];

export default function ReportTab() {
  const { t } = useTranslation();
  const { colors, radii, shadows, typography } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { mapPreferences, mapRegion: appMapRegion } = useAppState();
  const location = useLocation();
  const [options, setOptions] = useState<ReportType[]>([]);
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationHours, setDurationHours] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [postAnonymously, setPostAnonymously] = useState(true);

  // Map state for the background
  const [mapRegion, setMapRegion] = useState({
    lat: appMapRegion?.lat ?? location.lat ?? 39.4699,
    lng: appMapRegion?.lng ?? location.lng ?? -0.3763,
    latDelta: appMapRegion?.latDelta ?? 0.015,
    lngDelta: appMapRegion?.lngDelta ?? 0.015,
  });

  useEffect(() => {
    if (appMapRegion) {
      setMapRegion((prev) => ({
        ...prev,
        lat: appMapRegion.lat,
        lng: appMapRegion.lng,
        latDelta: appMapRegion.latDelta,
        lngDelta: appMapRegion.lngDelta,
      }));
      return;
    }
    if (location.lat && location.lng) {
      setMapRegion((prev) => ({
        ...prev,
        lat: location.lat!,
        lng: location.lng!,
      }));
    }
  }, [appMapRegion, location.lat, location.lng]);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    mapBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.shell,
    },
    locationPulse: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.brand + '30',
      borderWidth: 1,
      borderColor: colors.brand + '60',
    },
    locationDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.brand,
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    title: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.ink,
      textShadowColor: 'rgba(255,255,255,0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
      fontFamily: typography.heading,
    },
    subtitle: {
      fontSize: 16,
      color: colors.ink,
      fontWeight: '600',
      textShadowColor: 'rgba(255,255,255,0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
      fontFamily: typography.body,
    },
    floatingCard: {
      backgroundColor: colors.shell,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      ...shadows.lift,
      borderWidth: 1,
      borderColor: colors.stroke,
      zIndex: 10,
      position: Platform.OS === 'web' ? 'relative' : 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    cardSubtitle: {
      fontSize: 14,
      color: colors.inkMuted,
      marginTop: 4,
      fontFamily: typography.body,
    },
    categoryIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      ...shadows.soft,
    },
    categoryLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.ink,
      textAlign: 'center',
      fontFamily: typography.heading,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    cardTitleSmall: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    cardSubtitleSmall: {
      fontSize: 13,
      color: colors.brand,
      fontWeight: '700',
      fontFamily: typography.heading,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.stroke,
      marginBottom: 16,
      fontFamily: typography.body,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 12,
      fontFamily: typography.heading,
    },
    durationBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    durationBtnActive: {
      backgroundColor: colors.brand + '20',
      borderColor: colors.brand,
    },
    durationBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.inkMuted,
      fontFamily: typography.heading,
    },
    durationBtnTextActive: {
      color: colors.brand,
    },
    mainBtn: {
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.ink,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.soft,
    },
    mainBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    summaryBox: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.stroke,
      marginBottom: 20,
    },
    liveText: {
      fontSize: 10,
      fontWeight: '900',
      color: colors.danger,
      letterSpacing: 0.5,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 4,
      fontFamily: typography.heading,
    },
    summarySub: {
      fontSize: 14,
      color: colors.inkMuted,
      lineHeight: 20,
      fontFamily: typography.body,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.stroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    anonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.body,
    },
    successIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      ...shadows.lift,
      shadowColor: colors.success,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.ink,
      marginBottom: 8,
      fontFamily: typography.heading,
    },
    successText: {
      fontSize: 15,
      color: colors.inkMuted,
      textAlign: 'center',
      lineHeight: 22,
      fontFamily: typography.body,
      marginBottom: 20,
    },
    retryBtn: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    retryBtnText: {
      color: colors.brand,
      fontWeight: '700',
    }
  }), [colors, typography, shadows]);

  useEffect(() => {
    setLoadingOptions(true);
    setLoadError(false);
    getReportTypes()
      .then((types) => {
        if (types.length === 0) setLoadError(true);
        else setOptions(types);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoadingOptions(false));
  }, []);

  const canContinueDetails = useMemo(() => title.trim().length > 3, [title]);

  function resetForm() {
    setStep(1);
    setReportType(null);
    setTitle('');
    setDescription('');
    setDurationHours(4);
  }

  async function handleSubmit() {
    if (!reportType) return;
    setSubmitting(true);
    try {
      await createReport({
        reportType: reportType.id,
        title: title.trim(),
        description: description.trim(),
        durationHours,
        anonymous: postAnonymously || !user,
        lat: mapRegion.lat,
        lng: mapRegion.lng,
      });
      setStep(4);
    } catch (err) {
      Alert.alert(t('common.error'), t('report.submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatedTabScene>
      <View style={dynamicStyles.safe}>
        {/* Background Map Context */}
        <View style={dynamicStyles.mapBackground}>
          <Map
            region={mapRegion}
            onRegionChange={(lat, lng, latDelta, lngDelta) =>
              setMapRegion({ lat, lng, latDelta, lngDelta })
            }
            mapType={mapPreferences.mapStyle}
            gadoOverlay={mapPreferences.gadoOverlay}
            showZoomControls={false}
            selectedId={null}
          />
          {/* Centered crosshair */}
          {step === 1 && (
             <View style={styles.mapOverlay}>
                <View style={styles.locationPin}>
                   <View style={dynamicStyles.locationPulse} />
                   <View style={dynamicStyles.locationDot} />
                </View>
             </View>
          )}
        </View>

        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.content}>
            {step === 1 && (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
                <Text style={dynamicStyles.title}>{t('report.title')}</Text>
                <Text style={dynamicStyles.subtitle}>{t('report.subtitle')}</Text>
              </Animated.View>
            )}

            <View style={styles.spacer} />

            {/* Floating Interaction Card */}
            <Animated.View 
              layout={Layout.springify()}
              entering={SlideInDown.springify().damping(15)}
              style={[
                dynamicStyles.floatingCard,
                step === 1 ? styles.cardFull : styles.cardPartial
              ]}
            >
              {step === 1 && (
                <View style={styles.stepContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={dynamicStyles.cardTitle}>{t('report.whatsHappening')}</Text>
                    <Text style={dynamicStyles.cardSubtitle}>{t('report.categorySubtitle')}</Text>
                  </View>

                  {loadingOptions ? (
                    <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 40 }} />
                  ) : loadError ? (
                    <TouchableOpacity style={dynamicStyles.retryBtn} onPress={() => router.replace('/report')}>
                       <Text style={dynamicStyles.retryBtnText}>{t('report.retryTypes')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Animated.ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      {options.map((option, i) => (
                        <TouchableOpacity
                          key={option.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setReportType(option);
                            setStep(2);
                          }}
                          style={styles.categoryChip}
                        >
                          <View style={dynamicStyles.categoryIcon}>
                             <View style={{ backgroundColor: (option.color || colors.brand) + '15', borderRadius: 16, padding: 12 }}>
                               <WhimIcon name={option.id === 'report' ? 'report' : option.id} category="report" size={28} color={option.color || colors.brand} />
                             </View>
                          </View>
                          <Text style={dynamicStyles.categoryLabel}>{option.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </Animated.ScrollView>
                  )}
                </View>
              )}

              {step === 2 && (
                <View style={styles.stepContainer}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity onPress={() => setStep(1)} style={dynamicStyles.backBtn}>
                      <Ionicons name="chevron-back" size={20} color={colors.ink} />
                    </TouchableOpacity>
                    <View style={styles.headerTextGroup}>
                      <Text style={dynamicStyles.cardTitleSmall}>{t('report.details')}</Text>
                      <Text style={dynamicStyles.cardSubtitleSmall}>{reportType?.label}</Text>
                    </View>
                  </View>

                  <TextInput
                    style={dynamicStyles.input}
                    placeholder={t('report.titlePlaceholder')}
                    placeholderTextColor={colors.inkMuted}
                    value={title}
                    onChangeText={setTitle}
                    autoFocus
                  />
                  
                  <TextInput
                    style={[dynamicStyles.input, styles.textarea]}
                    placeholder={t('report.detailsPlaceholder')}
                    placeholderTextColor={colors.inkMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.durationSection}>
                     <Text style={dynamicStyles.sectionLabel}>{t('report.howLong')}</Text>
                     <View style={styles.durationGrid}>
                        {DURATIONS.map(d => (
                          <TouchableOpacity 
                            key={d.value}
                            onPress={() => setDurationHours(d.value)}
                            style={[dynamicStyles.durationBtn, durationHours === d.value && dynamicStyles.durationBtnActive]}
                          >
                            <Text style={[dynamicStyles.durationBtnText, durationHours === d.value && dynamicStyles.durationBtnTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                     </View>
                  </View>

                  <TouchableOpacity
                    style={[dynamicStyles.mainBtn, !canContinueDetails && { opacity: 0.4, borderColor: colors.stroke }]}
                    onPress={() => setStep(3)}
                    disabled={!canContinueDetails}
                  >
                    <Text style={dynamicStyles.mainBtnText}>{t('common.confirm')}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.ink} />
                  </TouchableOpacity>
                </View>
              )}

              {step === 3 && (
                <View style={styles.stepContainer}>
                   <View style={styles.cardHeaderRow}>
                    <TouchableOpacity onPress={() => setStep(2)} style={dynamicStyles.backBtn}>
                      <Ionicons name="chevron-back" size={20} color={colors.ink} />
                    </TouchableOpacity>
                    <View style={styles.headerTextGroup}>
                      <Text style={dynamicStyles.cardTitleSmall}>{t('report.confirmTitle')}</Text>
                      <Text style={dynamicStyles.cardSubtitleSmall}>{t('report.summarySubtitle')}</Text>
                    </View>
                  </View>

                  <View style={dynamicStyles.summaryBox}>
                     <View style={[styles.summaryBadge, { backgroundColor: colors.danger + '15' }]}>
                        <View style={[styles.livePulse, { backgroundColor: colors.danger }]} />
                        <Text style={dynamicStyles.liveText}>{t('common.live')} · {durationHours}h</Text>
                     </View>
                     <Text style={dynamicStyles.summaryTitle}>{title}</Text>
                     {description ? <Text style={dynamicStyles.summarySub}>{description}</Text> : null}
                  </View>

                  <TouchableOpacity 
                    style={styles.anonToggle}
                    onPress={() => setPostAnonymously(!postAnonymously)}
                  >
                    <View style={[dynamicStyles.checkbox, postAnonymously && dynamicStyles.checkboxActive]}>
                      {postAnonymously && <Ionicons name="checkmark" size={14} color={colors.ink} />}
                    </View>
                    <Text style={dynamicStyles.anonText}>{t('report.anonymous')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[dynamicStyles.mainBtn, { backgroundColor: colors.brand, borderColor: colors.brand }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <>
                        <Text style={dynamicStyles.mainBtnText}>{t('report.publishNow')}</Text>
                        <Ionicons name="send" size={16} color={colors.ink} style={{marginLeft: 8}} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {step === 4 && (
                <View style={styles.successStep}>
                  <View style={dynamicStyles.successIcon}>
                    <Ionicons name="checkmark" size={40} color={colors.ink} />
                  </View>
                  <Text style={dynamicStyles.successTitle}>{t('report.successTitle')}</Text>
                  <Text style={dynamicStyles.successText}>{t('report.success')}</Text>
                  <TouchableOpacity 
                    style={[dynamicStyles.mainBtn, { marginTop: 20, width: '100%' }]}
                    onPress={() => {
                      resetForm();
                      router.replace('/(tabs)');
                    }}
                  >
                    <Text style={dynamicStyles.mainBtnText}>{t('report.backToMap')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    </AnimatedTabScene>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  locationPin: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  spacer: {
    flex: 1,
  },
  cardFull: {
    minHeight: 320,
  },
  cardPartial: {
    minHeight: 440,
  },
  stepContainer: {
    flex: 1,
  },
  cardHeader: {
    marginBottom: 20,
  },
  categoryScroll: {
    paddingVertical: 10,
    gap: 16,
  },
  categoryChip: {
    width: 100,
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  headerTextGroup: {
    flex: 1,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  durationSection: {
    marginBottom: 24,
  },
  durationGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  successStep: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
