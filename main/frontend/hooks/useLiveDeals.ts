import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BASE_URL } from '../services/api';

export interface LiveDeal {
  id: string;
  owner_uid: string;
  restaurant_name: string;
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
  return {
    id: String(raw.id),
    owner_uid: String(raw.owner_uid ?? ''),
    restaurant_name: String(raw.restaurant_name ?? 'Restaurante'),
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
  }, []); // stable — uses refs internally

  const connectWs = useCallback(() => {
    if (!enabled) return;
    const wsUrl = toWebSocketUrl(BASE_URL);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchInitial();
    // fetchInitial is stable (uses refs) so this only fires once on mount / enabled change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
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
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled, connectWs]);

  const activeDeals = useMemo(
    () => deals.filter((d) => Boolean(d.is_active) && Number.isFinite(d.lat) && Number.isFinite(d.lng)),
    [deals],
  );

  return { deals: activeDeals, connected, reload: fetchInitial };
}
