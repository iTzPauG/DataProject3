import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import Icon, { IconName } from '../../components/Icon';
import { monogramFor } from '../../constants/design';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../utils/theme';

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
  const { user, profile, signOut } = useAuth();

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
    ],
    [t],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.shell },
        scrollContent: { paddingBottom: 64 },
        container: {
          flex: 1,
          maxWidth: 620,
          width: '100%',
          alignSelf: 'center',
        },

        // ── masthead ────────────────────────────────────────────
        masthead: {
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 20,
        },
        eyebrow: {
          fontSize: 11,
          letterSpacing: 2.2,
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
          paddingVertical: 26,
          paddingHorizontal: 24,
          backgroundColor: colors.bg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.strokeStrong,
          borderRadius: 18,
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

  const displayName = profile?.display_name || user?.email?.split('@')[0] || t('profile.guest');
  const firstName = displayName.split(/[\s@]/)[0];

  const guestTitleParts = t('profile.guestTitle').split(',');
  const guestTitleMain = guestTitleParts[0];
  const guestTitleSub = guestTitleParts[1]?.trim() || '';

  return (
    <AnimatedTabScene>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.masthead}>
              <Text style={styles.eyebrow}>{t('profile.dossier')}</Text>
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
              </>
            ) : (
              <View style={styles.guest}>
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
    </AnimatedTabScene>
  );
}

