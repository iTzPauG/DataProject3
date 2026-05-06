import { Ionicons } from '../../components/SafeIonicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';

interface Deal {
  id: string;
  restaurant_id: string;
  price: number;
  cuisine: string;
  available_at: string;
  seats: number;
  description: string | null;
  is_active: boolean;
}

export default function MyDealsModal() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const { user, getToken, profile } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from profile
  const [restaurantId, setRestaurantId] = useState(profile?.restaurant_place_id ?? '');
  const [price, setPrice] = useState('');
  const [cuisine, setCuisine] = useState(profile?.restaurant_cuisine ?? '');
  const [seats, setSeats] = useState('');
  const [description, setDescription] = useState('');
  const [availableAt, setAvailableAt] = useState('');

  async function authFetch(path: string, options: RequestInit = {}) {
    const token = await getToken();
    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }

  async function loadDeals() {
    setLoading(true);
    try {
      const res = await authFetch('/deals');
      const data = await res.json();
      // Filter to only show this owner's deals
      setDeals(data.deals ?? []);
    } catch {
      setError('Error cargando ofertas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDeals(); }, []);

  async function handleCreate() {
    if (!restaurantId || !price || !cuisine || !seats || !availableAt) {
      setError('Rellena todos los campos obligatorios');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await authFetch('/deals', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restaurantId,
          price: parseFloat(price),
          cuisine,
          seats: parseInt(seats),
          description: description || null,
          available_at: new Date(availableAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error al crear oferta');
      }
      setShowForm(false);
      setRestaurantId(''); setPrice(''); setCuisine(''); setSeats(''); setDescription(''); setAvailableAt('');
      await loadDeals();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const confirm = Platform.OS === 'web'
      ? window.confirm('¿Eliminar esta oferta?')
      : await new Promise(resolve => Alert.alert('Eliminar', '¿Eliminar esta oferta?', [
          { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Eliminar', onPress: () => resolve(true), style: 'destructive' },
        ]));
    if (!confirm) return;
    await authFetch(`/deals/${id}`, { method: 'DELETE' });
    await loadDeals();
  }

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.shell },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
    title: { fontSize: 22, fontWeight: '800', color: colors.ink, fontFamily: typography.heading, flex: 1 },
    addBtn: { backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    addBtnText: { color: '#fff', fontWeight: '700', fontFamily: typography.heading },
    form: { margin: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10 },
    input: { backgroundColor: colors.shell, borderRadius: 10, padding: 12, color: colors.ink, fontFamily: typography.body, borderWidth: 1, borderColor: colors.stroke },
    label: { fontSize: 12, color: colors.inkMuted, fontFamily: typography.body, marginBottom: -6 },
    submitBtn: { backgroundColor: colors.brand, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
    submitText: { color: '#fff', fontWeight: '700', fontFamily: typography.heading },
    errorText: { color: '#EF4444', fontFamily: typography.body, textAlign: 'center' },
    dealCard: { margin: 16, marginBottom: 0, backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
    dealTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, fontFamily: typography.heading },
    dealSub: { fontSize: 13, color: colors.inkMuted, fontFamily: typography.body, marginTop: 2 },
    dealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    deleteBtn: { padding: 6 },
    empty: { textAlign: 'center', color: colors.inkMuted, fontFamily: typography.body, marginTop: 40 },
  });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={s.title}>Mis Ofertas</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(v => !v)}>
          <Text style={s.addBtnText}>{showForm ? 'Cancelar' : '+ Nueva'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {showForm && (
          <View style={s.form}>
            {!profile?.restaurant_place_id && (
              <>
                <Text style={s.label}>ID del restaurante (Google Place ID) *</Text>
                <TextInput style={s.input} placeholder="ChIJ..." placeholderTextColor={colors.inkMuted} value={restaurantId} onChangeText={setRestaurantId} />
              </>
            )}

            <Text style={s.label}>Precio (€) *</Text>
            <TextInput style={s.input} placeholder="12.50" placeholderTextColor={colors.inkMuted} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

            {!profile?.restaurant_cuisine && (
              <>
                <Text style={s.label}>Tipo de cocina *</Text>
                <TextInput style={s.input} placeholder="Mediterránea, Japonesa..." placeholderTextColor={colors.inkMuted} value={cuisine} onChangeText={setCuisine} />
              </>
            )}

            <Text style={s.label}>Plazas disponibles *</Text>
            <TextInput style={s.input} placeholder="4" placeholderTextColor={colors.inkMuted} value={seats} onChangeText={setSeats} keyboardType="number-pad" />

            <Text style={s.label}>Disponible a partir de (YYYY-MM-DD HH:MM) *</Text>
            <TextInput style={s.input} placeholder="2026-05-04 21:00" placeholderTextColor={colors.inkMuted} value={availableAt} onChangeText={setAvailableAt} />

            <Text style={s.label}>Descripción (opcional)</Text>
            <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Menú del día incluye..." placeholderTextColor={colors.inkMuted} value={description} onChangeText={setDescription} multiline />

            {error && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Publicar oferta</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
        ) : deals.length === 0 ? (
          <Text style={s.empty}>No tienes ofertas activas</Text>
        ) : (
          deals.map(deal => (
            <View key={deal.id} style={s.dealCard}>
              <Text style={s.dealTitle}>{deal.cuisine} — {deal.price}€</Text>
              <Text style={s.dealSub}>{deal.seats} plazas · {new Date(deal.available_at).toLocaleString('es-ES')}</Text>
              {deal.description && <Text style={s.dealSub}>{deal.description}</Text>}
              <View style={s.dealRow}>
                <Text style={{ color: deal.is_active ? '#22C55E' : colors.inkMuted, fontFamily: typography.body, fontSize: 12 }}>
                  {deal.is_active ? '● Activa' : '● Inactiva'}
                </Text>
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(deal.id)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
