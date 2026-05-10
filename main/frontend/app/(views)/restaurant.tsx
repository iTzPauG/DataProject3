import React, { useCallback, useEffect, useState } from 'react';
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface RestaurantStats {
  total_offers: number;
  active_offers: number;
  cancelled_offers: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  total_seats: number;
  avg_seats: number;
  first_activity: string | null;
  last_activity: string | null;
}

type TabKey = 'activas' | 'nueva' | 'historial' | 'stats';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'activas', label: 'Activas' },
  { key: 'nueva', label: 'Nueva oferta' },
  { key: 'historial', label: 'Historial' },
  { key: 'stats', label: 'Estadísticas' },
];

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const { colors, typography } = useTheme();
  const [name, setName] = useState('');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.shell }]}>
      <View style={s.loginContainer}>
        <Text style={[s.loginTitle, { color: colors.ink, fontFamily: typography.heading }]}>
          Portal Restaurante
        </Text>
        <Text style={[s.loginSub, { color: colors.inkMuted, fontFamily: typography.body }]}>
          Introduce el nombre de tu restaurante para continuar
        </Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
          placeholder="Nombre del restaurante"
          placeholderTextColor={colors.inkFaint}
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.brand, opacity: name.trim() ? 1 : 0.4 }]}
          onPress={() => name.trim() && onLogin(name.trim())}
          disabled={!name.trim()}
        >
          <Text style={[s.btnText, { fontFamily: typography.heading }]}>Entrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({
  event,
  isOwn,
  onCancel,
  colors,
  typography,
}: {
  event: TableEvent;
  isOwn: boolean;
  onCancel?: (id: string) => void;
  colors: any;
  typography: any;
}) {
  const endsAt = event.ends_at
    ? new Date(event.ends_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const createdAt = new Date(event.created_at).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  return (
    <View style={[s.eventCard, {
      backgroundColor: colors.surface,
      borderLeftColor: isOwn ? colors.brand : colors.stroke,
      opacity: event.is_active ? 1 : 0.55,
    }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[s.eventRestaurant, { color: colors.ink, fontFamily: typography.heading }]}>
            {event.restaurant_name}
          </Text>
          {!event.is_active && (
            <View style={{ backgroundColor: '#EF444420', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#EF4444', fontSize: 10, fontFamily: typography.body }}>Cancelada</Text>
            </View>
          )}
        </View>
        {event.description ? (
          <Text style={[s.eventDesc, { color: colors.inkMuted, fontFamily: typography.body }]}>
            {event.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          <Text style={[s.eventMeta, { color: colors.inkFaint, fontFamily: typography.body }]}>
            {event.seats} plazas
          </Text>
          <Text style={[s.eventMeta, { color: colors.brand, fontFamily: typography.heading }]}>
            {event.price.toFixed(2)} €
          </Text>
          <Text style={[s.eventMeta, { color: colors.inkFaint, fontFamily: typography.body }]}>
            hasta {endsAt}
          </Text>
          <Text style={[s.eventMeta, { color: colors.inkFaint, fontFamily: typography.body }]}>
            {createdAt}
          </Text>
        </View>
      </View>
      {isOwn && event.is_active && onCancel && (
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: '#EF4444' }]}
          onPress={() => onCancel(event.id)}
        >
          <Text style={[s.cancelText, { fontFamily: typography.body }]}>Cancelar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Tab: Activas ──────────────────────────────────────────────────────────────
function ActiveTab({
  restaurantName,
  colors,
  typography,
}: {
  restaurantName: string;
  colors: any;
  typography: any;
}) {
  const { events, connected } = useTableEvents();
  const myEvents = events.filter((e) => e.restaurant_name === restaurantName);
  const othersEvents = events.filter((e) => e.restaurant_name !== restaurantName);

  const cancel = async (id: string) => {
    try {
      await fetch(`${BASE_URL}/table-events/${id}`, { method: 'DELETE' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      <View style={[s.wsBadge, { backgroundColor: connected ? '#22C55E20' : '#EF444420', alignSelf: 'flex-start', marginBottom: 16 }]}>
        <Text style={{ color: connected ? '#22C55E' : '#EF4444', fontSize: 11, fontFamily: typography.body }}>
          {connected ? '● En vivo' : '○ Conectando...'}
        </Text>
      </View>

      {myEvents.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
            MIS OFERTAS ({myEvents.length})
          </Text>
          {myEvents.map((e) => (
            <EventCard key={e.id} event={e} isOwn onCancel={cancel} colors={colors} typography={typography} />
          ))}
        </>
      )}
      {othersEvents.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 16 }]}>
            OTROS RESTAURANTES ({othersEvents.length})
          </Text>
          {othersEvents.map((e) => (
            <EventCard key={e.id} event={e} isOwn={false} colors={colors} typography={typography} />
          ))}
        </>
      )}
      {events.length === 0 && (
        <View style={s.empty}>
          <Text style={[s.emptyText, { color: colors.inkFaint, fontFamily: typography.body }]}>
            No hay ofertas activas ahora mismo
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Tab: Nueva oferta ─────────────────────────────────────────────────────────
function NewOfferTab({
  restaurantName,
  colors,
  typography,
}: {
  restaurantName: string;
  colors: any;
  typography: any;
}) {
  const [seats, setSeats] = useState('2');
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

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
      Alert.alert('Publicada', 'Oferta publicada correctamente');
      setPrice('');
      setDescription('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      <View style={[s.formBox, { backgroundColor: colors.surface }]}>
        <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginBottom: 16 }]}>
          PUBLICAR OFERTA DE MESA
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.inkMuted, fontFamily: typography.body }]}>Plazas</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
              value={seats}
              onChangeText={setSeats}
              keyboardType="numeric"
              placeholder="2"
              placeholderTextColor={colors.inkFaint}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.inkMuted, fontFamily: typography.body }]}>Precio (€)</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="15.00"
              placeholderTextColor={colors.inkFaint}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: colors.inkMuted, fontFamily: typography.body }]}>Minutos</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body }]}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor={colors.inkFaint}
            />
          </View>
        </View>
        <TextInput
          style={[s.input, { backgroundColor: colors.shell, color: colors.ink, borderColor: colors.stroke, fontFamily: typography.body, marginTop: 10 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción opcional (menú, promoción…)"
          placeholderTextColor={colors.inkFaint}
        />
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.brand, marginTop: 14, opacity: price && seats ? 1 : 0.4 }]}
          onPress={publish}
          disabled={!price || !seats || publishing}
        >
          {publishing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={[s.btnText, { fontFamily: typography.heading }]}>Publicar oferta</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Tab: Historial ────────────────────────────────────────────────────────────
function HistoryTab({
  restaurantName,
  colors,
  typography,
}: {
  restaurantName: string;
  colors: any;
  typography: any;
}) {
  const [events, setEvents] = useState<TableEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/table-events/history?restaurant_name=${encodeURIComponent(restaurantName)}`);
      if (!res.ok) throw new Error('Error al cargar el historial');
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantName]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
  if (error) return (
    <View style={s.center}>
      <Text style={{ color: '#EF4444', fontFamily: typography.body }}>{error}</Text>
      <TouchableOpacity onPress={load} style={[s.btn, { backgroundColor: colors.brand, marginTop: 16, paddingHorizontal: 24 }]}>
        <Text style={[s.btnText, { fontFamily: typography.heading }]}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
        TODAS LAS OFERTAS ({events.length})
      </Text>
      {events.length === 0 && (
        <View style={s.empty}>
          <Text style={[s.emptyText, { color: colors.inkFaint, fontFamily: typography.body }]}>
            Sin historial todavía
          </Text>
        </View>
      )}
      {events.map((e) => (
        <EventCard key={e.id} event={e} isOwn colors={colors} typography={typography} />
      ))}
    </ScrollView>
  );
}

// ── Tab: Estadísticas ─────────────────────────────────────────────────────────
function StatsTab({
  restaurantName,
  colors,
  typography,
}: {
  restaurantName: string;
  colors: any;
  typography: any;
}) {
  const [stats, setStats] = useState<RestaurantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/table-events/stats?restaurant_name=${encodeURIComponent(restaurantName)}`);
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      const data = await res.json();
      setStats(data.stats ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantName]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
  if (error) return (
    <View style={s.center}>
      <Text style={{ color: '#EF4444', fontFamily: typography.body }}>{error}</Text>
      <TouchableOpacity onPress={load} style={[s.btn, { backgroundColor: colors.brand, marginTop: 16, paddingHorizontal: 24 }]}>
        <Text style={[s.btnText, { fontFamily: typography.heading }]}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
  if (!stats) return null;

  const rate = stats.total_offers > 0
    ? Math.round((stats.cancelled_offers / stats.total_offers) * 100)
    : 0;

  const statRows = [
    { label: 'Total ofertas publicadas', value: String(stats.total_offers) },
    { label: 'Ofertas activas ahora', value: String(stats.active_offers) },
    { label: 'Ofertas canceladas', value: `${stats.cancelled_offers} (${rate}%)` },
    { label: 'Precio medio', value: `${stats.avg_price} €` },
    { label: 'Precio mínimo', value: `${stats.min_price} €` },
    { label: 'Precio máximo', value: `${stats.max_price} €` },
    { label: 'Total plazas ofertadas', value: String(stats.total_seats) },
    { label: 'Media de plazas por oferta', value: String(stats.avg_seats) },
  ];

  const barRows = [
    { label: 'Activas', value: stats.active_offers, color: '#22C55E' },
    { label: 'Canceladas', value: stats.cancelled_offers, color: '#EF4444' },
  ];
  const barMax = Math.max(stats.active_offers, stats.cancelled_offers, 1);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.tabContent}>
      <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
        RESUMEN DE ACTIVIDAD
      </Text>

      {/* Bar chart */}
      <View style={[s.card, { backgroundColor: colors.surface, marginBottom: 16 }]}>
        {barRows.map((row, i) => (
          <View key={i} style={{ marginBottom: i < barRows.length - 1 ? 14 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: typography.body }}>{row.label}</Text>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.heading }}>{row.value}</Text>
            </View>
            <View style={{ height: 10, backgroundColor: colors.shell, borderRadius: 5, overflow: 'hidden' }}>
              <View style={{
                height: '100%',
                width: `${Math.max((row.value / barMax) * 100, row.value > 0 ? 4 : 0)}%` as any,
                backgroundColor: row.color,
                borderRadius: 5,
              }} />
            </View>
          </View>
        ))}
      </View>

      {/* Stats table */}
      <View style={[s.card, { backgroundColor: colors.surface }]}>
        {statRows.map((row, i) => (
          <View
            key={i}
            style={[s.tableRow, {
              borderBottomColor: colors.stroke,
              borderBottomWidth: i < statRows.length - 1 ? StyleSheet.hairlineWidth : 0,
            }]}
          >
            <Text style={{ color: colors.inkMuted, fontSize: 13, fontFamily: typography.body, flex: 1 }}>{row.label}</Text>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.heading }}>{row.value}</Text>
          </View>
        ))}
      </View>

      {stats.first_activity && (
        <Text style={{ color: colors.inkFaint, fontSize: 11, fontFamily: typography.body, marginTop: 12, textAlign: 'center' }}>
          Primera oferta: {new Date(stats.first_activity).toLocaleDateString('es-ES')}
        </Text>
      )}
    </ScrollView>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function RestaurantDashboard({ restaurantName, onLogout }: { restaurantName: string; onLogout: () => void }) {
  const { colors, typography } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('activas');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.shell }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.stroke }]}>
        <View>
          <Text style={[s.eyebrow, { color: colors.inkFaint, fontFamily: typography.body }]}>
            PORTAL RESTAURANTE
          </Text>
          <Text style={[s.title, { color: colors.ink, fontFamily: typography.heading }]}>
            {restaurantName}
          </Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={[s.logoutBtn, { borderColor: colors.stroke }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: typography.body }}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: colors.stroke, backgroundColor: colors.shell }]}>
        {TABS.map((tab) => {
          const focused = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, focused && { borderBottomColor: colors.ink, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabLabel, {
                color: focused ? colors.ink : colors.inkFaint,
                fontFamily: typography.body,
                fontWeight: focused ? '700' : '400',
              }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'activas' && <ActiveTab restaurantName={restaurantName} colors={colors} typography={typography} />}
        {activeTab === 'nueva' && <NewOfferTab restaurantName={restaurantName} colors={colors} typography={typography} />}
        {activeTab === 'historial' && <HistoryTab restaurantName={restaurantName} colors={colors} typography={typography} />}
        {activeTab === 'stats' && <StatsTab restaurantName={restaurantName} colors={colors} typography={typography} />}
      </View>
    </SafeAreaView>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RestaurantPage() {
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  if (!restaurantName) return <LoginScreen onLogin={setRestaurantName} />;
  return <RestaurantDashboard restaurantName={restaurantName} onLogout={() => setRestaurantName(null)} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  loginTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  loginSub: { fontSize: 14, marginBottom: 24 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: { fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  logoutBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 12, letterSpacing: 0.2 },
  tabContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  formBox: { borderRadius: 14, padding: 16 },
  wsBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  eventCard: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3,
  },
  eventRestaurant: { fontSize: 15, fontWeight: '700' },
  eventDesc: { fontSize: 13, marginTop: 2 },
  eventMeta: { fontSize: 12 },
  cancelBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 10 },
  cancelText: { color: '#EF4444', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { borderRadius: 14, padding: 16, marginBottom: 4 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
});
