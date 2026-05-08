import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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

function getDefaultDeadlineTime(): string {
  const date = new Date(Date.now() + 120 * 60 * 1000);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTodayDateInput(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDateTime(dateInput: string, timeInput: string): Date | null {
  const dateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeInput.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(value.getTime())) return null;

  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day
  ) {
    return null;
  }

  return value;
}

type PublishValidation = {
  price?: string;
  originalPrice?: string;
  seats?: string;
  offerDate?: string;
  reservationDeadlineTime?: string;
  startTime?: string;
  endTime?: string;
  reservationRelation?: string;
  timeRelation?: string;
  startRelation?: string;
};

export default function PublishTab() {
  const { colors, typography } = useTheme();
  const { profile, getToken } = useAuth();

  const [price, setPrice] = useState('19.90');
  const [originalPrice, setOriginalPrice] = useState('29.90');
  const [seats, setSeats] = useState('2');
  const [offerDate, setOfferDate] = useState(getTodayDateInput());
  const [reservationDeadlineTime, setReservationDeadlineTime] = useState(getDefaultDeadlineTime());
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('23:00');
  const [description, setDescription] = useState('Mesa libre ahora mismo.');
  const [submitting, setSubmitting] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PublishValidation>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

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
        segmentedRow: {
          marginTop: 10,
          flexDirection: 'row',
          gap: 8,
          flexWrap: 'wrap',
        },
        segmentedBtn: {
          paddingHorizontal: 12,
          height: 34,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.shell,
          justifyContent: 'center',
          alignItems: 'center',
        },
        segmentedBtnActive: {
          borderColor: colors.brand,
          backgroundColor: 'rgba(34,197,94,0.15)',
        },
        segmentedText: {
          color: colors.ink,
          fontSize: 12,
          fontFamily: typography.body,
          fontWeight: '600',
        },
        textarea: {
          minHeight: 84,
          textAlignVertical: 'top',
        },
        helperText: {
          marginTop: 4,
          fontSize: 12,
          lineHeight: 17,
          color: colors.inkMuted,
          fontFamily: typography.body,
        },
        fieldError: {
          marginTop: 6,
          fontSize: 12,
          lineHeight: 17,
          color: '#DC2626',
          fontFamily: typography.body,
          fontWeight: '600',
        },
        warningPanel: {
          marginTop: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(245,158,11,0.35)',
          backgroundColor: 'rgba(245,158,11,0.08)',
          padding: 14,
          gap: 8,
        },
        warningHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        warningTitle: {
          color: colors.ink,
          fontSize: 14,
          fontWeight: '800',
          fontFamily: typography.heading,
        },
        warningBody: {
          color: colors.inkMuted,
          fontSize: 13,
          lineHeight: 19,
          fontFamily: typography.body,
        },
        issueList: {
          gap: 8,
          marginTop: 4,
        },
        issueRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
        },
        issueBullet: {
          width: 18,
          height: 18,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(220,38,38,0.12)',
          marginTop: 1,
        },
        issueText: {
          flex: 1,
          color: colors.ink,
          fontSize: 13,
          lineHeight: 18,
          fontFamily: typography.body,
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
        restaurantPhoto: {
          marginTop: 12,
          width: '100%',
          height: 180,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.stroke,
          backgroundColor: colors.shell,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        },
        modalCard: {
          width: '100%',
          maxWidth: 420,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderColor: colors.stroke,
          borderWidth: 1,
          padding: 18,
          gap: 10,
        },
        modalTitle: {
          color: colors.ink,
          fontSize: 20,
          fontWeight: '800',
          fontFamily: typography.heading,
        },
        modalText: {
          color: colors.inkMuted,
          fontSize: 14,
          lineHeight: 20,
          fontFamily: typography.body,
        },
      }),
    [colors, typography],
  );

  async function handlePublish() {
    const p = Number(price);
    const op = originalPrice.trim().length ? Number(originalPrice) : null;
    const seatCount = Number(seats);
    const nextErrors: PublishValidation = {};
    const dateInput = offerDate.trim();

    if (!Number.isFinite(p) || p <= 0) {
      nextErrors.price = 'El precio debe ser un número mayor que 0.';
    }

    if (originalPrice.trim().length && (!Number.isFinite(op) || (op != null && op <= 0))) {
      nextErrors.originalPrice = 'El precio original debe ser un número válido si lo rellenas.';
    }

    if (!Number.isFinite(seatCount) || seatCount <= 0) {
      nextErrors.seats = 'Indica al menos una mesa disponible.';
    }

    if (!dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
      nextErrors.offerDate = 'La fecha debe usar formato AAAA-MM-DD.';
    }

    if (!reservationDeadlineTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      nextErrors.reservationDeadlineTime = 'La hora máxima de reserva debe ir en formato HH:MM.';
    }

    if (!startTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      nextErrors.startTime = 'La hora de inicio debe ir en formato HH:MM.';
    }
    if (!endTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      nextErrors.endTime = 'La hora de fin debe ir en formato HH:MM.';
    }

    const reservationDeadlineAt = parseLocalDateTime(dateInput, reservationDeadlineTime.trim());
    const availableAt = parseLocalDateTime(dateInput, startTime.trim());
    const expiresAt = parseLocalDateTime(dateInput, endTime.trim());
    const now = new Date();

    if (!reservationDeadlineAt && !nextErrors.reservationDeadlineTime) {
      nextErrors.reservationDeadlineTime = 'No se pudo interpretar la hora máxima de reserva.';
    }

    if (!availableAt && !nextErrors.startTime) {
      nextErrors.startTime = 'No se pudo interpretar la fecha/hora de inicio.';
    }
    if (!expiresAt && !nextErrors.endTime) {
      nextErrors.endTime = 'No se pudo interpretar la fecha/hora de fin.';
    }

    if (
      reservationDeadlineAt &&
      availableAt &&
      reservationDeadlineAt.getTime() > availableAt.getTime()
    ) {
      nextErrors.reservationRelation = 'La hora máxima para aceptar reservas no puede ser posterior al inicio.';
    }

    if (availableAt && expiresAt && expiresAt.getTime() <= availableAt.getTime()) {
      nextErrors.timeRelation = 'La hora de fin debe ser posterior a la hora de inicio.';
    }

    if (availableAt && availableAt.getTime() <= now.getTime()) {
      nextErrors.startRelation = 'La hora de inicio debe ser posterior a la hora actual.';
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('Corrige los avisos marcados antes de publicar.');
      return;
    }

    setSubmitError(null);

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
          reservation_deadline_at: (reservationDeadlineAt as Date).toISOString(),
          expires_at: (expiresAt as Date).toISOString(),
          available_at: (availableAt as Date).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo publicar la oferta');
      }

      // Reset form
      setDescription('Mesa libre ahora mismo.');
      setPrice('19.90');
      setOriginalPrice('29.90');
      setSeats('2');
      setOfferDate(getTodayDateInput());
      setReservationDeadlineTime(getDefaultDeadlineTime());
      setStartTime('20:00');
      setEndTime('23:00');
      setFieldErrors({});
      setSubmitError(null);
      setPublishModalOpen(true);
    } catch (err: any) {
      const message = err?.message || 'Error publicando';
      setSubmitError(message);
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

                {profile?.restaurant_photo_url ? (
                  <Image
                    source={{ uri: profile.restaurant_photo_url }}
                    style={styles.restaurantPhoto}
                  />
                ) : null}

                <Text style={styles.label}>Precio actual (EUR)</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={(value) => {
                    setPrice(value);
                    if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: undefined }));
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="decimal-pad"
                />
                {fieldErrors.price ? <Text style={styles.fieldError}>{fieldErrors.price}</Text> : null}

                <Text style={styles.label}>Precio original (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={originalPrice}
                  onChangeText={(value) => {
                    setOriginalPrice(value);
                    if (fieldErrors.originalPrice) setFieldErrors((prev) => ({ ...prev, originalPrice: undefined }));
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="decimal-pad"
                />
                {fieldErrors.originalPrice ? <Text style={styles.fieldError}>{fieldErrors.originalPrice}</Text> : null}

                <Text style={styles.label}>Mesas disponibles</Text>
                <TextInput
                  style={styles.input}
                  value={seats}
                  onChangeText={(value) => {
                    setSeats(value);
                    if (fieldErrors.seats) setFieldErrors((prev) => ({ ...prev, seats: undefined }));
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="number-pad"
                />
                {fieldErrors.seats ? <Text style={styles.fieldError}>{fieldErrors.seats}</Text> : null}

                <Text style={styles.label}>Fecha de la oferta (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={offerDate}
                  onChangeText={(value) => {
                    setOfferDate(value);
                    if (fieldErrors.offerDate) setFieldErrors((prev) => ({ ...prev, offerDate: undefined }));
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Ej: 2026-05-10"
                  placeholderTextColor={colors.inkFaint}
                />
                {fieldErrors.offerDate ? <Text style={styles.fieldError}>{fieldErrors.offerDate}</Text> : null}

                <Text style={styles.label}>Hora maxima para aceptar reserva (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={reservationDeadlineTime}
                  onChangeText={(value) => {
                    setReservationDeadlineTime(value);
                    if (fieldErrors.reservationDeadlineTime || fieldErrors.reservationRelation) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        reservationDeadlineTime: undefined,
                        reservationRelation: undefined,
                      }));
                    }
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Ej: 19:45"
                  placeholderTextColor={colors.inkFaint}
                />
                {fieldErrors.reservationDeadlineTime ? <Text style={styles.fieldError}>{fieldErrors.reservationDeadlineTime}</Text> : null}
                {fieldErrors.reservationRelation ? <Text style={styles.fieldError}>{fieldErrors.reservationRelation}</Text> : null}

                <Text style={styles.label}>Hora de inicio (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={(value) => {
                    setStartTime(value);
                    if (fieldErrors.startTime || fieldErrors.timeRelation || fieldErrors.startRelation) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        startTime: undefined,
                        timeRelation: undefined,
                        startRelation: undefined,
                      }));
                    }
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Ej: 20:00"
                  placeholderTextColor={colors.inkFaint}
                />
                {fieldErrors.startTime ? <Text style={styles.fieldError}>{fieldErrors.startTime}</Text> : null}

                <Text style={styles.label}>Hora de fin (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={(value) => {
                    setEndTime(value);
                    if (fieldErrors.endTime || fieldErrors.timeRelation) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        endTime: undefined,
                        timeRelation: undefined,
                      }));
                    }
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Ej: 23:30"
                  placeholderTextColor={colors.inkFaint}
                />
                <Text style={styles.helperText}>
                  La oferta se considera finalizada al llegar a la hora de fin si no se reporta ninguna incidencia.
                </Text>
                {fieldErrors.endTime ? <Text style={styles.fieldError}>{fieldErrors.endTime}</Text> : null}
                {fieldErrors.timeRelation ? <Text style={styles.fieldError}>{fieldErrors.timeRelation}</Text> : null}
                {fieldErrors.startRelation ? <Text style={styles.fieldError}>{fieldErrors.startRelation}</Text> : null}

                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Ej: Menú degustación con descuento hasta las 22:00"
                  placeholderTextColor={colors.inkFaint}
                />

                <View style={styles.warningPanel}>
                  <View style={styles.warningHeader}>
                    <Text style={{ fontSize: 18 }}>⚠️</Text>
                    <Text style={styles.warningTitle}>Antes de publicar</Text>
                  </View>
                  <Text style={styles.warningBody}>
                    Si la oferta no cumple alguna restricción, el botón te mostrará el motivo exacto en esta pantalla.
                  </Text>
                  <View style={styles.issueList}>
                    <View style={styles.issueRow}>
                      <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                      <Text style={styles.issueText}>Precio y mesas deben ser válidos.</Text>
                    </View>
                    <View style={styles.issueRow}>
                      <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                      <Text style={styles.issueText}>La hora de fin debe ser posterior a la de inicio.</Text>
                    </View>
                    <View style={styles.issueRow}>
                      <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                      <Text style={styles.issueText}>La hora maxima de reserva no puede ser posterior al inicio.</Text>
                    </View>
                    <View style={styles.issueRow}>
                      <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                      <Text style={styles.issueText}>La fecha debe ir en formato AAAA-MM-DD.</Text>
                    </View>
                    <View style={styles.issueRow}>
                      <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                      <Text style={styles.issueText}>Si el backend rechaza la oferta, verás el mensaje exacto aquí.</Text>
                    </View>
                  </View>
                </View>

                {submitError ? (
                  <View style={{ marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.18)' }}>
                    <Text style={{ color: '#B91C1C', fontSize: 13, fontFamily: typography.body, fontWeight: '700' }}>
                      {submitError}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.button} onPress={handlePublish} disabled={submitting} activeOpacity={0.8}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Publicar ahora</Text>}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={publishModalOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setPublishModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reserva confirmada</Text>
              <Text style={styles.modalText}>
                Tu oferta se ha publicado correctamente y ya esta visible para reservar.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setPublishModalOpen(false);
                  router.replace('/(tabs)');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Ver en el mapa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => setPublishModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.ghostButtonText}>Seguir publicando</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}
