import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
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
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useAuth } from '../../hooks/useAuth';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';

export default function PublishTab() {
  const { colors, typography } = useTheme();
  const { profile, getToken } = useAuth();

  const [price, setPrice] = useState('19.90');
  const [originalPrice, setOriginalPrice] = useState('29.90');
  const [seats, setSeats] = useState('2');
  const [minutes, setMinutes] = useState('120');
  const [description, setDescription] = useState('Mesa libre ahora mismo.');
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.shell },
        scroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 48 },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.ink,
          fontFamily: typography.heading,
        },
        subtitle: {
          marginTop: 8,
          fontSize: 14,
          lineHeight: 20,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        card: {
          marginTop: 20,
          backgroundColor: colors.surface,
          borderColor: colors.stroke,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
          gap: 8,
        },
        label: {
          marginTop: 10,
          fontSize: 12,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        input: {
          backgroundColor: colors.shell,
          borderColor: colors.stroke,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.ink,
          fontFamily: typography.body,
        },
        textarea: {
          minHeight: 84,
          textAlignVertical: 'top',
        },
        button: {
          marginTop: 22,
          backgroundColor: colors.brand,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          height: 50,
        },
        buttonText: {
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: '700',
          fontFamily: typography.heading,
        },
        ghostButton: {
          marginTop: 14,
          borderWidth: 1,
          borderColor: colors.stroke,
          borderRadius: 12,
          height: 46,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ghostButtonText: {
          color: colors.ink,
          fontSize: 14,
          fontFamily: typography.body,
          fontWeight: '600',
        },
        badge: {
          marginTop: 14,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.chip,
        },
        badgeText: {
          color: colors.ink,
          fontSize: 12,
          fontFamily: typography.mono,
          fontWeight: '700',
        },
      }),
    [colors, typography],
  );

  async function handlePublish() {
    const p = Number(price);
    const op = originalPrice.trim().length ? Number(originalPrice) : null;
    const seatCount = Number(seats);
    const expiresIn = Number(minutes);

    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(seatCount) || seatCount <= 0) {
      Alert.alert('Datos inválidos', 'Revisa precio y número de mesas.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? 'local-token'}`,
        },
        body: JSON.stringify({
          price: p,
          original_price: op,
          seats: seatCount,
          description,
          expires_in_minutes: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 120,
          available_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'No se pudo publicar la oferta');

      // Reset form
      setDescription('Mesa libre ahora mismo.');
      setPrice('19.90');
      setOriginalPrice('29.90');
      setSeats('2');
      setMinutes('120');

      // Feedback + redirect to map
      Alert.alert(
        '¡Anuncio publicado! 🔥',
        'Tu oferta ya está visible en el mapa en tiempo real.',
        [{ text: 'Ver en el mapa', onPress: () => router.replace('/(tabs)') }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error publicando');
    } finally {
      setSubmitting(false);
    }
  }

  const isBusiness = profile?.role === 'business';

  return (
    <AnimatedTabScene>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Publicar mesa libre</Text>
            <Text style={styles.subtitle}>
              Publica mesas de última hora y se mostrarán automáticamente en el mapa de los usuarios.
            </Text>

            {!isBusiness ? (
              <View style={styles.card}>
                <Text style={styles.subtitle}>
                  Esta pestaña es solo para cuentas de restaurante verificadas.
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.push('/(modals)/register-business')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>Verificar restaurante</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{profile?.restaurant_name || 'Restaurante verificado'}</Text>
                </View>

                <Text style={styles.label}>Precio actual (EUR)</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Precio original (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={originalPrice}
                  onChangeText={setOriginalPrice}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Mesas disponibles</Text>
                <TextInput
                  style={styles.input}
                  value={seats}
                  onChangeText={setSeats}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Caduca en (minutos)</Text>
                <TextInput
                  style={styles.input}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Ej: Menú degustación con descuento hasta las 22:00"
                  placeholderTextColor={colors.inkFaint}
                />

                <TouchableOpacity style={styles.button} onPress={handlePublish} disabled={submitting} activeOpacity={0.8}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Publicar ahora</Text>}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}
