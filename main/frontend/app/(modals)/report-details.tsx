import { Ionicons } from '../../components/SafeIonicons';
import { BASE_URL } from '../../services/api';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../utils/theme';
import { formatTimeAgo, formatExpiry } from '../../utils/format';
import type { CommunityReport } from '../../types';

async function fetchReport(id: string): Promise<CommunityReport> {
  const res = await fetch(`${BASE_URL}/reports/${id}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  return res.json();
}

async function confirmReport(
  id: string,
  vote: 1 | -1,
  token?: string,
): Promise<{ vote: 1 | -1; report?: CommunityReport }> {
  const res = await fetch(`${BASE_URL}/reports/${id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ vote }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Confirm failed: ${res.status}`);
  return res.json();
}

const REPORT_TYPE_ICONS: Record<string, string> = {
  traffic: '🚧',
  accident: '💥',
  police: '👮',
  queue: '👥',
  popup_market: '🏪',
  food_truck: '🚚',
  live_music: '🎸',
  street_show: '🎭',
  free_stuff: '🎁',
  road_closure: '🚫',
  parking_free: '🅿️',
  protest: '✊',
  construction: '👷',
  other: '📍',
};

export default function ReportDetailsModal() {
  const { colors, radii, shadows, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [report, setReport] = useState<CommunityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.shell,
    },
    closeButton: {
      alignSelf: 'flex-end',
      margin: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        android: { elevation: 3 },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
      }),
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    errorText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.inkMuted,
      textAlign: 'center',
      fontFamily: typography.body,
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      backgroundColor: colors.brand,
      borderRadius: radii.md,
    },
    retryText: {
      color: '#FFF',
      fontWeight: '700',
      fontFamily: typography.heading,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 48,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.sm,
      marginBottom: 16,
      gap: 6,
    },
    statusLive: {
      backgroundColor: '#FFE5E5',
    },
    statusExpired: {
      backgroundColor: colors.chip,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FF4444',
    },
    statusLiveText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#FF4444',
      letterSpacing: 1,
    },
    statusExpiredText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      marginBottom: 16,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconText: {
      fontSize: 28,
    },
    headerText: {
      flex: 1,
    },
    reportType: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.accent,
      letterSpacing: 1,
      marginBottom: 4,
      fontFamily: typography.heading,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.ink,
      lineHeight: 28,
      fontFamily: typography.heading,
    },
    description: {
      fontSize: 15,
      color: colors.inkMuted,
      lineHeight: 22,
      marginBottom: 16,
      fontFamily: typography.body,
    },
    metaSection: {
      gap: 8,
      marginBottom: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaText: {
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    confidenceCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 20,
      marginBottom: 20,
      ...shadows.soft,
    },
    confidenceLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 12,
      fontFamily: typography.heading,
    },
    confidenceBar: {
      height: 8,
      backgroundColor: colors.stroke,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 16,
    },
    confidenceFill: {
      height: '100%',
      backgroundColor: '#10B981',
      borderRadius: 4,
    },
    confidenceStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
      gap: 4,
      flex: 1,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
    },
    statLabel: {
      fontSize: 11,
      color: colors.inkMuted,
      fontFamily: typography.body,
    },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.stroke,
    },
    voteSection: {
      marginBottom: 16,
    },
    voteQuestion: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 14,
      fontFamily: typography.heading,
    },
    voteRow: {
      flexDirection: 'row',
      gap: 12,
    },
    voteButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: radii.md,
      ...shadows.soft,
    },
    voteConfirm: {
      backgroundColor: '#10B981',
    },
    voteDeny: {
      backgroundColor: '#EF4444',
    },
    voteButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFF',
      fontFamily: typography.heading,
    },
    votedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 14,
      backgroundColor: '#F0FDF4',
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: '#86EFAC',
    },
    votedText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#10B981',
      fontFamily: typography.heading,
    },
  }), [colors, radii, shadows, typography]);

  function loadReport() {
    if (!id) {
      setError('ID de reporte no encontrado');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchReport(id)
      .then((data) => {
        setReport(data);
        setHasVoted((data.viewer_vote ?? 0) !== 0);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleVote(vote: 1 | -1) {
    if (!id || hasVoted || voting) return;

    setVoting(true);
    try {
      const result = await confirmReport(id, vote, session?.access_token);
      setHasVoted(true);
      if (result.report) {
        setReport(result.report);
      } else {
        setReport((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            confirmations: prev.confirmations + (vote === 1 ? 1 : 0),
            denials: prev.denials + (vote === -1 ? 1 : 0),
            viewer_vote: vote,
          };
        });
      }
      Alert.alert(
        vote === 1 ? '¡Confirmado!' : 'Descartado',
        vote === 1
          ? 'Gracias por confirmar este reporte.'
          : 'Gracias. Tu opinión ayuda a la comunidad.',
      );
    } catch {
      Alert.alert('Error', 'No se pudo registrar tu voto. Inténtalo de nuevo.');
    } finally {
      setVoting(false);
    }
  }

  const reportIcon =
    report ? (REPORT_TYPE_ICONS[report.report_type] ?? '📍') : '📢';

  const isExpired =
    report ? new Date(report.expires_at).getTime() < Date.now() : false;

  const confidencePct =
    report ? Math.round(report.confidence * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityLabel="Cerrar"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={24} color="#1C1C1E" />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error || !report ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#E5E5EA" />
          <Text style={styles.errorText}>
            {error ?? 'Reporte no encontrado'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadReport}
          >
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: 'transparent' }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.retryText, { color: colors.inkMuted }]}>Volver</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Status banner */}
          {isExpired ? (
            <View style={[styles.statusBanner, styles.statusExpired]}>
              <Ionicons name="time-outline" size={16} color="#636366" />
              <Text style={styles.statusExpiredText}>Reporte expirado</Text>
            </View>
          ) : (
            <View style={[styles.statusBanner, styles.statusLive]}>
              <View style={styles.liveDot} />
              <Text style={styles.statusLiveText}>EN VIVO</Text>
            </View>
          )}

          {/* Icon + title */}
          <View style={styles.headerRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accent + '20' }]}>
              <Text style={styles.iconText}>{reportIcon}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.reportType}>
                {report.report_type.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text style={styles.title}>{report.title}</Text>
            </View>
          </View>

          {/* Description */}
          {report.description ? (
            <Text style={styles.description}>{report.description}</Text>
          ) : null}

          {/* Meta info */}
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color={colors.inkMuted} />
              <Text style={styles.metaText}>
                Creado {formatTimeAgo(report.created_at)}
              </Text>
            </View>
            {!isExpired && (
              <View style={styles.metaRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.inkMuted} />
                <Text style={styles.metaText}>
                  {formatExpiry(report.expires_at)}
                </Text>
              </View>
            )}
            {report.address_hint ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.inkMuted} />
                <Text style={styles.metaText}>{report.address_hint}</Text>
              </View>
            ) : null}
          </View>

          {/* Confidence */}
          <View style={styles.confidenceCard}>
            <Text style={styles.confidenceLabel}>Confianza de la comunidad</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  // RN accepts percentage strings for flex-child widths at runtime
                  { width: `${confidencePct}%` as `${number}%` },
                ]}
              />
            </View>
            <View style={styles.confidenceStats}>
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.statValue}>{report.confirmations}</Text>
                <Text style={styles.statLabel}>Confirmaciones</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
                <Text style={styles.statValue}>{report.denials}</Text>
                <Text style={styles.statLabel}>Denegaciones</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand} />
                <Text style={styles.statValue}>{confidencePct}%</Text>
                <Text style={styles.statLabel}>Confianza</Text>
              </View>
            </View>
          </View>

          {/* Vote buttons — hidden if expired or already voted */}
          {!isExpired && !hasVoted && (
            <View style={styles.voteSection}>
              <Text style={styles.voteQuestion}>
                ¿Sigue siendo válido este reporte?
              </Text>
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteConfirm]}
                  onPress={() => handleVote(1)}
                  disabled={voting}
                  activeOpacity={0.8}
                >
                  {voting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.voteButtonText}>Confirmar</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteDeny]}
                  onPress={() => handleVote(-1)}
                  disabled={voting}
                  activeOpacity={0.8}
                >
                  {voting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="close" size={20} color="#FFF" />
                      <Text style={styles.voteButtonText}>Descartar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {hasVoted && (
            <View style={styles.votedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.votedText}>¡Gracias por tu contribución!</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

