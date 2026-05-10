import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface Metrics {
  active_offers: number;
  total_offers_today: number;
  total_offers_alltime: number;
  offers_last_hour: number;
  cancelled_today: number;
  cancellation_rate_today: number;
  registered_restaurants: number;
  active_restaurants_today: number;
  active_restaurants_week: number;
  total_seats_available: number;
  avg_offer_price: number;
  avg_duration_min: number;
  ws_connections: number;
  snapshot_at: string;
}

interface RestaurantRow {
  restaurant_name: string;
  total_offers: number;
  active_offers: number;
  avg_price: number;
  total_seats: number;
  last_activity: string | null;
}

// ── Login ─────────────────────────────────────────────────────────────────────
function DirectorLogin({ onLogin, onClose }: { onLogin: () => void; onClose?: () => void }) {
  const { colors, typography } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/dashboard/director-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? 'Código incorrecto');
      }
      onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.shell }]}>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={{ alignSelf: 'flex-end', padding: 16 }}>
          <Text style={{ color: colors.inkMuted, fontSize: 13, fontFamily: typography.body }}>✕ Cerrar</Text>
        </TouchableOpacity>
      )}
      <View style={s.loginContainer}>
        <Text style={[s.loginTitle, { color: colors.ink, fontFamily: typography.heading }]}>
          Panel Directivo
        </Text>
        <Text style={[s.loginSub, { color: colors.inkMuted, fontFamily: typography.body }]}>
          Introduce el código de acceso para directivos
        </Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: error ? '#EF4444' : colors.stroke, fontFamily: typography.body }]}
          placeholder="Código de acceso"
          placeholderTextColor={colors.inkFaint}
          value={code}
          onChangeText={(t) => { setCode(t); setError(null); }}
          secureTextEntry
          autoFocus
          onSubmitEditing={handleLogin}
        />
        {error && (
          <Text style={{ color: '#EF4444', fontSize: 13, fontFamily: typography.body, marginTop: 6 }}>
            {error}
          </Text>
        )}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.brand, marginTop: 16, opacity: code.trim() && !loading ? 1 : 0.4 }]}
          onPress={handleLogin}
          disabled={!code.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={[s.btnText, { fontFamily: typography.heading }]}>Acceder</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, colors, typography }: {
  label: string; value: string | number; sub?: string;
  color?: string; colors: any; typography: any;
}) {
  return (
    <View style={[s.kpiCard, { backgroundColor: colors.surface }]}>
      <Text style={[s.kpiValue, { color: color ?? colors.ink, fontFamily: typography.heading }]}>{value}</Text>
      <Text style={[s.kpiLabel, { color: colors.inkMuted, fontFamily: typography.body }]}>{label}</Text>
      {sub ? <Text style={[s.kpiSub, { color: colors.inkFaint, fontFamily: typography.body }]}>{sub}</Text> : null}
    </View>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function HBarChart({
  rows,
  colors,
  typography,
}: {
  rows: { label: string; value: number; color: string }[];
  colors: any;
  typography: any;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <View style={[s.card, { backgroundColor: colors.surface, gap: 14 }]}>
      {rows.map((row, i) => (
        <View key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: typography.body }} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.heading }}>
              {row.value}
            </Text>
          </View>
          <View style={{ height: 10, backgroundColor: colors.shell, borderRadius: 5, overflow: 'hidden' }}>
            <View style={{
              height: '100%',
              width: `${Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0)}%` as any,
              backgroundColor: row.color,
              borderRadius: 5,
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Restaurant ranking table ──────────────────────────────────────────────────
function RankingTable({
  rows,
  colors,
  typography,
}: {
  rows: RestaurantRow[];
  colors: any;
  typography: any;
}) {
  return (
    <View style={[s.card, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[s.tableRow, { borderBottomColor: colors.stroke, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8, marginBottom: 2 }]}>
        <Text style={[s.th, { color: colors.inkFaint, fontFamily: typography.body, flex: 2 }]}>Restaurante</Text>
        <Text style={[s.th, { color: colors.inkFaint, fontFamily: typography.body }]}>Total</Text>
        <Text style={[s.th, { color: colors.inkFaint, fontFamily: typography.body }]}>Activas</Text>
        <Text style={[s.th, { color: colors.inkFaint, fontFamily: typography.body }]}>€ med.</Text>
        <Text style={[s.th, { color: colors.inkFaint, fontFamily: typography.body }]}>Plazas</Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[s.tableRow, {
            borderBottomColor: colors.stroke,
            borderBottomWidth: i < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
          }]}
        >
          <Text style={[s.td, { color: colors.ink, fontFamily: typography.body, flex: 2 }]} numberOfLines={1}>
            {i + 1}. {row.restaurant_name}
          </Text>
          <Text style={[s.td, { color: colors.ink, fontFamily: typography.heading }]}>{row.total_offers}</Text>
          <Text style={[s.td, { color: '#22C55E', fontFamily: typography.heading }]}>{row.active_offers}</Text>
          <Text style={[s.td, { color: colors.brand, fontFamily: typography.heading }]}>{row.avg_price}</Text>
          <Text style={[s.td, { color: colors.ink, fontFamily: typography.body }]}>{row.total_seats}</Text>
        </View>
      ))}
      {rows.length === 0 && (
        <Text style={{ color: colors.inkFaint, fontSize: 13, fontFamily: typography.body, paddingVertical: 12, textAlign: 'center' }}>
          Sin datos todavía
        </Text>
      )}
    </View>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DirectorPanel({ onLogout }: { onLogout: () => void }) {
  const { colors, typography } = useTheme();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noData, setNoData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read latest snapshot from BigQuery
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoData(false);
    try {
      const [hRes, rRes] = await Promise.all([
        fetch(`${BASE_URL}/dashboard/history`),
        fetch(`${BASE_URL}/dashboard/restaurants`),
      ]);
      if (!hRes.ok || !rRes.ok) throw new Error('Error al cargar datos');
      const [hData, rData] = await Promise.all([hRes.json(), rRes.json()]);
      const snapshots: Metrics[] = hData.snapshots ?? [];
      if (snapshots.length === 0) {
        setNoData(true);
      } else {
        setMetrics(snapshots[0]);
      }
      setRestaurants(rData.restaurants ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute fresh metrics, save to BigQuery, then update display
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/dashboard/metrics`);
      if (!res.ok) throw new Error('Error al generar snapshot');
      const data = await res.json();
      setMetrics(data);
      setNoData(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.shell }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.stroke }]}>
        <View>
          <Text style={[s.eyebrow, { color: colors.inkFaint, fontFamily: typography.body }]}>
            PANEL DIRECTIVO
          </Text>
          <Text style={[s.title, { color: colors.ink, fontFamily: typography.heading }]}>
            Métricas de plataforma
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <TouchableOpacity
            onPress={refresh}
            disabled={refreshing}
            style={[s.refreshBtn, { borderColor: colors.brand, opacity: refreshing ? 0.5 : 1 }]}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={colors.brand} />
              : <Text style={{ color: colors.brand, fontSize: 12, fontFamily: typography.body }}>↻ Generar snapshot</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout}>
            <Text style={{ color: colors.inkFaint, fontSize: 11, fontFamily: typography.body }}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      )}

      {error && !loading && (
        <View style={s.center}>
          <Text style={{ color: '#EF4444', fontFamily: typography.body }}>{error}</Text>
          <TouchableOpacity onPress={load} style={[s.btn, { backgroundColor: colors.brand, marginTop: 16, paddingHorizontal: 24 }]}>
            <Text style={[s.btnText, { fontFamily: typography.heading }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && noData && (
        <View style={s.center}>
          <Text style={{ color: colors.inkMuted, fontFamily: typography.body, textAlign: 'center', marginBottom: 8 }}>
            No hay snapshots en BigQuery todavía.
          </Text>
          <Text style={{ color: colors.inkFaint, fontFamily: typography.body, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
            Pulsa "Generar snapshot" para calcular las métricas y guardarlas en BigQuery.
          </Text>
          <TouchableOpacity
            onPress={refresh}
            disabled={refreshing}
            style={[s.btn, { backgroundColor: colors.brand, paddingHorizontal: 28, opacity: refreshing ? 0.5 : 1 }]}
          >
            {refreshing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[s.btnText, { fontFamily: typography.heading }]}>Generar primer snapshot</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && metrics && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Source + timestamp */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.brand, fontSize: 10, fontFamily: typography.body, letterSpacing: 1.5, fontWeight: '700' }}>
              FUENTE: BIGQUERY
            </Text>
            <Text style={[s.snapshotTime, { color: colors.inkFaint, fontFamily: typography.body, marginBottom: 0 }]}>
              {new Date(metrics.snapshot_at).toLocaleString('es-ES')}
            </Text>
          </View>

          {/* KPI grid — row 1: offers */}
          <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
            OFERTAS EN TIEMPO REAL
          </Text>
          <View style={s.kpiGrid}>
            <KpiCard label="Activas ahora" value={metrics.active_offers} color="#22C55E" colors={colors} typography={typography} />
            <KpiCard label="Publicadas hoy" value={metrics.total_offers_today} colors={colors} typography={typography} />
            <KpiCard label="Última hora" value={metrics.offers_last_hour} colors={colors} typography={typography} />
            <KpiCard label="Canceladas hoy" value={metrics.cancelled_today} sub={`${metrics.cancellation_rate_today}%`} color="#EF4444" colors={colors} typography={typography} />
          </View>

          {/* KPI grid — row 2: restaurants */}
          <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 20 }]}>
            RESTAURANTES
          </Text>
          <View style={s.kpiGrid}>
            <KpiCard label="Registrados" value={metrics.registered_restaurants} colors={colors} typography={typography} />
            <KpiCard label="Activos hoy" value={metrics.active_restaurants_today} color="#22C55E" colors={colors} typography={typography} />
            <KpiCard label="Activos semana" value={metrics.active_restaurants_week} colors={colors} typography={typography} />
            <KpiCard label="Conexiones WS" value={metrics.ws_connections} colors={colors} typography={typography} />
          </View>

          {/* KPI grid — row 3: prices */}
          <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 20 }]}>
            PLAZAS Y PRECIOS
          </Text>
          <View style={s.kpiGrid}>
            <KpiCard label="Plazas disponibles" value={metrics.total_seats_available} colors={colors} typography={typography} />
            <KpiCard label="Precio medio" value={`${metrics.avg_offer_price} €`} color={colors.brand} colors={colors} typography={typography} />
            <KpiCard label="Duración media" value={`${metrics.avg_duration_min} min`} colors={colors} typography={typography} />
            <KpiCard label="Total histórico" value={restaurants.reduce((acc, r) => acc + r.total_offers, 0)} colors={colors} typography={typography} />
          </View>

          {/* Bar chart — top restaurants by offers */}
          {restaurants.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 20 }]}>
                RANKING POR OFERTAS PUBLICADAS
              </Text>
              <HBarChart
                rows={restaurants.slice(0, 8).map((r, i) => ({
                  label: r.restaurant_name,
                  value: r.total_offers,
                  color: ['#6366F1', '#8B5CF6', '#A78BFA', '#C4B5FD', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'][i % 8],
                }))}
                colors={colors}
                typography={typography}
              />
            </>
          )}

          {/* Ranking table */}
          <Text style={[s.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body, marginTop: 20 }]}>
            TABLA DE RESTAURANTES
          </Text>
          <RankingTable rows={restaurants} colors={colors} typography={typography} />

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function DirectorDashboardPage({ onClose, alreadyAuthenticated }: { onClose?: () => void; alreadyAuthenticated?: boolean } = {}) {
  const [authenticated, setAuthenticated] = useState(alreadyAuthenticated ?? false);
  if (!authenticated) return <DirectorLogin onLogin={() => setAuthenticated(true)} onClose={onClose} />;
  return <DirectorPanel onLogout={() => { setAuthenticated(false); onClose?.(); }} />;
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
  refreshBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  scroll: { padding: 16 },
  snapshotTime: { fontSize: 11, marginBottom: 16, textAlign: 'right' },
  sectionTitle: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600', marginBottom: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  kpiCard: {
    flex: 1, minWidth: 130, borderRadius: 14, padding: 14,
    alignItems: 'flex-start',
  },
  kpiValue: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { fontSize: 11, marginTop: 4 },
  kpiSub: { fontSize: 11, marginTop: 2 },
  card: { borderRadius: 14, padding: 16, marginBottom: 4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 4 },
  th: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1, textAlign: 'right' },
  td: { fontSize: 12, flex: 1, textAlign: 'right' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
