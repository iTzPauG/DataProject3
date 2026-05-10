import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { profile, getToken } = useAuth();

  const [price, setPrice] = useState('19.90');
  const [originalPrice, setOriginalPrice] = useState('29.90');
  const [seats, setSeats] = useState('2');
  const [offerDate, setOfferDate] = useState(getTodayDateInput());
  const [reservationDeadlineTime, setReservationDeadlineTime] = useState(getDefaultDeadlineTime());
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('23:00');
  const [description, setDescription] = useState(() => t('publish.defaultDescription'));
  const [submitting, setSubmitting] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PublishValidation>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeIssues = useMemo(
    () => Object.values(fieldErrors).filter((value): value is string => Boolean(value)),
    [fieldErrors],
  );

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
      nextErrors.price = t('publish.errors.price');
    }

    if (originalPrice.trim().length && (!Number.isFinite(op) || (op != null && op <= 0))) {
      nextErrors.originalPrice = t('publish.errors.originalPrice');
    }

    if (!Number.isFinite(seatCount) || seatCount <= 0) {
      nextErrors.seats = t('publish.errors.seats');
    }

    if (!dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
      nextErrors.offerDate = t('publish.errors.offerDate');
    }

    if (!reservationDeadlineTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      nextErrors.reservationDeadlineTime = t('publish.errors.reservationDeadlineTime');
    }

    if (!startTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      nextErrors.startTime = t('publish.errors.startTime');
    }
    if (!endTime.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      nextErrors.endTime = t('publish.errors.endTime');
    }

    const reservationDeadlineAt = parseLocalDateTime(dateInput, reservationDeadlineTime.trim());
    const availableAt = parseLocalDateTime(dateInput, startTime.trim());
    const expiresAt = parseLocalDateTime(dateInput, endTime.trim());
    const now = new Date();

    if (!reservationDeadlineAt && !nextErrors.reservationDeadlineTime) {
      nextErrors.reservationDeadlineTime = t('publish.errors.reservationDeadlineParse');
    }

    if (!availableAt && !nextErrors.startTime) {
      nextErrors.startTime = t('publish.errors.startParse');
    }
    if (!expiresAt && !nextErrors.endTime) {
      nextErrors.endTime = t('publish.errors.endParse');
    }

    if (
      reservationDeadlineAt &&
      availableAt &&
      reservationDeadlineAt.getTime() > availableAt.getTime()
    ) {
      nextErrors.reservationRelation = t('publish.errors.reservationRelation');
    }

    if (availableAt && expiresAt && expiresAt.getTime() <= availableAt.getTime()) {
      nextErrors.timeRelation = t('publish.errors.timeRelation');
    }

    if (availableAt && availableAt.getTime() <= now.getTime()) {
      nextErrors.startRelation = t('publish.errors.startRelation');
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError(null);
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
        throw new Error(data.detail || t('publish.errors.publish'));
      }

      // Reset form
      setDescription(t('publish.defaultDescription'));
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
      const message = err?.message || t('publish.errors.publishGeneric');
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
            <Text style={styles.title}>{t('publish.title')}</Text>
            <Text style={styles.subtitle}>
              {t('publish.subtitle')}
            </Text>

            {!isBusiness ? (
              <View style={styles.card}>
                <Text style={styles.subtitle}>
                  {t('publish.restrictedBody')}
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.push('/(modals)/register-business')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>{t('publish.verifyRestaurant')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{profile?.restaurant_name || t('publish.verifiedRestaurant')}</Text>
                </View>

                {profile?.restaurant_photo_url ? (
                  <Image
                    source={{ uri: profile.restaurant_photo_url }}
                    style={styles.restaurantPhoto}
                  />
                ) : null}

                <Text style={styles.label}>{t('publish.currentPrice')}</Text>
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

                <Text style={styles.label}>{t('publish.originalPrice')}</Text>
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

                <Text style={styles.label}>{t('publish.availableTables')}</Text>
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

                <Text style={styles.label}>{t('publish.offerDate')}</Text>
                <TextInput
                  style={styles.input}
                  value={offerDate}
                  onChangeText={(value) => {
                    setOfferDate(value);
                    if (fieldErrors.offerDate) setFieldErrors((prev) => ({ ...prev, offerDate: undefined }));
                    if (submitError) setSubmitError(null);
                  }}
                  keyboardType="numbers-and-punctuation"
                  placeholder={t('publish.offerDatePlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                />
                {fieldErrors.offerDate ? <Text style={styles.fieldError}>{fieldErrors.offerDate}</Text> : null}

                <Text style={styles.label}>{t('publish.deadlineTime')}</Text>
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
                  placeholder={t('publish.deadlinePlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                />
                {fieldErrors.reservationDeadlineTime ? <Text style={styles.fieldError}>{fieldErrors.reservationDeadlineTime}</Text> : null}
                {fieldErrors.reservationRelation ? <Text style={styles.fieldError}>{fieldErrors.reservationRelation}</Text> : null}

                <Text style={styles.label}>{t('publish.startTime')}</Text>
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
                  placeholder={t('publish.startPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                />
                {fieldErrors.startTime ? <Text style={styles.fieldError}>{fieldErrors.startTime}</Text> : null}

                <Text style={styles.label}>{t('publish.endTime')}</Text>
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
                  placeholder={t('publish.endPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                />
                <Text style={styles.helperText}>
                  {t('publish.endHelper')}
                </Text>
                {fieldErrors.endTime ? <Text style={styles.fieldError}>{fieldErrors.endTime}</Text> : null}
                {fieldErrors.timeRelation ? <Text style={styles.fieldError}>{fieldErrors.timeRelation}</Text> : null}
                {fieldErrors.startRelation ? <Text style={styles.fieldError}>{fieldErrors.startRelation}</Text> : null}

                <Text style={styles.label}>{t('publish.description')}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder={t('publish.descriptionPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                />

                {activeIssues.length > 0 || submitError ? (
                  <View style={styles.warningPanel}>
                    <View style={styles.warningHeader}>
                      <Text style={{ fontSize: 18 }}>⚠️</Text>
                      <Text style={styles.warningTitle}>{t('publish.warningTitle')}</Text>
                    </View>
                    <View style={styles.issueList}>
                      {activeIssues.map((issue) => (
                        <View key={issue} style={styles.issueRow}>
                          <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                          <Text style={styles.issueText}>{issue}</Text>
                        </View>
                      ))}
                      {submitError ? (
                        <View style={styles.issueRow}>
                          <View style={styles.issueBullet}><Text style={{ color: '#DC2626', fontSize: 11 }}>!</Text></View>
                          <Text style={styles.issueText}>{submitError}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.button} onPress={handlePublish} disabled={submitting} activeOpacity={0.8}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('publish.publishNow')}</Text>}
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
              <Text style={styles.modalTitle}>{t('publish.successTitle')}</Text>
              <Text style={styles.modalText}>
                {t('publish.successBody')}
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setPublishModalOpen(false);
                  router.replace('/(tabs)');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{t('publish.viewOnMap')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => setPublishModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.ghostButtonText}>{t('publish.keepPublishing')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </AnimatedTabScene>
  );
}
