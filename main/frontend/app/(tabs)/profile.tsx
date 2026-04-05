import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../utils/theme';

interface ProfileMenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  route?: string;
}

const MENU_ITEMS: ProfileMenuItem[] = [
  {
    id: 'saved',
    label: 'Guardados',
    icon: 'bookmark-outline',
    description: 'Lugares y eventos favoritos',
    route: '/(modals)/saved-items',
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: 'settings-outline',
    description: 'Preferencias y notificaciones',
  },
];

export default function ProfileTab() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    container: {
      flex: 1,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    avatarSection: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 24,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.chip,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    userName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 12,
      fontFamily: typography.heading,
    },
    guestName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 4,
      fontFamily: typography.heading,
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 24,
      marginBottom: 20,
      width: '100%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 2,
      fontFamily: typography.heading,
    },
    statLabel: {
      fontSize: 12,
      color: colors.inkMuted,
      fontWeight: '600',
      fontFamily: typography.body,
    },
    statDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.chip,
    },
    signOutButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    signOutText: {
      fontSize: 14,
      color: '#D6453D',
      fontWeight: '600',
      fontFamily: typography.heading,
    },

    guestSubtitle: {
      fontSize: 14,
      color: colors.inkMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 18,
      fontFamily: typography.body,
    },
    signInButton: {
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingHorizontal: 32,
      paddingVertical: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#FF6B35',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
        default: {
          shadowColor: '#FF6B35',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        },
      }),
    },
    signInText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: typography.heading,
    },
    menuSection: {
      marginHorizontal: 18,
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
      }),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#F2F2F7',
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: '#FFF5F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    menuContent: {
      flex: 1,
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.ink,
      marginBottom: 2,
      fontFamily: typography.heading,
    },
    menuDescription: {
      fontSize: 13,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    appInfo: {
      alignItems: 'center',
      marginTop: 36,
    },
    appName: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.inkMuted,
      letterSpacing: 4,
      fontFamily: typography.heading,
    },
    appVersion: {
      fontSize: 12,
      color: colors.inkMuted,
      marginTop: 2,
      fontFamily: typography.body,
    },
  }), [colors, typography]);

  function handleSignIn() {
    router.push('/(modals)/login');
  }

  function handleMenuPress(item: ProfileMenuItem) {
    if (!user && item.id !== 'settings') {
      Alert.alert('Acceso restringido', 'Inicia sesión para ver esta sección', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar sesión', onPress: handleSignIn },
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
      if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        signOut();
      }
      return;
    }
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <AnimatedTabScene>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Perfil</Text>
          </View>

          {/* Avatar / Sign-in section */}
          <View style={styles.avatarSection}>
            {user ? (
              <>
                <View style={styles.avatarCircle}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={40} color="#C7C7CC" />
                  )}
                </View>
                <Text style={styles.userName}>{profile?.display_name || user.email}</Text>
                
                <View style={styles.statsContainer}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{profile?.reputation_score ?? 0}</Text>
                    <Text style={styles.statLabel}>Reputación</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{profile?.reports_count ?? 0}</Text>
                    <Text style={styles.statLabel}>Reportes</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                >
                  <Text style={styles.signOutText}>Cerrar sesión</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={40} color="#C7C7CC" />
                </View>
                <Text style={styles.guestName}>Invitado</Text>
                <Text style={styles.guestSubtitle}>
                  Inicia sesión para guardar tus lugares favoritos y contribuir a la comunidad
                </Text>
                <TouchableOpacity
                  style={styles.signInButton}
                  activeOpacity={0.8}
                  onPress={handleSignIn}
                  accessibilityLabel="Iniciar sesión"
                  accessibilityRole="button"
                >
                  <Text style={styles.signInText}>Iniciar sesión</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Menu items */}
          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index === MENU_ITEMS.length - 1 && styles.menuItemLast,
                ]}
                activeOpacity={0.6}
                onPress={() => handleMenuPress(item)}
                accessibilityLabel={item.label}
                accessibilityRole="button"
              >
                <View style={styles.menuIconWrap}>
                  <Ionicons name={item.icon} size={22} color="#FF6B35" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
              </TouchableOpacity>
            ))}
          </View>

          {/* App info */}
          <View style={styles.appInfo}>
            <Text style={styles.appName}>GADO</Text>
            <Text style={styles.appVersion}>v1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </AnimatedTabScene>
  );
}

