import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';

type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

interface UseRealtimeOptions {
  /** Firestore collection name (e.g. 'deals', 'community_reports') */
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** Optional Firestore where filter, e.g. "is_active==true" */
  filter?: string;
  enabled?: boolean;
}

/**
 * Subscribe to Firestore real-time changes on a collection.
 *
 * Usage:
 * ```ts
 * useRealtime(
 *   { table: 'deals', enabled: true },
 *   (payload) => console.log('New deal:', payload.new),
 * );
 * ```
 */
export function useRealtime(options: UseRealtimeOptions, callback: RealtimeCallback): void {
  const { table, enabled = true } = options;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const colRef = collection(db, table);
    const q = query(colRef, orderBy('created_at', 'desc'), limit(50));

    // Track previous docs to detect INSERT vs UPDATE vs DELETE
    const prevDocs = new Map<string, Record<string, unknown>>();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const newData = { id: change.doc.id, ...change.doc.data() } as Record<string, unknown>;
        const oldData = prevDocs.get(change.doc.id) ?? {};

        let eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        if (change.type === 'added') eventType = 'INSERT';
        else if (change.type === 'modified') eventType = 'UPDATE';
        else eventType = 'DELETE';

        callbackRef.current({ eventType, new: newData, old: oldData });

        if (change.type === 'removed') prevDocs.delete(change.doc.id);
        else prevDocs.set(change.doc.id, newData);
      });
    });

    return unsubscribe;
  }, [table, enabled]);
}
