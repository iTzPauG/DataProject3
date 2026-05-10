import { useEffect, useState, useCallback } from 'react';
import { storage } from '../utils/storage';
import { getBookmarks } from '../services/api';
import type { SavedItem } from '../types';

const SAVED_PINS_KEY = 'whim_saved_pins';
const RECENT_VIEWS_KEY = 'whim_recent_restaurant_views';
const RECENT_VIEWS_MAX = 30;

export interface RecentView {
  id: string;
  name: string;
  ts: number;
  tags?: string[];
}

export interface UserProfile {
  /** Names of saved/bookmarked restaurants (across cloud bookmarks + local pins). */
  savedNames: string[];
  /** Recent restaurant views (most recent first). */
  recentViews: RecentView[];
  /** Tag tokens derived from saves + recent views — used for matching against section affinityTags. */
  positiveTags: Set<string>;
  /**
   * Tag tokens that the user has been signaling negatively. Currently we only
   * push tags here when a user explicitly says "no" via voting (left for a
   * future hook into /votes); for now it is empty unless a caller adds them.
   */
  negativeTags: Set<string>;
  loading: boolean;
  /** True when bookmarks were fetched from the server (i.e. user is signed in). */
  hasCloudBookmarks: boolean;
  /** Push a restaurant view into the local recent-views ring buffer. */
  recordRecentView: (id: string, name: string, tags?: string[]) => Promise<void>;
}

/**
 * Tokenize a string into lowercase keyword tokens. Strips punctuation and
 * filters out tiny tokens so noise like "de", "la" don't pollute affinity.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

export function useUserProfile(): UserProfile {
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [positiveTags, setPositiveTags] = useState<Set<string>>(new Set());
  const [negativeTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [hasCloudBookmarks, setHasCloudBookmarks] = useState(false);

  // Initial load: bookmarks (cloud) + saved_pins (local) + recent views (local).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [cloudBookmarks, localPinsRaw, recentRaw] = await Promise.all([
          getBookmarks().catch(() => [] as SavedItem[]),
          storage.getItem(SAVED_PINS_KEY).catch(() => null),
          storage.getItem(RECENT_VIEWS_KEY).catch(() => null),
        ]);
        if (cancelled) return;

        const names = new Set<string>();
        const pos = new Set<string>();

        for (const b of cloudBookmarks) {
          if (b.title) names.add(b.title);
          tokenize(b.title || '').forEach((t) => pos.add(t));
          const subcat = (b.metadata as any)?.subcategory;
          if (typeof subcat === 'string' && subcat) tokenize(subcat).forEach((t) => pos.add(t));
        }

        if (localPinsRaw) {
          try {
            const pins: any[] = JSON.parse(localPinsRaw);
            for (const p of pins) {
              if (p?.name) {
                names.add(p.name);
                tokenize(p.name).forEach((t) => pos.add(t));
              }
            }
          } catch {}
        }

        let recent: RecentView[] = [];
        if (recentRaw) {
          try {
            recent = JSON.parse(recentRaw) as RecentView[];
            for (const r of recent.slice(0, 10)) {
              tokenize(r.name).forEach((t) => pos.add(t));
              (r.tags || []).forEach((t) => pos.add(t.toLowerCase()));
            }
          } catch {}
        }

        setSavedNames(Array.from(names));
        setRecentViews(recent);
        setPositiveTags(pos);
        setHasCloudBookmarks(cloudBookmarks.length > 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordRecentView = useCallback(
    async (id: string, name: string, tags?: string[]) => {
      try {
        const raw = await storage.getItem(RECENT_VIEWS_KEY);
        const current: RecentView[] = raw ? JSON.parse(raw) : [];
        const filtered = current.filter((r) => r.id !== id);
        const next: RecentView[] = [
          { id, name, ts: Date.now(), tags },
          ...filtered,
        ].slice(0, RECENT_VIEWS_MAX);
        await storage.setItem(RECENT_VIEWS_KEY, JSON.stringify(next));
        setRecentViews(next);
        setPositiveTags((prev) => {
          const updated = new Set(prev);
          tokenize(name).forEach((t) => updated.add(t));
          (tags || []).forEach((t) => updated.add(t.toLowerCase()));
          return updated;
        });
      } catch {
        // best-effort — ignore failures
      }
    },
    [],
  );

  return {
    savedNames,
    recentViews,
    positiveTags,
    negativeTags,
    loading,
    hasCloudBookmarks,
    recordRecentView,
  };
}
