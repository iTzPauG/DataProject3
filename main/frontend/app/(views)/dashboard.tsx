import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '../../services/api';
import { useTheme } from '../../utils/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Metrics {
  snapshot_at: string;
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
  min_price_active: number;
  max_price_active: number;
  avg_seats_per_offer: number;
  avg_duration_min: number;
  ws_connections: number;
  saved_to_bigquery: boolean;
}

// ── Bar chart horizontal ──────────────────────────────────────────────────────
function HBarChart({
  rows,
  colors,
  typography,
}: {
  rows: { label: string; value: number; color: string }[];
  colors: any;
  typography: any;
}) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, gap: 14 }]}>
      {rows.map((row, i) => (
        <View key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: typography.body }}>{row.label}</Text>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.heading }}>{row.value}</Text>
          </View>
          <View style={{ height: 10, backgroundColor: colors.shell, borderRadius: 5, overflow: 'hidden' }}>
            <View style={{
              height: '100%',
              width: `${Math.max((row.value / max) * 100, row.value > 0 ? 4 : 0)}%` as any,
              backgroundColor: row.color,
              borderRadius: 5,
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Tabla de métricas ─────────────────────────────────────────────────────────
function MetricsTable({
  rows,
  colors,
  typography,
}: {
  rows: { label: string; value: string | number; accent?: string }[];
  colors: any;
  typography: any;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, padding: 0, overflow: 'hidden' }]}>
      {rows.map((row, i) => (
        <View key={i} style={[
          styles.tableRow,
          { borderBottomColor: colors.stroke, borderBottomWidth: i < rows.length - 1 ? StyleSheet.hairlineWidth : 0 },
        ]}>
          <Text style={[styles.tableLabel, { color: colors.inkMuted, fontFamily: typography.body }]}>{row.label}</Text>
          <Text style={[styles.tableValue, {
            color: row.accent ?? colors.ink,
            fontFamily: typography.heading,
          }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Gráfico de barras vertical (histórico) ────────────────────────────────────
function VerticalBarChart({
  history,
  colors,
  typography,
}: {
  history: Record<string, any>[];
  colors: any;
  typography: any;
}) {
  const bars = [...history].reverse().slice(-24);
  const maxVal = Math.max(...bars.map(s => s.active_offers ?? 0), 1);
  if (bars.length === 0) return null;
  const first = new Date(bars[0].snapshot_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const last  = new Date(bars[bars.length - 1].snapshot_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90 }}>
        {bars.map((s, i) => {
          const pct = (s.active_offers ?? 0) / maxVal;
          return (
            <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <View style={{
                height: `${Math.max(pct * 100, s.active_offers > 0 ? 4 : 1)}%` as any,
                backgroundColor: '#3B82F6',
                borderRadius: 3,
                opacity: 0.5 + pct * 0.5,
              }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ color: colors.inkFaint, fontSize: 10, fontFamily: typography.mono }}>{first}</Text>
        <Text style={[{ color: colors.inkFaint, fontSize: 10, fontFamily: typography.body, textAlign: 'center', flex: 1 }]}>
          Ofertas activas — {bars.length} snapshots BigQuery
        </Text>
        <Text style={{ color: colors.inkFaint, fontSize: 10, fontFamily: typography.mono }}>{last}</Text>
      </View>
    </View>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  unit,
  accent,
  sub,
  colors,
  typography,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  sub?: string;
  colors: any;
  typography: any;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [value]);

  return (
    <Animated.View style={{ opacity: fadeAnim, flex: 1, minWidth: 140 }}>
      <View style={[styles.card, { borderTopColor: accent, borderTopWidth: 3, backgroundColor: colors.surface }]}>
        <Text style={[styles.cardLabel, { color: colors.inkFaint, fontFamily: typography.body }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
          <Text style={[styles.cardValue, { color: colors.ink, fontFamily: typography.heading }]}>{value}</Text>
          {unit && <Text style={[styles.cardUnit, { color: colors.inkMuted, fontFamily: typography.body }]}>{unit}</Text>}
        </View>
        {sub && <Text style={[styles.cardSub, { color: colors.inkMuted, fontFamily: typography.body }]}>{sub}</Text>}
        <View style={[styles.cardAccentDot, { backgroundColor: accent }]} />
      </View>
    </Animated.View>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={{ height: 6, backgroundColor: '#ffffff10', borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({
  snapshot,
  maxOffers,
  colors,
  typography,
}: {
  snapshot: Record<string, any>;
  maxOffers: number;
  colors: any;
  typography: any;
}) {
  const ts = new Date(snapshot.snapshot_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.historyRow, { borderBottomColor: colors.stroke }]}>
      <Text style={[styles.historyTs, { color: colors.inkFaint, fontFamily: typography.mono }]}>{ts}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <MiniBar value={snapshot.active_offers ?? 0} max={maxOffers} color="#3B82F6" />
      </View>
      <Text style={[styles.historyVal, { color: colors.ink, fontFamily: typography.heading }]}>
        {snapshot.active_offers ?? 0}
      </Text>
    </View>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
const REFRESH_SECONDS = 30;

export default function ExecutiveDashboard() {
  const { colors, typography } = useTheme();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [bqStatus, setBqStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const [metricsRes, historyRes] = await Promise.all([
        fetch(`${BASE_URL}/dashboard/metrics`),
        fetch(`${BASE_URL}/dashboard/history`),
      ]);
      if (!metricsRes.ok) throw new Error(`Backend error ${metricsRes.status}`);
      const m: Metrics = await metricsRes.json();
      setMetrics(m);
      setBqStatus(m.saved_to_bigquery ? 'saved' : 'idle');

      if (historyRes.ok) {
        const h = await historyRes.json();
        setHistory(h.snapshots ?? []);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setCountdown(REFRESH_SECONDS);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchMetrics();
          return REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [fetchMetrics]);

  const fmt = (n: number, decimals = 0) =>
    isNaN(n) ? '—' : n.toFixed(decimals).replace('.', ',');
  const fmtTs = (iso: string) => {
    try { return new Date(iso).toLocaleString('es-ES'); } catch { return iso; }
  };

  const maxOffers = history.length > 0
    ? Math.max(...history.map(s => s.active_offers ?? 0), 1)
    : 1;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.shell, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.inkMuted, fontFamily: typography.body, marginTop: 12 }}>
          Cargando métricas...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.shell }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.inkFaint, fontFamily: typography.body }]}>
              VISTA DIRECTIVA
            </Text>
            <Text style={[styles.title, { color: colors.ink, fontFamily: typography.heading }]}>
              Dashboard Ejecutivo
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.surface, borderColor: colors.stroke }]}
            onPress={fetchMetrics}
          >
            <Text style={[styles.refreshText, { color: colors.inkMuted, fontFamily: typography.mono }]}>
              ↻ {countdown}s
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Last update + BQ status ── */}
        {metrics && (
          <View style={[styles.statusBar, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statusText, { color: colors.inkMuted, fontFamily: typography.body }]}>
              Actualizado: {fmtTs(metrics.snapshot_at)}
            </Text>
            <View style={[styles.bqBadge, {
              backgroundColor: bqStatus === 'saved' ? '#22C55E20' : '#94A3B820',
            }]}>
              <Text style={[styles.bqText, {
                color: bqStatus === 'saved' ? '#22C55E' : colors.inkMuted,
                fontFamily: typography.body,
              }]}>
                {bqStatus === 'saved' ? '✓ BigQuery guardado' : '○ BigQuery no configurado'}
              </Text>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {metrics && (
          <>
            {/* ── Sección: Ofertas — KPIs destacados ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              OFERTAS DE MESA
            </Text>
            <View style={styles.row}>
              <KpiCard label="Activas ahora" value={metrics.active_offers}
                accent="#3B82F6" sub="en tiempo real" colors={colors} typography={typography} />
              <KpiCard label="Total histórico" value={metrics.total_offers_alltime}
                accent="#64748B" colors={colors} typography={typography} />
            </View>

            {/* ── Gráfico de barras: comparativa de ofertas ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              COMPARATIVA DE ACTIVIDAD
            </Text>
            <HBarChart
              colors={colors}
              typography={typography}
              rows={[
                { label: 'Activas ahora',     value: metrics.active_offers,           color: '#3B82F6' },
                { label: 'Última hora',        value: metrics.offers_last_hour,        color: '#8B5CF6' },
                { label: 'Publicadas hoy',     value: metrics.total_offers_today,      color: '#10B981' },
                { label: 'Canceladas hoy',     value: metrics.cancelled_today,         color: '#EF4444' },
              ]}
            />

            {/* ── Sección: Restaurantes — tabla ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              RESTAURANTES
            </Text>
            <MetricsTable
              colors={colors}
              typography={typography}
              rows={[
                { label: 'Restaurantes registrados',    value: metrics.registered_restaurants },
                { label: 'Activos hoy',                 value: metrics.active_restaurants_today,  accent: metrics.active_restaurants_today > 0 ? '#10B981' : undefined },
                { label: 'Activos esta semana',         value: metrics.active_restaurants_week },
                { label: 'Tasa de cancelación hoy',     value: `${fmt(metrics.cancellation_rate_today, 1)} %`, accent: metrics.cancellation_rate_today > 20 ? '#EF4444' : '#F59E0B' },
              ]}
            />

            {/* ── Sección: Plazas y precios — tabla ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              PLAZAS Y PRECIOS
            </Text>
            <MetricsTable
              colors={colors}
              typography={typography}
              rows={[
                { label: 'Plazas disponibles ahora',    value: metrics.total_seats_available },
                { label: 'Media plazas / oferta',       value: fmt(metrics.avg_seats_per_offer, 1) },
                { label: 'Precio medio (€)',             value: `${fmt(metrics.avg_offer_price, 2)} €` },
                { label: 'Precio mínimo activo (€)',     value: `${fmt(metrics.min_price_active, 2)} €`,  accent: '#10B981' },
                { label: 'Precio máximo activo (€)',     value: `${fmt(metrics.max_price_active, 2)} €`,  accent: '#EF4444' },
                { label: 'Duración media oferta',        value: `${fmt(metrics.avg_duration_min, 0)} min` },
              ]}
            />

            {/* ── Sección: Plataforma ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              PLATAFORMA
            </Text>
            <View style={styles.row}>
              <KpiCard label="Conexiones WebSocket" value={metrics.ws_connections}
                accent="#3B82F6" sub="clientes en tiempo real" colors={colors} typography={typography} />
            </View>

            {/* ── Histórico BigQuery — gráfico vertical ── */}
            {history.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
                  EVOLUCIÓN BIGQUERY
                </Text>
                <VerticalBarChart history={history} colors={colors} typography={typography} />
              </>
            )}
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, gap: 0 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: 16,
  },
  eyebrow: { fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  refreshBtn: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1,
  },
  refreshText: { fontSize: 13 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, padding: 10, marginBottom: 20, flexWrap: 'wrap', gap: 8,
  },
  statusText: { fontSize: 12 },
  bqBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  bqText: { fontSize: 12, fontWeight: '600' },
  errorBox: { backgroundColor: '#EF444420', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#EF4444', fontSize: 13 },
  sectionTitle: {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600',
    marginBottom: 10, marginTop: 24,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: {
    flex: 1, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    position: 'relative', overflow: 'hidden',
  },
  cardLabel: { fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '600' },
  cardValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  cardUnit: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  cardSub: { fontSize: 11, marginTop: 4 },
  cardAccentDot: {
    position: 'absolute', bottom: -6, right: -6,
    width: 32, height: 32, borderRadius: 16, opacity: 0.12,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  tableLabel: { fontSize: 13, flex: 1 },
  tableValue: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
});
