import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_URL } from '../services/api';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { firebaseConfigured, firestoreDb } from '../services/firebase';

export interface LiveDeal {
  id: string;
  owner_uid: string;
  restaurant_name: string;
  cuisine?: string | null;
  restaurant_cuisines?: string[];
  restaurant_place_id?: string | null;
  lat: number;
  lng: number;
  price: number;
  original_price?: number | null;
  seats: number;
  available_at: string;
  description?: string | null;
  is_active: boolean | number;
  created_at?: string;
  expires_at?: string | null;
}

export interface ReservationEvent {
  deal_id: string;
  owner_uid: string;
  reservation: {
    id: string;
    customer_name: string;
    customer_phone: string;
    created_at: string;
  };
}

function normalizeDeal(raw: any): LiveDeal {
  const parsedCuisines = Array.isArray(raw.restaurant_cuisines)
    ? raw.restaurant_cuisines.map((v: unknown) => String(v)).filter(Boolean)
    : [];

  return {
    id: String(raw.id),
    owner_uid: String(raw.owner_uid ?? ''),
    restaurant_name: String(raw.restaurant_name ?? 'Restaurante'),
    cuisine: raw.cuisine == null ? null : String(raw.cuisine),
    restaurant_cuisines: parsedCuisines,
    restaurant_place_id: raw.restaurant_place_id ?? null,
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    price: Number(raw.price),
    original_price: raw.original_price == null ? null : Number(raw.original_price),
    seats: Number(raw.seats ?? 1),
    available_at: String(raw.available_at ?? new Date().toISOString()),
    description: raw.description ?? null,
    is_active: raw.is_active,
    created_at: raw.created_at ?? undefined,
    expires_at: raw.expires_at ?? null,
  };
}

function toWebSocketUrl(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) return `${baseUrl.replace('https://', 'wss://')}/deals/ws`;
  if (baseUrl.startsWith('http://')) return `${baseUrl.replace('http://', 'ws://')}/deals/ws`;
  return `ws://${baseUrl.replace(/^\/+/, '')}/deals/ws`;
}

export function useLiveDeals(params: {
  lat?: number;
  lng?: number;
  radiusM?: number;
  enabled?: boolean;
  ownerUid?: string | null;
  onReservation?: (event: ReservationEvent) => void;
}) {
  const { lat, lng, radiusM = 5000, enabled = true, ownerUid, onReservation } = params;
  const [deals, setDeals] = useState<LiveDeal[]>([]);
  const [connected, setConnected] = useState(false);
  const [firestoreDenied, setFirestoreDenied] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const usingFirestore = firebaseConfigured && firestoreDb != null && !ownerUid && !firestoreDenied;

  // Use refs so fetchInitial closure doesn't change on every pan/zoom
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const radiusRef = useRef(radiusM);
  latRef.current = lat;
  lngRef.current = lng;
  radiusRef.current = radiusM;

  const onReservationRef = useRef(onReservation);
  onReservationRef.current = onReservation;
  const ownerUidRef = useRef(ownerUid);
  ownerUidRef.current = ownerUid;

  // fetchInitial uses refs so it never changes reference → no re-fetch on pan/zoom
  const fetchInitial = useCallback(async () => {
    if (usingFirestore) return;
    const q = new URLSearchParams();
    if (latRef.current != null) q.set('lat', String(latRef.current));
    if (lngRef.current != null) q.set('lng', String(lngRef.current));
    q.set('radius_m', String(radiusRef.current));

    try {
      const res = await fetch(`${BASE_URL}/deals?${q.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data.deals) ? data.deals.map(normalizeDeal) : [];
      setDeals(items);
    } catch {
      // noop
    }
  }, [usingFirestore]); // stable enough; uses refs internally

  const connectWs = useCallback(() => {
    if (!enabled || usingFirestore) return;
    const wsUrl = toWebSocketUrl(BASE_URL);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      void fetchInitial();
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        try {
          ws.send('ping');
        } catch {
          // noop
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'deal_created' && payload.deal) {
          const deal = normalizeDeal(payload.deal);
          setDeals((prev) => [deal, ...prev.filter((d) => d.id !== deal.id)]);
        } else if (payload.event === 'deal_updated' && payload.deal) {
          const deal = normalizeDeal(payload.deal);
          setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)));
        } else if (payload.event === 'deal_deleted' && payload.deal_id) {
          const dealId = String(payload.deal_id);
          setDeals((prev) => prev.filter((d) => d.id !== dealId));
        } else if (payload.event === 'reservation_created' && payload.owner_uid) {
          // Notify the owning restaurant
          if (ownerUidRef.current && payload.owner_uid === ownerUidRef.current) {
            onReservationRef.current?.({
              deal_id: String(payload.deal_id),
              owner_uid: String(payload.owner_uid),
              reservation: payload.reservation,
            });
          } else if (!ownerUidRef.current) {
            const dealId = String(payload.deal_id);
            setDeals((prev) => prev.filter((d) => d.id !== dealId));
          }
        }
      } catch {
        // noop
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
      if (!enabled) return;
      reconnectTimer.current = setTimeout(() => {
        connectWs();
      }, 1500);
    };
  }, [enabled, usingFirestore, fetchInitial]);

  useEffect(() => {
    if (!enabled || !usingFirestore || !firestoreDb) return;

    setConnected(true);
    const dealsQuery = query(collection(firestoreDb, 'deals'));
    const unsubscribe = onSnapshot(
      dealsQuery,
      (snapshot) => {
        const parsed = snapshot.docs.map((doc) => normalizeDeal({ id: doc.id, ...doc.data() }));
        const active = parsed.filter((deal) => Boolean(deal.is_active));
        const inRadius = active.filter((deal) => {
            if (!Number.isFinite(deal.lat) || !Number.isFinite(deal.lng)) return false;
            if (latRef.current == null || lngRef.current == null) return true;
            const dlat = (deal.lat - latRef.current) * 111000;
            const dlng = (deal.lng - lngRef.current) * 111000 * 0.7;
            const distance = (dlat ** 2 + dlng ** 2) ** 0.5;
            return distance <= radiusRef.current;
          });

        const items = inRadius.length > 0 || active.length === 0 ? inRadius : active;

        console.info('[deals/firestore]', {
          totalDocs: snapshot.size,
          activeDocs: active.length,
          inRadiusDocs: inRadius.length,
          returnedDocs: items.length,
          radiusFallbackUsed: inRadius.length === 0 && active.length > 0,
          centerLat: latRef.current,
          centerLng: lngRef.current,
          radiusM: radiusRef.current,
        });
        setDeals(items);
      },
      (error) => {
        console.error('[deals/firestore] snapshot error', error);
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'permission-denied') {
          setFirestoreDenied(true);
          void fetchInitial();
        }
        setConnected(false);
      },
    );

    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, [enabled, usingFirestore]);

  useEffect(() => {
    if (!enabled) return;
    void fetchInitial();
    if (usingFirestore) return;
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
    }
    refreshTimer.current = setInterval(() => {
      void fetchInitial();
    }, 15000);
    // fetchInitial is stable (uses refs) so this only fires once on mount / enabled change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, usingFirestore, fetchInitial]);

  useEffect(() => {
    if (!enabled || usingFirestore) return;
    connectWs();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (pingTimer.current) {
        clearInterval(pingTimer.current);
        pingTimer.current = null;
      }
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled, usingFirestore, connectWs]);

  const activeDeals = useMemo(
    () => deals.filter((d) => Boolean(d.is_active) && Number.isFinite(d.lat) && Number.isFinite(d.lng)),
    [deals],
  );

  return { deals: activeDeals, connected, reload: fetchInitial };
}
