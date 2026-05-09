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
import { BASE_URL } from '../services/api';
import { useTheme } from '../utils/theme';

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
            {/* ── Sección: Ofertas ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              OFERTAS DE MESA
            </Text>
            <View style={styles.row}>
              <KpiCard label="Activas ahora" value={metrics.active_offers}
                accent="#3B82F6" sub="en tiempo real" colors={colors} typography={typography} />
              <KpiCard label="Última hora" value={metrics.offers_last_hour}
                accent="#8B5CF6" colors={colors} typography={typography} />
            </View>
            <View style={styles.row}>
              <KpiCard label="Hoy" value={metrics.total_offers_today}
                accent="#10B981" colors={colors} typography={typography} />
              <KpiCard label="Total histórico" value={metrics.total_offers_alltime}
                accent="#64748B" colors={colors} typography={typography} />
            </View>
            <View style={styles.row}>
              <KpiCard label="Canceladas hoy" value={metrics.cancelled_today}
                accent="#EF4444" colors={colors} typography={typography} />
              <KpiCard label="Tasa cancelación" value={fmt(metrics.cancellation_rate_today, 1)}
                unit="%" accent="#F59E0B" colors={colors} typography={typography} />
            </View>

            {/* ── Sección: Restaurantes ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              RESTAURANTES
            </Text>
            <View style={styles.row}>
              <KpiCard label="Registrados" value={metrics.registered_restaurants}
                accent="#EC4899" sub="total histórico" colors={colors} typography={typography} />
              <KpiCard label="Activos hoy" value={metrics.active_restaurants_today}
                accent="#F97316" colors={colors} typography={typography} />
            </View>
            <View style={styles.row}>
              <KpiCard label="Activos esta semana" value={metrics.active_restaurants_week}
                accent="#06B6D4" colors={colors} typography={typography} />
            </View>

            {/* ── Sección: Plazas y precios ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              PLAZAS Y PRECIOS
            </Text>
            <View style={styles.row}>
              <KpiCard label="Plazas disponibles" value={metrics.total_seats_available}
                accent="#22C55E" sub="en oferta activa" colors={colors} typography={typography} />
              <KpiCard label="Media plazas/oferta" value={fmt(metrics.avg_seats_per_offer, 1)}
                accent="#84CC16" colors={colors} typography={typography} />
            </View>
            <View style={styles.row}>
              <KpiCard label="Precio medio" value={fmt(metrics.avg_offer_price, 2)}
                unit="€" accent="#F59E0B" colors={colors} typography={typography} />
              <KpiCard label="Precio mínimo" value={fmt(metrics.min_price_active, 2)}
                unit="€" accent="#10B981" colors={colors} typography={typography} />
            </View>
            <View style={styles.row}>
              <KpiCard label="Precio máximo" value={fmt(metrics.max_price_active, 2)}
                unit="€" accent="#EF4444" colors={colors} typography={typography} />
              <KpiCard label="Duración media" value={fmt(metrics.avg_duration_min, 0)}
                unit="min" accent="#6366F1" colors={colors} typography={typography} />
            </View>

            {/* ── Sección: Plataforma ── */}
            <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
              PLATAFORMA
            </Text>
            <View style={styles.row}>
              <KpiCard label="Conexiones WebSocket" value={metrics.ws_connections}
                accent="#3B82F6" sub="clientes en tiempo real" colors={colors} typography={typography} />
            </View>

            {/* ── Histórico BigQuery ── */}
            {history.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.inkFaint, fontFamily: typography.body }]}>
                  HISTÓRICO BIGQUERY — Ofertas activas
                </Text>
                <View style={[styles.historyBox, { backgroundColor: colors.surface }]}>
                  <View style={[styles.historyHeader, { borderBottomColor: colors.stroke }]}>
                    <Text style={[styles.historyHeaderText, { color: colors.inkMuted, fontFamily: typography.body }]}>Hora</Text>
                    <Text style={[styles.historyHeaderText, { color: colors.inkMuted, fontFamily: typography.body, flex: 1, textAlign: 'center' }]}>Evolución</Text>
                    <Text style={[styles.historyHeaderText, { color: colors.inkMuted, fontFamily: typography.body }]}>Activas</Text>
                  </View>
                  {history.slice(0, 20).map((s, i) => (
                    <HistoryRow key={i} snapshot={s} maxOffers={maxOffers} colors={colors} typography={typography} />
                  ))}
                  <Text style={[styles.historyFooter, { color: colors.inkFaint, fontFamily: typography.body }]}>
                    {history.length} snapshots guardados en BigQuery
                  </Text>
                </View>
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
  historyBox: { borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  historyHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  historyHeaderText: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '600' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyTs: { fontSize: 12, width: 42 },
  historyVal: { fontSize: 14, fontWeight: '700', width: 28, textAlign: 'right' },
  historyFooter: {
    fontSize: 11, textAlign: 'center', paddingVertical: 10,
  },
});
