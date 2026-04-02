import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

interface UseRealtimeOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  enabled?: boolean;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 *
 * Usage:
 * ```ts
 * useRealtime(
 *   { table: 'community_reports', event: 'INSERT', enabled: true },
 *   (payload) => {
 *     // Add new report pin to map
 *     console.log('New report:', payload.new);
 *   }
 * );
 * ```
 */
export function useRealtime(
  options: UseRealtimeOptions,
  callback: RealtimeCallback,
): void {
  const { table, event = '*', filter, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime:${table}:${event}:${filter ?? 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: any) => {
          callbackRef.current({
            eventType: payload.eventType,
            new: payload.new ?? {},
            old: payload.old ?? {},
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, event, filter, enabled]);
}
