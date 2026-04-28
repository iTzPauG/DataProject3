import React, { useEffect, useState } from 'react';
import { useTranslation } from "react-i18next";
import { BASE_URL } from '../../services/api';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../utils/theme';
import { Ionicons } from '../../components/SafeIonicons';

export default function EventDetailsModal() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, radii, shadows } = useTheme();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`${BASE_URL}/events/${id}`);
        if (!res.ok) throw new Error(t('eventDetails.notFound'));
        const data = await res.json();
        setEvent(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [id, t]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.shell }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.shell }]}>
        <Ionicons name="alert-circle" size={48} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.ink }]}>{error || t('eventDetails.notFound')}</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Text style={{ color: colors.ink }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.shell }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.surface, ...shadows.soft }]} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {event.photo_url && (
          <Image source={{ uri: event.photo_url }} style={styles.image} />
        )}
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: typography.heading }]}>{event.title}</Text>
          {event.description && (
            <Text style={[styles.description, { color: colors.inkMuted, fontFamily: typography.body }]}>{event.description}</Text>
          )}
          <View style={[styles.metaBox, { backgroundColor: colors.surface, borderRadius: radii.md, ...shadows.soft }]}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar" size={20} color={colors.brand} />
              <Text style={[styles.metaText, { color: colors.ink }]}>{new Date(event.starts_at).toLocaleString()}</Text>
            </View>
            {event.address && (
              <View style={[styles.metaRow, { marginTop: 12 }]}>
                <Ionicons name="location" size={20} color={colors.brand} />
                <Text style={[styles.metaText, { color: colors.ink }]}>{event.address}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 40 },
  image: { width: '100%', height: 250, resizeMode: 'cover' },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  description: { fontSize: 16, lineHeight: 24, marginBottom: 20 },
  metaBox: { padding: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 16, marginLeft: 12, flex: 1 },
  errorText: { fontSize: 18, marginTop: 16, marginBottom: 24 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
});
