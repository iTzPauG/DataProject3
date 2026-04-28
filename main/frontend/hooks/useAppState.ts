import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Restaurant } from '../types/restaurant';
import { MapItem } from '../types/map';
import { storage } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapRegion {
  lat: number;
  lng: number;
  latDelta: number;
  lngDelta: number;
}

export type MapStyle = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'minimal';

export interface MapPreferences {
  mapStyle: MapStyle;
  gadoOverlay: boolean;
  defaultRadiusM: number;
  showRealTimeEvents: boolean;
  theme: 'system' | 'light' | 'dark';
  language: 'system' | 'es' | 'en' | 'fr';
}

interface AppState {
  // Flow state (preserved from useFlowState)
  parentCategory: string | null;
  category: string | null;
  mood: string | null;
  priceLevel: 1 | 2 | 3 | null;
  results: Restaurant[] | null;
  // Map state
  mapRegion: MapRegion | null;
  selectedCategory: string | null;
  nearbyItems: MapItem[];
  mapPreferences: MapPreferences;
}

interface AppStateContextValue extends AppState {
  // Flow setters
  setParentCategory: (pc: string | null) => void;
  setCategory: (c: string) => void;
  setMood: (m: string) => void;
  setPriceLevel: (p: 1 | 2 | 3) => void;
  setResults: (r: Restaurant[]) => void;
  resetFlow: () => void;
  // Map setters
  setMapRegion: (r: MapRegion | null) => void;
  setSelectedCategory: (c: string | null) => void;
  setNearbyItems: (items: MapItem[]) => void;
  setMapPreferences: (prefs: Partial<MapPreferences>) => void;
  /** true once the initial storage load has completed */
  isHydrated: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_STATE: AppState = {
  parentCategory: null,
  category: null,
  mood: null,
  priceLevel: null,
  results: null,
  mapRegion: null,
  selectedCategory: null,
  nearbyItems: [],
  mapPreferences: {
    mapStyle: 'minimal',
    gadoOverlay: true,
    defaultRadiusM: 10_000,
    showRealTimeEvents: true,
    theme: 'system',
    language: 'system',
  },
};

const STORAGE_KEY = '@whim/app_state';

// ─── Context ──────────────────────────────────────────────────────────────────

const AppStateContext = createContext<AppStateContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppStateProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<AppState>;
          // Don't persist nearbyItems (they're transient)
          delete parsed.nearbyItems;
          
          // Ensure mapPreferences is never null
          if (parsed.mapPreferences === null) {
            delete parsed.mapPreferences;
          }
          
          setState((prev) => ({ 
            ...prev, 
            ...parsed,
            mapPreferences: {
              ...prev.mapPreferences,
              ...(parsed.mapPreferences || {}),
            }
          }));
        } catch {
          // corrupt data — start fresh
        }
      }
      setIsHydrated(true);
    });
  }, []);

  // Persist when state changes (skip transient fields)
  useEffect(() => {
    if (!isHydrated) return;
    const { nearbyItems, ...persistable } = state;
    storage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [state, isHydrated]);

  // ── Flow setters ──────────────────────────────────────────────────────────

  const setParentCategory = useCallback((parentCategory: string | null) => {
    setState((s) => ({ 
      ...s, 
      parentCategory, 
      category: null, 
      mood: null, 
      priceLevel: null, 
      results: null 
    }));
  }, []);

  const setCategory = useCallback((category: string) => {
    setState((s) => ({ 
      ...s, 
      category, 
      mood: null, 
      priceLevel: null, 
      results: null 
    }));
  }, []);

  const setMood = useCallback((mood: string) => {
    setState((s) => ({ 
      ...s, 
      mood, 
      priceLevel: null, 
      results: null 
    }));
  }, []);

  const setPriceLevel = useCallback((priceLevel: 1 | 2 | 3) => {
    setState((s) => ({ ...s, priceLevel, results: null }));
  }, []);

  const setResults = useCallback((results: Restaurant[]) => {
    setState((s) => ({ ...s, results }));
  }, []);

  const resetFlow = useCallback(() => {
    setState((s) => ({
      ...s,
      parentCategory: null,
      category: null,
      mood: null,
      priceLevel: null,
      results: null,
    }));
  }, []);

  // ── Map setters ───────────────────────────────────────────────────────────

  const setMapRegion = useCallback((mapRegion: MapRegion | null) => {
    setState((s) => ({ ...s, mapRegion }));
  }, []);

  const setSelectedCategory = useCallback((selectedCategory: string | null) => {
    setState((s) => ({ ...s, selectedCategory }));
  }, []);

  const setNearbyItems = useCallback((nearbyItems: MapItem[]) => {
    setState((s) => ({ ...s, nearbyItems }));
  }, []);

  const setMapPreferences = useCallback((prefs: Partial<MapPreferences>) => {
    setState((s) => ({
      ...s,
      mapPreferences: {
        ...s.mapPreferences,
        ...prefs,
      },
    }));
  }, []);

  const value: AppStateContextValue = {
    ...state,
    setParentCategory,
    setCategory,
    setMood,
    setPriceLevel,
    setResults,
    resetFlow,
    setMapRegion,
    setSelectedCategory,
    setNearbyItems,
    setMapPreferences,
    isHydrated,
  };

  return React.createElement(AppStateContext.Provider, { value }, children);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside <AppStateProvider>');
  }
  return ctx;
}

// ─── Backward-compatible hook (delegates to useAppState) ──────────────────────

export function useFlowState() {
  const appState = useAppState();
  return {
    parentCategory: appState.parentCategory,
    category: appState.category,
    mood: appState.mood,
    priceLevel: appState.priceLevel,
    results: appState.results,
    setParentCategory: appState.setParentCategory,
    setCategory: appState.setCategory,
    setMood: appState.setMood,
    setPriceLevel: appState.setPriceLevel,
    setResults: appState.setResults,
    reset: appState.resetFlow,
    isHydrated: appState.isHydrated,
  };
}
