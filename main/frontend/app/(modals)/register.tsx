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

export default function RegisterModal() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      marginBottom: 20,
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

  async function handleRegister() {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), t('auth.fillFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.passwordsDontMatch'));
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName || undefined);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('auth.errorRegister'));
    } finally {
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
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('auth.createAccount')}</Text>
            <Text style={styles.subtitle}>{t('auth.signUpSubtitle') || "Únete a la comunidad de WHIM"}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.inkMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                placeholderTextColor={colors.inkMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.inkMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.usernameOptional')}
                placeholderTextColor={colors.inkMuted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.inkMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                placeholderTextColor={colors.inkMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.inkMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.confirmPassword')}
                placeholderTextColor={colors.inkMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('auth.signUp')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.alreadyHaveAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(modals)/login')}>
              <Text style={styles.linkText}>{t('auth.signIn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
