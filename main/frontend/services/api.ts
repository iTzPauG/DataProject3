import { Restaurant } from '../types/restaurant';
import { auth } from './supabase';
import { storage } from '../utils/storage';
import { Category, CommunityReport, MapItem, ReportType, SavedItem } from '../types';
import { FALLBACK_CATEGORIES } from './mapService';
import i18n from '../utils/i18n';

// Derive the backend URL with autodetection for Railway production
const getBaseUrl = () => {
  const rawEnvUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  const envUrl = rawEnvUrl?.trim().replace(/^['"]+|['"]+$/g, '');
  
  // If we have a valid environment URL and it's not localhost (or we ARE on localhost), use it
  if (envUrl && (!envUrl.includes('localhost') || (typeof window !== 'undefined' && window.location.hostname === 'localhost'))) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }

  // Autodetection for Railway: If we are on X.up.railway.app, the backend is likely on backend-production-XXXX.up.railway.app
  // Or more simply, if BASE_URL is missing in production web, we can try to use a relative path or a known pattern.
  if (typeof window !== 'undefined' && window.location.hostname.includes('railway.app')) {
    // For WHIM, we know the production backend URL pattern
    return 'https://backend-production-bac63.up.railway.app';
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8000`;
    }
  }
  return 'http://localhost:8000';
};

export const BASE_URL = getBaseUrl();

/** Build a URL string with query params — works even when BASE_URL is relative. */
function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const base = `${BASE_URL}${path}`;
  if (!params) return base;
  const qs = Object.entries(params)
    .filter((e): e is [string, string] => e[1] != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `${base}?${qs}` : base;
}

async function parseJsonResponse<T>(res: Response, context: string): Promise<T> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(
      `${context} returned non-JSON. Check EXPO_PUBLIC_BACKEND_URL (${BASE_URL}). Response: ${preview}`
    );
  }
}

// Valencia city centre — fallback when geolocation is unavailable or denied
const VALENCIA_LAT = 39.4699;
const VALENCIA_LNG = -0.3763;

interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

const DEFAULT_LOCATION_OPTIONS: Required<LocationOptions> = {
  enableHighAccuracy: true,
  timeoutMs: 10000,
  maximumAgeMs: 0,
};

const EXPLORE_LOCATION_OPTIONS: Required<LocationOptions> = {
  enableHighAccuracy: false,
  timeoutMs: 3500,
  maximumAgeMs: 3 * 60 * 1000,
};

let lastKnownLocation: { lat: number; lng: number; timestamp: number } | null = null;

export function getCurrentLocation(options: LocationOptions = {}): Promise<{ lat: number; lng: number }> {
  const finalOptions = {
    ...DEFAULT_LOCATION_OPTIONS,
    ...options,
  };

  return new Promise((resolve) => {
    const now = Date.now();
    if (
      lastKnownLocation &&
      finalOptions.maximumAgeMs > 0 &&
      now - lastKnownLocation.timestamp <= finalOptions.maximumAgeMs
    ) {
      resolve({ lat: lastKnownLocation.lat, lng: lastKnownLocation.lng });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[LOCATION] Geolocation not supported, using fallback.');
      resolve({ lat: VALENCIA_LAT, lng: VALENCIA_LNG });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('[LOCATION] Got current position:', pos.coords.latitude, pos.coords.longitude);
        lastKnownLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        };
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn('[LOCATION] Geolocation error, using fallback:', err.message);
        resolve({ lat: VALENCIA_LAT, lng: VALENCIA_LNG });
      },
      {
        enableHighAccuracy: finalOptions.enableHighAccuracy,
        timeout: finalOptions.timeoutMs,
        maximumAge: finalOptions.maximumAgeMs,
      }
    );
  });
}

/**
 * ExploreCategory extends the base Category type with optional display fields
 * that may be returned by the API for richer explore grid cards.
 */
export interface ExploreCategory extends Category {
  /** Alternative to `icon` — some legacy responses use `emoji` field. */
  emoji?: string;
  description?: string;
  active?: boolean;
}

export interface ReportTypeOption {
  id: string;
  label: string;
  emoji: string;
  description?: string;
  color?: string;
}

export interface CategoryFlowOption {
  id: string;
  label: string;
  emoji: string;
  description?: string;
}

export interface CategoryFlowCategory extends ExploreCategory {
  search_mode?: 'guided_ranked' | 'nearby_list' | 'event_list' | 'report_only';
  requires_price?: boolean;
  fallback_radius_m?: number;
  max_radius_m?: number;
  provider_types?: string[];
  mood_title?: string;
  mood_subtitle?: string;
  skip_price_moods?: string[];
  skip_price_subcategories?: string[];
}

export interface CategoryFlowResponse {
  category: CategoryFlowCategory;
  subcategories: CategoryFlowOption[];
  moods: CategoryFlowOption[];
}

const DEFAULT_REPORT_TYPES: ReportType[] = [
  { id: 'traffic', label: 'Tráfico cortado', icon: '🚧', color: '#FF4444', duration_h: 2, sort_order: 1, is_active: true },
  { id: 'accident', label: 'Accidente', icon: '💥', color: '#FF4444', duration_h: 3, sort_order: 2, is_active: true },
  { id: 'police', label: 'Control policial', icon: '👮', color: '#3B82F6', duration_h: 2, sort_order: 3, is_active: true },
  { id: 'queue', label: 'Cola larga', icon: '👥', color: '#F59E0B', duration_h: 1, sort_order: 4, is_active: true },
  { id: 'popup_market', label: 'Mercadillo', icon: '🏪', color: '#10B981', duration_h: 6, sort_order: 5, is_active: true },
  { id: 'food_truck', label: 'Food truck', icon: '🚚', color: '#FF6B35', duration_h: 4, sort_order: 6, is_active: true },
  { id: 'live_music', label: 'Música en vivo', icon: '🎸', color: '#8B5CF6', duration_h: 4, sort_order: 7, is_active: true },
  { id: 'street_show', label: 'Espectáculo calle', icon: '🎭', color: '#EC4899', duration_h: 3, sort_order: 8, is_active: true },
  { id: 'free_stuff', label: 'Cosa gratis', icon: '🎁', color: '#22C55E', duration_h: 2, sort_order: 9, is_active: true },
  { id: 'road_closure', label: 'Corte de calle', icon: '🚫', color: '#EF4444', duration_h: 4, sort_order: 10, is_active: true },
  { id: 'parking_free', label: 'Parking libre', icon: '🅿️', color: '#0EA5E9', duration_h: 2, sort_order: 11, is_active: true },
  { id: 'protest', label: 'Manifestación', icon: '✊', color: '#F97316', duration_h: 3, sort_order: 12, is_active: true },
  { id: 'construction', label: 'Obras', icon: '👷', color: '#94A3B8', duration_h: 48, sort_order: 13, is_active: true },
  { id: 'other', label: 'Otro', icon: '📍', color: '#6366F1', duration_h: 3, sort_order: 14, is_active: true },
  { id: 'noise', label: 'Ruido excesivo', icon: '🔊', color: '#EF4444', duration_h: 3, sort_order: 15, is_active: true },
  { id: 'flooding', label: 'Inundación', icon: '🌊', color: '#3B82F6', duration_h: 12, sort_order: 16, is_active: true },
  { id: 'broken_light', label: 'Farola fundida', icon: '💡', color: '#F59E0B', duration_h: 72, sort_order: 17, is_active: true },
  { id: 'lost_found', label: 'Objeto perdido', icon: '🔍', color: '#8B5CF6', duration_h: 24, sort_order: 18, is_active: true },
  { id: 'fire', label: 'Incendio', icon: '🔥', color: '#DC2626', duration_h: 6, sort_order: 19, is_active: true },
  { id: 'animal', label: 'Animal en calzada', icon: '🐾', color: '#10B981', duration_h: 2, sort_order: 20, is_active: true },
  { id: 'graffiti', label: 'Vandalismo', icon: '🖌️', color: '#6B7280', duration_h: 48, sort_order: 21, is_active: true },
  { id: 'fallen_tree', label: 'Árbol caído', icon: '🌳', color: '#059669', duration_h: 24, sort_order: 22, is_active: true },
  { id: 'water_cut', label: 'Corte de agua', icon: '🚿', color: '#0EA5E9', duration_h: 8, sort_order: 23, is_active: true },
  { id: 'power_cut', label: 'Corte de luz', icon: '⚡', color: '#F97316', duration_h: 8, sort_order: 24, is_active: true },
];

const FLOW_FALLBACKS: Record<string, CategoryFlowResponse> = {
  food: {
    category: { id: 'food', label: 'Comida y bebida', icon: '🍴', color: '#FF6B35', sort_order: 1, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Cuál es el plan?', mood_subtitle: 'Elige el ambiente perfecto' },
    subcategories: [
      { id: 'pizza', label: 'Pizza', emoji: '🍕' },
      { id: 'hamburger', label: 'Hamburguesas', emoji: '🍔' },
      { id: 'sushi', label: 'Sushi', emoji: '🍣' },
      { id: 'paella', label: 'Paella', emoji: '🥘' },
      { id: 'tacos', label: 'Tacos', emoji: '🌮' },
      { id: 'healthy', label: 'Saludable', emoji: '🥗' },
      { id: 'vegan', label: 'Vegano', emoji: '🌱' },
      { id: 'italian', label: 'Italiano', emoji: '🍝' },
      { id: 'asian', label: 'Asiático', emoji: '🍜' },
      { id: 'mexican', label: 'Mexicano', emoji: '🫔' },
      { id: 'brunch', label: 'Brunch', emoji: '🥞' },
      { id: 'bakery', label: 'Panadería', emoji: '🥐' },
      { id: 'coffee', label: 'Cafetería', emoji: '☕' },
      { id: 'kebab', label: 'Kebab', emoji: '🌯' },
    ],
    moods: [
      { id: 'quick', label: 'Algo rápido', emoji: '⚡' },
      { id: 'casual', label: 'Informal', emoji: '😊' },
      { id: 'date', label: 'Cita', emoji: '❤️' },
      { id: 'family', label: 'Familiar', emoji: '👨‍👩‍👧' },
      { id: 'celebration', label: 'Celebración', emoji: '🎉' },
      { id: 'sharing', label: 'Para compartir', emoji: '🥂' },
      { id: 'gourmet', label: 'Gourmet', emoji: '👨‍🍳' },
      { id: 'comfort_food', label: 'Antojo', emoji: '🍲' },
    ],
  },
};

const ANON_FP_KEY = 'anon_fingerprint';

async function getAnonFingerprint(): Promise<string> {
  const existing = await storage.getItem(ANON_FP_KEY);
  if (existing) return existing;
  const fp = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  await storage.setItem(ANON_FP_KEY, fp);
  return fp;
}

function sanitize(raw: Record<string, unknown>): Restaurant {
  const id = String(raw.id ?? raw.place_id ?? '');
  const clamp = (n: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, n));
  const reviewSourcesRaw =
    typeof raw.reviewSources === 'object' && raw.reviewSources !== null
      ? raw.reviewSources as Record<string, unknown>
      : typeof raw.review_sources === 'object' && raw.review_sources !== null
        ? raw.review_sources as Record<string, unknown>
        : null;
  const rawPhotoUrl = String(
    raw.photoUrl ??
    raw.photo_url ??
    raw.imageUrl ??
    raw.image_url ??
    ''
  );
  const photoUrl = rawPhotoUrl.startsWith('/') ? `${BASE_URL}${rawPhotoUrl}` : rawPhotoUrl;

  return {
    id,
    name:               String(raw.name ?? ''),
    priceLevel:         clamp(Math.round(Number(raw.priceLevel ?? 1)), 1, 3) as 1 | 2 | 3,
    rating:             Math.round(Number(raw.rating ?? 0) * 10) / 10,
    reviewsCount:       Math.round(Number(raw.reviewsCount ?? raw.user_rating_count ?? 0)),
    address:            String(raw.address ?? ''),
    phone:              String(raw.phone ?? ''),
    photoUrl,
    tagline:            String(raw.tagline ?? raw.category_id ?? ''),
    why:                String(raw.why ?? raw.description ?? ''),
    tags:               Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
    lat:                Number(raw.lat ?? VALENCIA_LAT),
    lng:                Number(raw.lng ?? VALENCIA_LNG),
    distanceM:          Math.round(Number(raw.distanceM ?? raw.distance_m ?? 0)),
    bestReviewQuote:    String(raw.bestReviewQuote ?? raw.best_review_quote ?? ''),
    reviewQualityScore: Math.round(Number(raw.reviewQualityScore ?? raw.review_quality_score ?? 0.5) * 100) / 100,
    pros:               Array.isArray(raw.pros) ? (raw.pros as unknown[]).map(String) : [],
    cons:               Array.isArray(raw.cons) ? (raw.cons as unknown[]).map(String) : [],
    verdict:            String(raw.verdict ?? ''),
    reviews:            Array.isArray(raw.reviews)
      ? (raw.reviews as Array<Record<string, unknown>>).map((review) => ({
          author: String(review.author ?? ''),
          rating: Number(review.rating ?? 0),
          text: String(review.text ?? ''),
          relative_time: String(review.relative_time ?? ''),
          source:
            review.source === 'google' || review.source === 'yelp' || review.source === 'tripadvisor'
              ? review.source as 'google' | 'yelp' | 'tripadvisor'
              : undefined,
        }))
      : [],
    reviewSources: reviewSourcesRaw
      ? {
          google: Math.max(0, Math.round(Number(reviewSourcesRaw.google ?? 0))),
          yelp: Math.max(0, Math.round(Number(reviewSourcesRaw.yelp ?? 0))),
          tripadvisor: Math.max(0, Math.round(Number(reviewSourcesRaw.tripadvisor ?? 0))),
        }
      : undefined,
    liveData:           typeof raw.liveData === 'object' && raw.liveData !== null ? raw.liveData as Record<string, any> : undefined,
  };
}

// ── Voting ──────────────────────────────────────────────────────────────────

export interface VoteData {
  likes: number;
  dislikes: number;
  userVote: number; // 1 = liked, -1 = disliked, 0 = no vote
}

export interface VoteResponse {
  success: boolean;
  status: string;
  vote: number;
  userVote: number;
  likes: number;
  dislikes: number;
  total_likes?: number;
  total_dislikes?: number;
}

export async function castVote(
  itemId: string,
  itemType: 'place' | 'event',
  vote: 1 | -1,
): Promise<VoteResponse> {
  const token = await auth.currentUser?.getIdToken() ?? null;
  const res = await fetch(`${BASE_URL}/votes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language || 'es',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ item_id: itemId, item_type: itemType, vote }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json() as { detail?: string };
      detail = data.detail ? ` - ${data.detail}` : '';
    } catch {
      // ignore parse failures and fall back to status only
    }
    throw new Error(`Vote failed: ${res.status}${detail}`);
  }
  return res.json();
}

export async function getVotesBatch(
  ids: string[],
): Promise<Record<string, VoteData>> {
  if (ids.length === 0) return {};
  try {
      const res = await fetch(`${BASE_URL}/votes/batch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept-Language': i18n.language || 'es'
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return {};
      const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON from poll: ${text.slice(0, 100)}`);
        }
      return data.votes ?? {};
  } catch {
      return {};
  }
}

export async function getVotes(
  itemId: string,
): Promise<VoteData | null> {
  try {
      const res = await fetch(`${BASE_URL}/votes/${itemId}`, {
        headers: { 'Accept-Language': i18n.language || 'es' }
      });
      if (!res.ok) return null;
      return await res.json();
  } catch {
      return null;
  }
}

function normalizeSearchResult(raw: Record<string, unknown>, fallbackCategory?: string | null): MapItem {
  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? { ...(raw.metadata as Record<string, unknown>) }
      : {};

  const rating =
    typeof metadata.rating === 'number'
      ? metadata.rating
      : Number(metadata.rating ?? 0);
  const reviewsCount =
    typeof metadata.user_rating_count === 'number'
      ? metadata.user_rating_count
      : Number(metadata.user_rating_count ?? metadata.reviews_count ?? 0);
  const distanceM = Math.round(Number(raw.distance_m ?? metadata.distance_m ?? 0));
  const name = String(raw.name ?? raw.title ?? '');
  const source = String(raw.source ?? metadata.source ?? '');
  const query = String(metadata.query ?? '');

  if (!metadata.address && raw.address) {
    metadata.address = String(raw.address);
  }
  if (!metadata.rating && Number.isFinite(rating) && rating > 0) {
    metadata.rating = rating;
  }
  if (!metadata.user_rating_count && Number.isFinite(reviewsCount) && reviewsCount > 0) {
    metadata.user_rating_count = reviewsCount;
  }
  if (!metadata.source && source) {
    metadata.source = source;
  }
  if (!metadata.query && query) {
    metadata.query = query;
  }
  // Prefix relative photo URLs (Google Places proxy) with backend base URL
  if (typeof metadata.photo_url === 'string' && metadata.photo_url.startsWith('/')) {
    metadata.photo_url = `${BASE_URL}${metadata.photo_url}`;
  }
  if (!metadata.why) {
    const whyBits = [
      query ? `It matches your search for ${query}.` : '',
      distanceM > 0 ? `It is roughly ${Math.round(distanceM)}m away.` : '',
      rating > 0 ? `Current rating is ${rating.toFixed(1)}.` : '',
      source ? `Source: ${source}.` : '',
    ].filter(Boolean);
    metadata.why = whyBits.join(' ');
  }

  return {
    item_type: String(raw.item_type ?? 'place') as 'place' | 'event' | 'report',
    item_id: String(raw.id ?? raw.item_id ?? ''),
    category_id: String(raw.category_id ?? fallbackCategory ?? 'services'),
    title: name,
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    distance_m: distanceM,
    metadata,
  };
}

export async function searchUniversalPlaces(params: {
  query: string;
  lat: number;
  lng: number;
  radiusM?: number;
  category?: string | null;
}): Promise<MapItem[]> {
  const searchUrl = buildUrl('/search/universal', {
    q: params.query,
    lat: String(params.lat),
    lng: String(params.lng),
    radius_m: String(params.radiusM ?? 5000),
    use_brain: 'true',
    category: params.category ?? undefined,
  });

  try {
    const res = await fetch(searchUrl, {
      headers: { 
        Accept: 'application/json',
        'Accept-Language': i18n.language || 'es'
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    return (data.results ?? [])
      .map((item) => normalizeSearchResult(item, params.category))
      .filter((item) => item.item_type === 'place' || item.item_type === 'event');
  } catch {
    return [];
  }
}

// ── Recommend ───────────────────────────────────────────────────────────────

interface RecommendInput {
  parentCategory: string;
  subcategory: string;
  mood: string;
  priceLevel?: 1 | 2 | 3 | null;
  fast?: boolean;
  language?: string;
}

export async function recommendRestaurants(
  input: RecommendInput
): Promise<{ top: Restaurant[] }> {
  const { parentCategory, subcategory, mood, priceLevel, fast = false, language = 'es' } = input;
  const { lat, lng } = await getCurrentLocation(EXPLORE_LOCATION_OPTIONS);

  const recommendUrl = buildUrl('/recommend', { fast: fast ? 'true' : undefined });

  const res = await fetch(recommendUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': i18n.language || 'es'
    },
    body: JSON.stringify({
      parent_category: parentCategory,
      subcategory,
      category: subcategory,
      mood,
      priceLevel: priceLevel ?? undefined,
      lat,
      lng,
      language,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Backend error ${res.status}: ${detail}`);
  }

  const data = await parseJsonResponse<{ top?: Array<Record<string, unknown>> }>(res, 'recommend');
  const top: Restaurant[] = (data.top ?? []).map(
    (r: Record<string, unknown>) => sanitize(r)
  );
  return { top };
}

// ── Progressive Recommend (polling-based) ───────────────────────────────────

interface RecommendStreamInput extends Omit<RecommendInput, 'fast'> {
  language?: string;
}

export interface StreamCallbacks {
  onMeta?: (data: { total: number }) => void;
  onResult: (restaurant: Restaurant) => void;
  onDone?: (total: number) => void;
  onError?: (error: Error) => void;
}

const POLL_INTERVAL_MS = 250;
const STAGGER_DELAY_MS = 50; // keep progressive rendering but avoid artificial slowness

export async function recommendRestaurantsStream(
  input: RecommendStreamInput,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { parentCategory, subcategory, mood, priceLevel, language = 'es' } = input;
  const { lat, lng } = await getCurrentLocation(EXPLORE_LOCATION_OPTIONS);

  // Step 1: Start the job
  const startRes = await fetch(buildUrl('/recommend/start'), {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': i18n.language || 'es'
    },
    body: JSON.stringify({
      parent_category: parentCategory,
      subcategory,
      category: subcategory,
      mood,
      priceLevel: priceLevel ?? undefined,
      lat,
      lng,
      language,
    }),
  });

  if (!startRes.ok) {
    const detail = await startRes.text();
    throw new Error(`Start error ${startRes.status}: ${detail}`);
  }

  const startData = await parseJsonResponse<{ job_id?: string }>(startRes, 'recommend/start');
  const job_id = startData.job_id;
  if (!job_id) {
    throw new Error('recommend/start did not return job_id');
  }

  // Step 2: Poll for results every POLL_INTERVAL_MS
  let cursor = 0;
  let metaFired = false;

  return new Promise<void>((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await fetch(buildUrl(`/recommend/poll/${job_id}`, { after: String(cursor) }), {
          headers: {
            Accept: 'application/json',
            'Accept-Language': i18n.language || 'es'
          }
        });
        if (!res.ok) {
          throw new Error(`Poll error ${res.status}`);
        }
        const data = await parseJsonResponse<{
          results?: Array<Record<string, unknown>>;
          total?: number;
          done?: boolean;
          cursor?: number;
        }>(res, 'recommend/poll');

        // Fire meta once we know the total
        if (!metaFired && data.total != null) {
          metaFired = true;
          callbacks.onMeta?.({ total: data.total });
        }

        cursor = typeof data.cursor === 'number' ? data.cursor : cursor;
        const pollResults = Array.isArray(data.results) ? data.results : [];
        const pollDone = data.done === true;

        if (pollResults.length > 0) {
          // Stagger delivery of results to break React batching.
          // Each result gets its own setTimeout so React renders each individually.
          const results = pollResults;
          const isDone = pollDone;

          for (let i = 0; i < results.length; i++) {
            setTimeout(() => {
              callbacks.onResult(sanitize(results[i]));

              // If this is the last staggered result AND the job is done, resolve
              if (i === results.length - 1 && isDone) {
                callbacks.onDone?.(cursor);
                resolve();
              }
            }, i * STAGGER_DELAY_MS);
          }

          // Schedule next poll AFTER all staggered deliveries finish
          if (!isDone) {
            const nextPollDelay = Math.max(POLL_INTERVAL_MS, results.length * STAGGER_DELAY_MS + 50);
            setTimeout(poll, nextPollDelay);
          }
        } else if (pollDone) {
          callbacks.onDone?.(cursor);
          resolve();
        } else {
          // No new results yet, keep polling
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      }
    };

    // First poll quickly — meta should be available almost immediately
    setTimeout(poll, 150);
  });
}

export async function getCategoryFlow(categoryId: string): Promise<CategoryFlowResponse> {
  const fallback = FLOW_FALLBACKS[categoryId] ?? FLOW_FALLBACKS.food;

  try {
    const res = await fetch(`${BASE_URL}/categories/flow/${categoryId}`, {
      headers: { 'Accept-Language': i18n.language || 'es' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Failed to fetch category flow');
    const data = await res.json() as Partial<CategoryFlowResponse>;
    if (!data.category) return fallback;
    return {
      category: {
        ...fallback.category,
        ...data.category,
      },
      subcategories: data.subcategories && data.subcategories.length > 0 ? data.subcategories : fallback.subcategories,
      moods: data.moods && data.moods.length > 0 ? data.moods : fallback.moods,
    };
  } catch {
    return fallback;
  }
}

export async function getExploreCategories(): Promise<ExploreCategory[]> {
  try {
    const res = await fetch(`${BASE_URL}/categories`, {
      headers: { 'Accept-Language': i18n.language || 'es' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Failed to fetch categories');
    const data = await res.json() as { categories?: ExploreCategory[] };
    return data.categories && data.categories.length > 0 ? data.categories : FALLBACK_CATEGORIES;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

export async function getReportTypes(): Promise<ReportType[]> {
  try {
    const res = await fetch(`${BASE_URL}/reports/types`, {
      headers: { 'Accept-Language': i18n.language || 'es' }
    });
    if (!res.ok) throw new Error('Failed to fetch report types');
    const data = await res.json();
    return data.types && data.types.length > 0 ? data.types : DEFAULT_REPORT_TYPES;
  } catch {
    return DEFAULT_REPORT_TYPES;
  }
}

export interface CreateReportInput {
  reportType: string;
  title: string;
  description?: string;
  durationHours?: number;
  /** When true the report is submitted without linking to the user account */
  anonymous?: boolean;
  lat?: number;
  lng?: number;
}

export async function createReport(input: CreateReportInput): Promise<{ report: CommunityReport }> {
  console.log('[API] Starting report creation...');
  const token = await auth.currentUser?.getIdToken() ?? null;
  const session = token ? { access_token: token } : null;
  console.log('[API] Session obtained:', session ? 'User logged in' : 'Anonymous');

  const { lat: currentLat, lng: currentLng } = await getCurrentLocation();
  const lat = input.lat ?? currentLat;
  const lng = input.lng ?? currentLng;
  console.log('[API] Location for report:', lat, lng);

  // If anonymous flag is set (or no session), use fingerprint instead of user account
  const useAnon = input.anonymous || !session;
  const anon_fingerprint = useAnon ? await getAnonFingerprint() : undefined;
  const payload = {
    report_type: input.reportType,
    title: input.title,
    description: input.description ?? '',
    lat,
    lng,
    duration_hours: input.durationHours ?? 4,
    anon_fingerprint,
  };

  console.log('[API] Sending POST to /reports with payload:', JSON.stringify(payload));
  
  const res = await fetch(`${BASE_URL}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language || 'es',
      ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  console.log('[API] Response status:', res.status);

  if (!res.ok) {
    const detail = await res.text();
    console.error('[API] Create report failed:', res.status, detail);
    throw new Error(`Failed to create report: ${res.status} ${detail}`);
  }
  
  const data = await res.json();
  console.log('[API] Report created successfully:', data);
  return data;
}

// ── Bookmarks ──────────────────────────────────────────────────────────────

export async function toggleBookmark(
  itemId: string,
  itemType: 'place' | 'event' | 'report',
  isBookmarked: boolean
): Promise<void> {
  const token = await auth.currentUser?.getIdToken() ?? null;
  const session = token ? { access_token: token } : null;
  if (!session) throw new Error('Authentication required');

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language || 'es',
    'Authorization': `Bearer ${session.access_token}`,
  };

  if (isBookmarked) {
    const res = await fetch(`${BASE_URL}/bookmarks/${itemId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to remove bookmark: ${res.status}`);
  } else {
    const res = await fetch(`${BASE_URL}/bookmarks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ item_id: itemId, item_type: itemType }),
    });
    if (!res.ok) throw new Error(`Failed to add bookmark: ${res.status}`);
  }
}

export async function getBookmarks(): Promise<SavedItem[]> {
  try {
    const token = await auth.currentUser?.getIdToken() ?? null;
  const session = token ? { access_token: token } : null;
    if (!session) return [];

    const res = await fetch(`${BASE_URL}/bookmarks`, {
      headers: {
        'Accept-Language': i18n.language || 'es',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.bookmarks || [];
  } catch {
    return [];
  }
}

export async function checkBookmark(itemId: string): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken() ?? null;
  const session = token ? { access_token: token } : null;
    if (!session) return false;

    const res = await fetch(`${BASE_URL}/bookmarks/${itemId}/check`, {
      headers: { 
        'Accept-Language': i18n.language || 'es',
        'Authorization': `Bearer ${session.access_token}` 
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.bookmarked === true;
  } catch {
    return false;
  }
}

export async function getMyReports(): Promise<CommunityReport[]> {
  try {
    const token = await auth.currentUser?.getIdToken() ?? null;
  const session = token ? { access_token: token } : null;
    if (!session) return [];

    const res = await fetch(`${BASE_URL}/reports/me`, {
      headers: {
        'Accept-Language': i18n.language || 'es',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reports || [];
  } catch {
    return [];
  }
}

// ── Live Data Addons ─────────────────────────────────────────────────────────

export interface FuelPrice {
  gasolina_95?: number;
  gasolina_98?: number;
  gasoleo_a?: number;
  gasoleo_premium?: number;
  glp?: number;
  gas_natural?: number;
  hidrogeno?: number;
}

export interface LiveDataResult {
  type: 'fuel_prices' | 'pharmacy_duty' | 'cinema_info' | 'ev_charging' | 'weather' | 'cinema_showtimes' | 'none';
  // fuel_prices
  found?: boolean;
  distance_m?: number;
  brand?: string;
  address?: string;
  schedule?: string;
  prices?: FuelPrice;
  updated_label?: string;
  // pharmacy_duty / cinema_info
  title?: string;
  description?: string;
  link_label?: string;
  link_url?: string;
  // ev_charging
  note?: string;
  // weather
  temperature?: number;
  feels_like?: number;
  humidity?: number;
  wind_kmh?: number;
  precipitation_mm?: number;
  uv_index?: number;
  weather_code?: number;
  weather_label?: string;
  weather_emoji?: string;
  outdoor_score?: number;
  outdoor_label?: string;
  alert?: string | null;
  // cinema_showtimes
  cinema_name?: string;
  cinema_website?: string | null;
  movies?: Array<{
    title: string;
    overview: string;
    poster_url: string | null;
    rating: number;
    genres: string[];
    release_date: string;
  }>;
}

export async function getPlaceLiveData(params: {
  placeId: string;
  lat: number;
  lng: number;
  category?: string;
  subcategory?: string;
  website?: string;
  name?: string;
  city?: string;
}): Promise<LiveDataResult> {
  try {
    const liveDataUrl = buildUrl(`/places/${params.placeId}/live-data`, {
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      category: params.category,
      subcategory: params.subcategory,
      website: params.website,
      name: params.name,
      city: params.city,
    });

    const res = await fetch(liveDataUrl, { 
      headers: { 
        Accept: 'application/json',
        'Accept-Language': i18n.language || 'es'
      } 
    });
    if (!res.ok) return { type: 'none' };
    return await res.json();
  } catch {
    return { type: 'none' };
  }
}

export async function getPlaceTake(params: {
  placeId: string;
  lat: number;
  lng: number;
  category?: string;
  subcategory?: string;
  language?: string;
  name?: string;
  address?: string;
  photoUrl?: string;
  rating?: number;
  priceLevel?: number;
  reviewsCount?: number;
}): Promise<Restaurant | null> {
  try {
    const takeUrl = buildUrl(`/places/${params.placeId}/take`, {
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      category: params.category,
      subcategory: params.subcategory,
      language: params.language,
      name: params.name,
      address: params.address,
      photo_url: params.photoUrl,
      rating: params.rating != null ? String(params.rating) : undefined,
      price_level: params.priceLevel != null ? String(params.priceLevel) : undefined,
      user_rating_count: params.reviewsCount != null ? String(params.reviewsCount) : undefined,
    });
    const res = await fetch(takeUrl, { 
      headers: { 
        Accept: 'application/json',
        'Accept-Language': i18n.language || 'es'
      } 
    });
    if (!res.ok) return null;
    return sanitize(await res.json());
  } catch {
    return null;
  }
}

export async function askBrain(message: string, context?: Record<string, unknown>): Promise<{ response: string }> {
  try {
    const token = await auth.currentUser?.getIdToken() ?? null;
    const res = await fetch(`${BASE_URL}/brain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': i18n.language || 'es',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, context }),
    });
    if (!res.ok) throw new Error('Failed to ask brain');
    return await res.json();
  } catch {
    return { response: 'Error al consultar el cerebro.' };
  }
}

export async function fetchNearbyItems(
    lat: number,
    lng: number,
    radius: number = 5000,
    category?: string | null,
    itemTypes: string[] = ["place", "event", "report"]
): Promise<import('../types/map').MapItem[]> {
    try {
        const qsParts = [
            `lat=${encodeURIComponent(lat)}`,
            `lng=${encodeURIComponent(lng)}`,
            `radius=${encodeURIComponent(radius)}`,
            ...(category ? [`category=${encodeURIComponent(category)}`] : []),
            ...itemTypes.map(t => `item_types=${encodeURIComponent(t)}`),
        ];
        const mapItemsUrl = `${BASE_URL}/map/items?${qsParts.join('&')}`;

        const res = await fetch(mapItemsUrl, {
            headers: { 
              'Accept': 'application/json',
              'Accept-Language': i18n.language || 'es'
            }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch {
        return [];
    }
}

export async function fetchPlaceExtra(placeId: string): Promise<{ take: string | null; live: any; vote: VoteData | null }> {
  try {
    const [takeRes, liveRes, voteRes] = await Promise.all([
      fetch(`${BASE_URL}/places/${placeId}/take`).catch(() => null),
      fetch(`${BASE_URL}/places/${placeId}/live-data`).catch(() => null),
      fetch(`${BASE_URL}/votes/${placeId}`).catch(() => null),
    ]);
    const take = takeRes?.ok ? (await takeRes.json()).take ?? null : null;
    const live = liveRes?.ok ? await liveRes.json() : null;
    const vote = voteRes?.ok ? await voteRes.json() : null;
    return { take, live, vote };
  } catch {
    return { take: null, live: null, vote: null };
  }
}

export async function getPlaceData(placeId: string): Promise<MapItem | null> {
  try {
    const res = await fetch(`${BASE_URL}/search/universal?q=${encodeURIComponent(placeId)}&lat=39.4699&lng=-0.3763&radius_m=50000`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results ?? []).find((r: any) => r.id === placeId) ?? null;
  } catch {
    return null;
  }
}
