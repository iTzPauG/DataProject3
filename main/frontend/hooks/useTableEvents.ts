import { useCallback, useEffect, useRef, useState } from 'react';
import { BASE_URL } from '../services/api';

export interface TableEvent {
  id: string;
  restaurant_name: string;
  seats: number;
  price: number;
  description?: string | null;
  ends_at: string;
  is_active: number | boolean;
  created_at?: string;
}

function toWsUrl(baseUrl: string, path: string): string {
  if (baseUrl.startsWith('https://')) return `${baseUrl.replace('https://', 'wss://')}${path}`;
  if (baseUrl.startsWith('http://')) return `${baseUrl.replace('http://', 'ws://')}${path}`;
  return `ws://${baseUrl.replace(/^\/+/, '')}${path}`;
}

export function useTableEvents() {
  const [events, setEvents] = useState<TableEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const wsUrl = toWsUrl(BASE_URL, '/table-events/ws');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'init' && Array.isArray(msg.events)) {
          setEvents(msg.events);
        } else if (msg.type === 'new_event' && msg.event) {
          setEvents((prev) => [msg.event, ...prev.filter((e) => e.id !== msg.event.id)]);
        } else if (msg.type === 'event_cancelled' && msg.event_id) {
          setEvents((prev) => prev.filter((e) => e.id !== msg.event_id));
        }
      } catch {
        // noop
      }
    };

    ws.onerror = () => setConnected(false);

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { events, connected };
}
