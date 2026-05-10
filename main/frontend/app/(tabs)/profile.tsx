import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Icon, { IconName } from '../../components/Icon';
import { monogramFor } from '../../constants/design';
import { useAuth } from '../../hooks/useAuth';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';
import { resolveAccountName, resolveGreetingName } from '../../utils/account';
import DirectorDashboardPage from '../(views)/director-dashboard';

const { width, height } = Dimensions.get('window');

interface MenuEntry {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  route?: string;
}

export default function ProfileTab() {
  const { colors, typography } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile, signOut, getToken, refreshProfile } = useAuth();
  const [uploadingRestaurantPhoto, setUploadingRestaurantPhoto] = React.useState(false);
  const [showDirectorPanel, setShowDirectorPanel] = React.useState(false);

  const DIRECTOR_UIDS = ['5duJR57R28cOaVgKQBv9EyAClXp2'];
  const DIRECTOR_EMAILS = ['director@whim.app'];
  const normalizedRole = String(profile?.role ?? '').toLowerCase().trim();
  const normalizedEmail = String(user?.email ?? '').toLowerCase().trim();
  const looksLikeDirectorEmail = normalizedEmail.startsWith('director@') || normalizedEmail.endsWith('@whim.app');
  const isDirector = (
    normalizedRole === 'director'
    || normalizedRole === 'admin'
    || DIRECTOR_UIDS.includes(user?.uid ?? '')
    || DIRECTOR_EMAILS.includes(normalizedEmail)
    || looksLikeDirectorEmail
  );

  const profileDesc = useMemo(() => {
    const variations = t("profile_variations", { returnObjects: true });
    if (Array.isArray(variations) && variations.length > 0) {
      return variations[Math.floor(Math.random() * variations.length)];
    }
    return t("profile.dossier");
  }, [t]);

  // Mesh gradient animation values
  const blob1X = useSharedValue(width * 0.4);
  const blob1Y = useSharedValue(-height * 0.1);
  const blob2X = useSharedValue(-width * 0.2);
  const blob2Y = useSharedValue(height * 0.5);

  useEffect(() => {
    blob1X.value = withRepeat(withTiming(width * 0.1, { duration: 20000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob1Y.value = withRepeat(withTiming(height * 0.2, { duration: 18000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob2X.value = withRepeat(withTiming(width * 0.3, { duration: 22000, easing: Easing.inOut(Easing.ease) }), -1, true);
    blob2Y.value = withRepeat(withTiming(height * 0.2, { duration: 25000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob1X.value }, { translateY: blob1Y.value }],
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: blob2X.value }, { translateY: blob2Y.value }],
  }));

  const MENU: MenuEntry[] = useMemo(
    () => [
      {
        id: 'saved',
        label: t('profile.menu.saved'),
        description: t('profile.menu.savedDesc'),
        icon: 'bookmark',
        route: '/(modals)/saved-items',
      },
      {
        id: 'settings',
        label: t('profile.menu.settings'),
        description: t('profile.menu.settingsDesc'),
        icon: 'sliders',
      },
      ...(user ? [{
        id: 'director',
        label: 'Panel Directivos',
        description: 'Métricas y gestión de la plataforma',
        icon: 'chart' as const,
      }] : []),
    ],
    [t, user],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        scrollContent: { paddingBottom: 64 },
        container: {
          flex: 1,
          maxWidth: 620,
          width: '100%',
          alignSelf: 'center',
        },

        blob: {
          position: 'absolute',
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: width * 0.4,
          opacity: 0.15,
        },

        // ── masthead ────────────────────────────────────────────
        masthead: {
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 20,
        },
        eyebrow: {
          fontSize: 11,
          letterSpacing: 2.4,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
          marginBottom: 14,
        },
        nameDisplay: {
          fontSize: 40,
          lineHeight: 44,
          letterSpacing: -1.2,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
        },
        nameItalic: {
          fontStyle: 'italic',
          color: colors.brand,
          fontWeight: '500',
        },
        email: {
          marginTop: 12,
          fontSize: 13,
          color: colors.inkMuted,
          fontFamily: typography.mono,
          letterSpacing: 0.1,
        },

        rule: {
          marginHorizontal: 24,
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.stroke,
        },

        // ── stats ──────────────────────────────────────────────
        statsRow: {
          flexDirection: 'row',
          paddingHorizontal: 24,
          paddingVertical: 24,
          gap: 32,
        },
        stat: { flex: 1 },
        statLabel: {
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
          marginBottom: 6,
        },
        statValue: {
          fontSize: 30,
          lineHeight: 34,
          letterSpacing: -0.8,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
        },
        statHint: {
          marginTop: 4,
          fontSize: 12,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },

        // ── menu ───────────────────────────────────────────────
        menuSection: { marginTop: 8 },
        menuRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          paddingHorizontal: 24,
          paddingVertical: 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
        },
        menuRowLast: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.stroke,
        },
        menuGlyph: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
        },
        menuText: { flex: 1, gap: 3 },
        menuLabel: {
          fontSize: 16,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
          letterSpacing: -0.2,
        },
        menuDesc: {
          fontSize: 13,
          color: colors.inkMuted,
          fontFamily: typography.body,
          lineHeight: 18,
        },

        // ── sign out ───────────────────────────────────────────
        signOut: {
          marginTop: 36,
          marginHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
        },
        signOutText: {
          fontSize: 13,
          letterSpacing: 0.4,
          color: colors.danger,
          fontFamily: typography.body,
          fontWeight: '600',
        },

        // ── guest ──────────────────────────────────────────────
        guest: {
          marginHorizontal: 24,
          marginTop: 8,
          marginBottom: 16,
          borderRadius: 20,
          overflow: 'hidden',
        },
        guestBlur: {
          paddingVertical: 26,
          paddingHorizontal: 24,
          backgroundColor: 'rgba(24, 26, 35, 0.4)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          gap: 14,
        },
        guestEyebrow: {
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
        },
        guestTitle: {
          fontSize: 22,
          lineHeight: 28,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
          letterSpacing: -0.4,
        },
        guestBody: {
          fontSize: 14,
          lineHeight: 21,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        guestButton: {
          marginTop: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: colors.ink,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        guestButtonText: {
          fontSize: 13,
          color: colors.shell,
          fontFamily: typography.body,
          fontWeight: '600',
          letterSpacing: 0.2,
        },

        // ── avatar ─────────────────────────────────────────────
        avatarRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          marginTop: 12,
        },
        avatar: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.strokeStrong,
          backgroundColor: colors.bg,
        },
        avatarImage: { width: 56, height: 56, borderRadius: 28 },
        avatarInitial: {
          fontSize: 22,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
        },
        businessCard: {
          marginHorizontal: 24,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.stroke,
          paddingTop: 18,
          gap: 12,
        },
        businessTitle: {
          fontSize: 13,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: colors.inkFaint,
          fontFamily: typography.body,
          fontWeight: '600',
        },
        businessName: {
          fontSize: 18,
          color: colors.ink,
          fontFamily: typography.heading,
          fontWeight: '500',
        },
        restaurantImage: {
          width: '100%',
          height: 180,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.bg,
        },
        photoUploadBtn: {
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.strokeStrong,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        photoUploadText: {
          fontSize: 13,
          color: colors.ink,
          fontFamily: typography.body,
          fontWeight: '600',
        },

        // ── footer ─────────────────────────────────────────────
        footer: {
          alignItems: 'flex-start',
          paddingHorizontal: 24,
          marginTop: 48,
          gap: 4,
        },
        footerMark: {
          fontSize: 11,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: colors.inkWhisper,
          fontFamily: typography.heading,
          fontWeight: '600',
        },
        footerVersion: {
          fontSize: 11,
          color: colors.inkWhisper,
          fontFamily: typography.mono,
        },
      }),
    [colors, typography],
  );

  function handleSignIn() {
    router.push('/(modals)/login');
  }

  function handleMenuPress(item: MenuEntry) {
    if (item.id === 'director') {
      setShowDirectorPanel(true);
      return;
    }
    if (!user && item.id !== 'settings') {
      Alert.alert(t('profile.restrictedAccess'), t('profile.restrictedAccessMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.signIn'), onPress: handleSignIn },
      ]);
      return;
    }
    if (item.route) {
      router.push(item.route as any);
    } else {
      router.push('/(modals)/settings');
    }
  }

  function handleSignOut() {
    if (typeof window !== 'undefined') {
      if (window.confirm(t('profile.signOutConfirm'))) signOut();
      return;
    }
    Alert.alert(t('auth.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.exit'), style: 'destructive', onPress: signOut },
    ]);
  }

  async function handleRestaurantPhotoUpload() {
    if (!user || !profile || profile.role !== 'business') return;

    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;
      const asset = pickerResult.assets[0];

      setUploadingRestaurantPhoto(true);
      const form = new FormData();
      const fileName = asset.fileName || 'restaurant-photo.jpg';
      const mimeType = asset.mimeType || 'image/jpeg';

      if (Platform.OS === 'web') {
        const blob = await fetch(asset.uri).then((res) => res.blob());
        form.append('file', blob, fileName);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      const token = await getToken();
      const res = await fetch(`${BASE_URL}/auth/restaurant/photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? 'local-token'}`,
        },
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || t('profile.photoUploadError'));
      }

      await refreshProfile();
      Alert.alert(t('profile.photoUpdatedTitle'), t('profile.photoUpdatedBody'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('profile.photoUploadError'));
    } finally {
      setUploadingRestaurantPhoto(false);
    }
  }

  // Single source of truth for "what name should we show?".
  // For business accounts this returns the restaurant brand name (e.g. "La Pepica")
  // instead of the truncated personal display_name (which previously rendered as "La.").
  const displayName = resolveAccountName(profile, user) || t('profile.guest');
  const firstName = resolveGreetingName(profile, user) || displayName;

  const guestTitleParts = t('profile.guestTitle').split(',');
  const guestTitleMain = guestTitleParts[0];
  const guestTitleSub = guestTitleParts[1]?.trim() || '';

  return (
    <>
      <View style={StyleSheet.absoluteFillObject}>
        <Animated.View style={[styles.blob, { backgroundColor: colors.brandDeep }, blob1Style]} />
        <Animated.View style={[styles.blob, { backgroundColor: colors.accent, width: width * 1.1, height: width * 1.1 }, blob2Style]} />
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      </View>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.masthead}>
              <Text style={styles.eyebrow}>{profileDesc}</Text>
              {user ? (
                <>
                  <Text style={styles.nameDisplay}>
                    {t('profile.greeting')}{'\n'}
                    <Text style={styles.nameItalic}>{firstName}.</Text>
                  </Text>
                  <View style={styles.avatarRow}>
                    <View style={styles.avatar}>
                      {profile?.avatar_url ? (
                        <Image
                          source={{ uri: profile.avatar_url }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Text style={styles.avatarInitial}>
                          {monogramFor(displayName)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.email}>{user.email}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.nameDisplay}>
                  {guestTitleMain},{'\n'}
                  <Text style={styles.nameItalic}>{guestTitleSub}</Text>
                </Text>
              )}
            </View>

            {user ? (
              <>
                <View style={styles.rule} />
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>{t('profile.reputation')}</Text>
                    <Text style={styles.statValue}>
                      {profile?.reputation_score ?? 0}
                    </Text>
                    <Text style={styles.statHint}>
                      {t('profile.reputationHint')}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>{t('profile.reports')}</Text>
                    <Text style={styles.statValue}>
                      {profile?.reports_count ?? 0}
                    </Text>
                    <Text style={styles.statHint}>
                      {t('profile.reportsHint')}
                    </Text>
                  </View>
                </View>

                {profile?.role === 'business' ? (
                  <View style={styles.businessCard}>
                    <Text style={styles.businessTitle}>{t('profile.restaurantPhotoTitle')}</Text>
                    <Text style={styles.businessName}>{profile.restaurant_name || t('profile.restaurantFallback')}</Text>
                    {profile.restaurant_photo_url ? (
                      <Image source={{ uri: profile.restaurant_photo_url }} style={styles.restaurantImage} />
                    ) : null}
                    <TouchableOpacity
                      style={styles.photoUploadBtn}
                      onPress={handleRestaurantPhotoUpload}
                      activeOpacity={0.8}
                      disabled={uploadingRestaurantPhoto}
                    >
                      {uploadingRestaurantPhoto ? <ActivityIndicator size="small" color={colors.ink} /> : null}
                      <Text style={styles.photoUploadText}>
                        {uploadingRestaurantPhoto ? t('profile.photoUploading') : t('profile.photoUploadCta')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.guest}>
                <BlurView intensity={40} tint="dark" style={styles.guestBlur}>
                  <Text style={styles.guestEyebrow}>{t('profile.access')}</Text>
                  <Text style={styles.guestTitle}>
                    {t('profile.guestSubtitle')}
                  </Text>
                  <Text style={styles.guestBody}>
                    {t('profile.guestBody')}
                  </Text>
                  <TouchableOpacity
                    style={styles.guestButton}
                    activeOpacity={0.8}
                    onPress={handleSignIn}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.signIn')}
                  >
                    <Text style={styles.guestButtonText}>{t('auth.signIn')}</Text>
                    <Icon
                      name="arrow-right"
                      size={13}
                      color={colors.shell}
                      strokeWidth={1.4}
                    />
                  </TouchableOpacity>
                </BlurView>
              </View>
            )}

            <View style={styles.menuSection}>
              {MENU.map((item, i) => {
                const isLast = i === MENU.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuRow, isLast && styles.menuRowLast]}
                    activeOpacity={0.6}
                    onPress={() => handleMenuPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <View style={styles.menuGlyph}>
                      <Icon
                        name={item.icon}
                        size={20}
                        color={colors.ink}
                        strokeWidth={1.4}
                      />
                    </View>
                    <View style={styles.menuText}>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      <Text style={styles.menuDesc}>{item.description}</Text>
                    </View>
                    <Icon
                      name="chevron-right"
                      size={14}
                      color={colors.inkWhisper}
                      strokeWidth={1.4}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {user ? (
              <TouchableOpacity
                style={styles.signOut}
                onPress={handleSignOut}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('auth.signOut')}
              >
                <Icon
                  name="logout"
                  size={16}
                  color={colors.danger}
                  strokeWidth={1.4}
                />
                <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerMark}>G·A·D·O</Text>
              <Text style={styles.footerVersion}>{t('profile.version')}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showDirectorPanel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDirectorPanel(false)}
      >
        <DirectorDashboardPage
          onClose={() => setShowDirectorPanel(false)}
          alreadyAuthenticated={isDirector}
        />
      </Modal>
    </AnimatedTabScene>
    </>
  );
}

