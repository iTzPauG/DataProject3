import { Category, MapItem } from '../types';

// Derive the backend URL with autodetection for Railway production
const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && (!envUrl.includes('localhost') || (typeof window !== 'undefined' && window.location.hostname === 'localhost'))) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('railway.app')) {
    return 'https://backend-production-bac63.up.railway.app';
  }
  return 'http://localhost:8080';
};

const BASE_URL = getBaseUrl();

// Shared fallback — single source of truth for category definitions
export const FALLBACK_CATEGORIES: Category[] = [
  { id: 'food', label: 'category.food', icon: '🍴', color: '#FF6B35', sort_order: 1, is_active: true },
  { id: 'nightlife', label: 'category.nightlife', icon: '🌙', color: '#3B82F6', sort_order: 2, is_active: true },
  { id: 'shopping', label: 'category.shopping', icon: '🛒', color: '#10B981', sort_order: 3, is_active: true },
  { id: 'health', label: 'category.health', icon: '💊', color: '#EF4444', sort_order: 4, is_active: true },
  { id: 'nature', label: 'category.nature', icon: '🌿', color: '#22C55E', sort_order: 5, is_active: true },
  { id: 'culture', label: 'category.culture', icon: '🎭', color: '#F59E0B', sort_order: 6, is_active: true },
  { id: 'sport', label: 'category.sport', icon: '⚽', color: '#0EA5E9', sort_order: 7, is_active: true },
  { id: 'cinema', label: 'category.cinema', icon: '🎬', color: '#EF4444', sort_order: 8, is_active: true },
  { id: 'wellness', label: 'category.wellness', icon: '🧘', color: '#8B5CF6', sort_order: 9, is_active: true },
  { id: 'services', label: 'category.services', icon: '🛠️', color: '#94A3B8', sort_order: 10, is_active: true },
  { id: 'education', label: 'category.education', icon: '📚', color: '#8B5CF6', sort_order: 11, is_active: true },
  { id: 'pets', label: 'category.pets', icon: '🐾', color: '#6366F1', sort_order: 12, is_active: true },
  { id: 'automotive', label: 'category.automotive', icon: '🚗', color: '#475569', sort_order: 13, is_active: true },
];

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${BASE_URL}/categories`, {
        headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return FALLBACK_CATEGORIES;
    const data = await res.json();
    if (!data || !Array.isArray(data.categories)) return FALLBACK_CATEGORIES;
    return data.categories;
  } catch (error) {
    console.warn('[mapService] Error fetching categories, using fallback:', error);
    return FALLBACK_CATEGORIES;
  }
}

export async function fetchNearbyItems(
  lat: number,
  lng: number,
  radius: number = 2000,
  category?: string | null,
  language: string = 'es',
  itemTypes?: string[],
): Promise<MapItem[]> {
  try {
    const params: any = { lat, lng, radius };
    if (category) params.categories = category;
    params.language = language;
    
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) qs.append(k, String(v));
    });
    if (itemTypes) {
      itemTypes.forEach(t => qs.append('item_types', t));
    }

    const res = await fetch(`${BASE_URL}/places/nearby?${qs.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Failed to fetch nearby items: ${res.status}`);
    const data = await res.json() as { items?: MapItem[] };
    const items = data.items ?? [];
    // Prefix relative photo URLs with backend base URL
    items.forEach(item => {
      const p = item.metadata?.photo_url as string | undefined;
      if (p && p.startsWith('/')) {
        (item.metadata as any).photo_url = `${BASE_URL}${p}`;
      }
    });
    return items;
  } catch (error) {
    console.warn('[mapService] Error fetching nearby items:', error);
    return [];
  }
}
