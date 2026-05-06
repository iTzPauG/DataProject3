import { useTranslation } from "react-i18next";
import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../utils/theme';

export default function LoginModal() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 32,
    },
    closeButton: {
      alignSelf: 'flex-start',
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    closeIcon: {
      fontSize: 14,
      color: colors.ink,
      lineHeight: 18,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 8,
      fontFamily: typography.heading,
    },
    subtitle: {
      fontSize: 16,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    form: {
      gap: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 54,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.ink,
      fontFamily: typography.body,
    },
    primaryButton: {
      backgroundColor: colors.brand,
      borderRadius: 12,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    disabledButton: {
      opacity: 0.7,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFF',
      fontFamily: typography.heading,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: '#E5E5EA',
    },
    dividerText: {
      marginHorizontal: 10,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    googleButton: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      borderRadius: 12,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 32,
    },
    footerText: {
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    linkText: {
      color: colors.brand,
      fontWeight: '700',
      fontFamily: typography.heading,
    },
  }), [colors, typography]);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.fillFields'));
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errorLogin'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errorGoogle'));
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('auth.welcome')}</Text>
            <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.signIn')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>{t('auth.or')}</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#1C1C1E" style={{ marginRight: 10 }} />
              <Text style={styles.googleButtonText}>{t('auth.googleSignIn')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.dontHaveAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(modals)/register')}>
              <Text style={styles.linkText}>{t('auth.register')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
