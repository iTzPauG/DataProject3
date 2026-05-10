import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';
import { TableEvent, useTableEvents } from '../../hooks/useTableEvents';

// ── Pantalla de acceso ─────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const { colors, typography } = useTheme();
  const [name, setName] = useState('');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.shell }]}>
      <View style={styles.loginContainer}>
        <Text style={[styles.loginTitle, { color: colors.ink, fontFamily: typography.heading }]}>
          Portal Restaurante
        </Text>
        <Text style={[styles.loginSub, { color: colors.inkMuted, fontFamily: typography.body }]}>
          Introduce el nombre de tu restaurante para continuar
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
          placeholder="Nombre del restaurante"
          placeholderTextColor={colors.inkFaint}
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.brand, opacity: name.trim() ? 1 : 0.4 }]}
          onPress={() => name.trim() && onLogin(name.trim())}
          disabled={!name.trim()}
        >
          <Text style={[styles.btnText, { fontFamily: typography.heading }]}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Tarjeta de oferta ──────────────────────────────────────────────────────────
function EventCard({
  event,
  isOwn,
  onCancel,
  colors,
  typography,
}: {
  event: TableEvent;
  isOwn: boolean;
  onCancel: (id: string) => void;
  colors: any;
  typography: any;
}) {
  const endsAt = new Date(event.ends_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.eventCard, { backgroundColor: colors.surface, borderLeftColor: isOwn ? colors.brand : colors.stroke }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eventRestaurant, { color: colors.ink, fontFamily: typography.heading }]}>
          {event.restaurant_name}
        </Text>
        {event.description ? (
          <Text style={[styles.eventDesc, { color: colors.inkMuted, fontFamily: typography.body }]}>
            {event.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
          <Text style={[styles.eventMeta, { color: colors.inkFaint, fontFamily: typography.body }]}>
            {event.seats} plazas
          </Text>
          <Text style={[styles.eventMeta, { color: colors.brand, fontFamily: typography.heading }]}>
            {event.price.toFixed(2)} €
          </Text>
          <Text style={[styles.eventMeta, { color: colors.inkFaint, fontFamily: typography.body }]}>
            hasta {endsAt}
          </Text>
        </View>
      </View>
      {isOwn && (
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: '#EF4444' }]}
          onPress={() => onCancel(event.id)}
        >
          <Text style={[styles.cancelText, { fontFamily: typography.body }]}>Cancelar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Dashboard del restaurante ──────────────────────────────────────────────────
function Dashboard({ restaurantName, onLogout }: { restaurantName: string; onLogout: () => void }) {
  const { colors, typography } = useTheme();
  const { events, connected } = useTableEvents();
  const [seats, setSeats] = useState('2');
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  const myEvents = events.filter((e) => e.restaurant_name === restaurantName);
  const othersEvents = events.filter((e) => e.restaurant_name !== restaurantName);

  const publish = async () => {
    if (!seats || !price) return;
    setPublishing(true);
    try {
      const res = await fetch(`${BASE_URL}/table-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: restaurantName,
          seats: parseInt(seats, 10),
          price: parseFloat(price),
          minutes_available: parseInt(minutes, 10) || 60,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Error al publicar la oferta');
      setPrice('');
      setDescription('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPublishing(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await fetch(`${BASE_URL}/table-events/${id}`, { method: 'DELETE' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.shell }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Cabecera */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.inkFaint, fontFamily: typography.body }]}>
              PORTAL RESTAURANTE
            </Text>
            <Text style={[styles.title, { color: colors.ink, fontFamily: typography.heading }]}>
              {restaurantName}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[styles.wsBadge, { backgroundColor: connected ? '#22C55E20' : '#EF444420' }]}>
              <Text style={{ color: connected ? '#22C55E' : '#EF4444', fontSize: 11, fontFamily: typography.body }}>
                {connected ? '● En vivo' : '○ Conectando...'}
              </Text>
            </View>
            <TouchableOpacity onPress={onLogout}>
              <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: typography.body }}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Formulario de publicación */}
        <View style={[styles.formBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
            PUBLICAR OFERTA DE MESA
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.inkMuted, fontFamily: typography.body }]}>Plazas</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
                value={seats}
                onChangeText={setSeats}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={colors.inkFaint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.inkMuted, fontFamily: typography.body }]}>Precio (€)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="15.00"
                placeholderTextColor={colors.inkFaint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.inkMuted, fontFamily: typography.body }]}>Minutos</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor={colors.inkFaint}
              />
            </View>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body, marginTop: 8 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descripción opcional..."
            placeholderTextColor={colors.inkFaint}
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.brand, marginTop: 12, opacity: price && seats ? 1 : 0.4 }]}
            onPress={publish}
            disabled={!price || !seats || publishing}
          >
            {publishing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[styles.btnText, { fontFamily: typography.heading }]}>Publicar oferta</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Mis ofertas activas */}
        {myEvents.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 20 }]}>
              MIS OFERTAS ACTIVAS ({myEvents.length})
            </Text>
            {myEvents.map((e) => (
              <EventCard key={e.id} event={e} isOwn onCancel={cancel} colors={colors} typography={typography} />
            ))}
          </>
        )}

        {/* Otros restaurantes */}
        {othersEvents.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 20 }]}>
              OTROS RESTAURANTES AHORA ({othersEvents.length})
            </Text>
            {othersEvents.map((e) => (
              <EventCard key={e.id} event={e} isOwn={false} onCancel={cancel} colors={colors} typography={typography} />
            ))}
          </>
        )}

        {events.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.inkFaint, fontFamily: typography.body }]}>
              No hay ofertas activas ahora mismo
            </Text>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Componente raíz ────────────────────────────────────────────────────────────
export default function RestaurantPage() {
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

  if (!restaurantName) {
    return <LoginScreen onLogin={setRestaurantName} />;
  }
  return <Dashboard restaurantName={restaurantName} onLogout={() => setRestaurantName(null)} />;
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16 },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  loginTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  loginSub: { fontSize: 14, marginBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  wsBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  formBox: { borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  eventCard: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3,
  },
  eventRestaurant: { fontSize: 15, fontWeight: '700' },
  eventDesc: { fontSize: 13, marginTop: 2 },
  eventMeta: { fontSize: 12 },
  cancelBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cancelText: { color: '#EF4444', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14 },
});
