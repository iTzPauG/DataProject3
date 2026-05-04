import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from './SafeIonicons';
import { useTheme } from '../utils/theme';
import { BASE_URL } from '../services/api';

type Comment = {
  id: string;
  title: string;
  description?: string | null;
  report_type: string;
  created_at: string;
  expires_at?: string;
  distance_m?: number;
  confirmations?: number;
  denials?: number;
};

type SummaryResponse = {
  summary: string | null;
  count: number;
  comments: Comment[];
};

interface Props {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  language?: string;
}

const REPORT_TYPE_META: Record<string, { label: string; emoji: string; color: string }> = {
  comment:      { label: 'Comentario',  emoji: '💬', color: '#7C6CF2' },
  queue:        { label: 'Cola larga',  emoji: '👥', color: '#F59E0B' },
  noise:        { label: 'Ruidoso',     emoji: '🔊', color: '#EF4444' },
  live_music:   { label: 'Música',      emoji: '🎵', color: '#A855F7' },
  free_stuff:   { label: 'Gratis',      emoji: '🎁', color: '#22C55E' },
  food_truck:   { label: 'Food truck',  emoji: '🚚', color: '#FF6B35' },
  popup_market: { label: 'Mercadillo',  emoji: '🏪', color: '#10B981' },
  street_show:  { label: 'Espectáculo', emoji: '🎭', color: '#EC4899' },
  other:        { label: 'Otro',        emoji: '📍', color: '#6366F1' },
};

const QUICK_TYPES = ['comment', 'queue', 'noise', 'live_music', 'free_stuff', 'other'];

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function LiveCommentIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={{ position: 'relative', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="chatbubbles" size={size} color={color} />
      <Animated.View style={{
        position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }]
      }} />
    </View>
  );
}

export default function LiveCommentsSection({ placeId, placeName, lat, lng, language = 'es' }: Props) {
  const { t } = useTranslation();
  const { colors, typography, radii, shadows } = useTheme();
  
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [reportType, setReportType] = useState('comment');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const fetchComments = useCallback(async () => {
    try {
      const url = `${BASE_URL}/places/comments/summary?lat=${lat}&lng=${lng}&place_name=${encodeURIComponent(placeName)}&language=${language}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Error fetching live comments', e);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, placeName, language]);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (title.trim().length < 2) {
      Alert.alert('Aviso', 'El comentario debe ser más largo.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/places/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: placeId,
          place_name: placeName,
          lat,
          lng,
          title: title.trim(),
          description: description.trim() || undefined,
          report_type: reportType,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setTitle('');
        setDescription('');
        setReportType('comment');
        setLoading(true);
        fetchComments();
      } else {
        Alert.alert('Error', 'No se pudo publicar el reporte.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo conectar al servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: '#1E2436', // Dark contrast for the live section
      borderRadius: radii.xl,
      padding: 16,
      marginBottom: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: typography.heading,
    },
    addBtn: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    addBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
      fontFamily: typography.heading,
    },
    summaryBox: {
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 16,
      borderLeftWidth: 3,
      borderLeftColor: '#7C6CF2',
    },
    summaryText: {
      color: '#E2E8F0',
      fontSize: 14,
      lineHeight: 20,
      fontFamily: typography.body,
      fontStyle: 'italic',
    },
    commentItem: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    commentIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentEmoji: {
      fontSize: 18,
    },
    commentBody: {
      flex: 1,
    },
    commentTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      fontFamily: typography.heading,
      marginBottom: 2,
    },
    commentDesc: {
      color: '#94A3B8',
      fontSize: 13,
      lineHeight: 18,
      fontFamily: typography.body,
      marginBottom: 4,
    },
    commentMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    commentMetaText: {
      color: '#64748B',
      fontSize: 11,
      fontWeight: '600',
      fontFamily: typography.body,
    },
    emptyText: {
      color: '#94A3B8',
      fontSize: 14,
      fontFamily: typography.body,
      textAlign: 'center',
      marginVertical: 10,
    },

    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.shell,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: 24,
      maxHeight: '90%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.ink,
      fontFamily: typography.heading,
      marginBottom: 4,
    },
    modalSub: {
      fontSize: 14,
      color: colors.inkMuted,
      fontFamily: typography.body,
      marginBottom: 20,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    typeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
    },
    typeBtnActive: {
      backgroundColor: colors.brand + '15',
      borderColor: colors.brand,
    },
    typeBtnText: {
      fontSize: 14,
      color: colors.ink,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.stroke,
      borderRadius: radii.md,
      padding: 14,
      fontSize: 15,
      color: colors.ink,
      fontFamily: typography.body,
      marginBottom: 12,
    },
    textarea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    submitBtn: {
      backgroundColor: colors.brand,
      paddingVertical: 16,
      borderRadius: radii.lg,
      alignItems: 'center',
      marginTop: 8,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      fontFamily: typography.heading,
    },
    closeBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      padding: 8,
      zIndex: 10,
    },
  }), [colors, typography, radii]);

  if (loading && !data) {
    return (
      <View style={[styles.container, { alignItems: 'center', paddingVertical: 30 }]}>
        <ActivityIndicator size="small" color="#7C6CF2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <LiveCommentIcon size={20} color="#FFFFFF" />
          <Text style={styles.title}>En directo</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Añadir</Text>
        </TouchableOpacity>
      </View>

      {data?.summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>"{data.summary}"</Text>
        </View>
      )}

      {(!data?.comments || data.comments.length === 0) ? (
        <Text style={styles.emptyText}>No hay reportes recientes. ¡Sé el primero!</Text>
      ) : (
        <View>
          {data.comments.map((comment) => {
            const meta = REPORT_TYPE_META[comment.report_type] || REPORT_TYPE_META.other;
            return (
              <View key={comment.id} style={styles.commentItem}>
                <View style={[styles.commentIconWrap, { backgroundColor: meta.color + '20' }]}>
                  <Text style={styles.commentEmoji}>{meta.emoji}</Text>
                </View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentTitle}>{comment.title}</Text>
                  {comment.description ? (
                    <Text style={styles.commentDesc} numberOfLines={2}>{comment.description}</Text>
                  ) : null}
                  <View style={styles.commentMetaRow}>
                    <Text style={styles.commentMetaText}>{formatRelative(comment.created_at)}</Text>
                    {comment.distance_m != null && (
                      <Text style={styles.commentMetaText}>· a {comment.distance_m}m</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>¿Qué está pasando?</Text>
            <Text style={styles.modalSub}>Reporta en vivo sobre {placeName}</Text>

            <View style={styles.typeGrid}>
              {QUICK_TYPES.map(key => {
                const meta = REPORT_TYPE_META[key];
                const active = reportType === key;
                return (
                  <TouchableOpacity 
                    key={key} 
                    style={[styles.typeBtn, active && styles.typeBtnActive]}
                    onPress={() => setReportType(key)}
                  >
                    <Text>{meta.emoji}</Text>
                    <Text style={styles.typeBtnText}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Titular breve (ej. Cola de 20 mins)"
              placeholderTextColor={colors.inkMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
            />

            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Detalles adicionales (opcional)"
              placeholderTextColor={colors.inkMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={200}
            />

            <TouchableOpacity 
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Publicar ahora</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
