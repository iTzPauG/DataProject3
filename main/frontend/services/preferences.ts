import { BASE_URL } from './api';

type LocalMapStyle = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'minimal';
type LocalLanguage = 'system' | 'es' | 'en' | 'fr';
type LocalTheme = 'system' | 'light' | 'dark';

export interface LocalPreferencesSnapshot {
  mapStyle: LocalMapStyle;
  gadoOverlay: boolean;
  defaultRadiusM: number;
  language: LocalLanguage;
  theme: LocalTheme;
  showRealTimeEvents: boolean;
}

export interface RemotePreferences {
  default_radius_m?: number;
  favorite_cats?: string[];
  map_style?: string;
  map_minimal?: boolean;
  map_preset?: string;
  gado_overlay_on?: boolean;
  notifications_on?: boolean;
  language?: string;
  theme?: string;
  show_real_time_events?: boolean;
}

function normalizeRemotePreferences(data: unknown): RemotePreferences | null {
  if (!data || typeof data !== 'object') return null;
  const raw = (data as { preferences?: RemotePreferences }).preferences ?? (data as RemotePreferences);
  return raw && typeof raw === 'object' ? raw : null;
}

function normalizeMapStyle(
  mapStyle: string | undefined,
  mapMinimal: boolean | undefined,
  fallback: LocalMapStyle,
): LocalMapStyle {
  if (mapMinimal) return 'minimal';
  switch (mapStyle) {
    case 'standard':
    case 'satellite':
    case 'hybrid':
    case 'terrain':
      return mapStyle;
    default:
      return fallback;
  }
}

function normalizeTheme(theme: string | undefined, fallback: LocalTheme): LocalTheme {
  switch (theme) {
    case 'system':
    case 'light':
    case 'dark':
      return theme;
    default:
      return fallback;
  }
}

function normalizeLanguage(language: string | undefined, fallback: LocalLanguage): LocalLanguage {
  switch (language) {
    case 'system':
    case 'es':
    case 'en':
    case 'fr':
      return language;
    default:
      return fallback;
  }
}

export async function fetchRemotePreferences(idToken: string): Promise<RemotePreferences | null> {
  try {
    const res = await fetch(`${BASE_URL}/preferences`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeRemotePreferences(data);
  } catch {
    return null;
  }
}

export async function saveRemotePreferences(
  idToken: string,
  prefs: RemotePreferences,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(prefs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function toLocalPreferences(
  remote: RemotePreferences,
  fallback: LocalPreferencesSnapshot,
): LocalPreferencesSnapshot {
  return {
    mapStyle: normalizeMapStyle(remote.map_style, remote.map_minimal, fallback.mapStyle),
    gadoOverlay: remote.gado_overlay_on ?? fallback.gadoOverlay,
    defaultRadiusM: remote.default_radius_m ?? fallback.defaultRadiusM,
    language: normalizeLanguage(remote.language, fallback.language),
    theme: normalizeTheme(remote.theme, fallback.theme),
    showRealTimeEvents: remote.show_real_time_events ?? fallback.showRealTimeEvents,
  };
}

export function toRemotePreferences(
  local: LocalPreferencesSnapshot,
): RemotePreferences {
  return {
    map_style: local.mapStyle === 'minimal' ? 'standard' : local.mapStyle,
    map_minimal: local.mapStyle === 'minimal',
    map_preset: local.gadoOverlay ? 'drive' : 'classic',
    gado_overlay_on: local.gadoOverlay,
    show_real_time_events: local.showRealTimeEvents,
    default_radius_m: local.defaultRadiusM,
    theme: local.theme,
    language: local.language,
  };
}
