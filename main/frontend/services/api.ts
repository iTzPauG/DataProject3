import { Restaurant } from '../types/restaurant';
import { CartaSection, CartaRestaurant, RestaurantCategories, ReviewMetrics } from '../types/carta';
import { auth } from './supabase';
import { storage } from '../utils/storage';
import { Category, CommunityReport, MapItem, ReportType, SavedItem } from '../types';
import { FALLBACK_CATEGORIES } from './mapService';

// Derive the backend URL with autodetection for Railway production
const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  
  // If we have a valid environment URL and it's not localhost (or we ARE on localhost), use it
  if (envUrl && (!envUrl.includes('localhost') || (typeof window !== 'undefined' && window.location.hostname === 'localhost'))) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }

  // Autodetection for Railway: If we are on X.up.railway.app, the backend is likely on backend-production-XXXX.up.railway.app
  // Or more simply, if BASE_URL is missing in production web, we can try to use a relative path or a known pattern.
  if (typeof window !== 'undefined' && window.location.hostname.includes('railway.app')) {
    // For GADO, we know the production backend URL pattern
    return 'https://backend-production-bac63.up.railway.app';
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

// Valencia city centre — fallback when geolocation is unavailable or denied
const VALENCIA_LAT = 39.4699;
const VALENCIA_LNG = -0.3763;

export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[LOCATION] Geolocation not supported, using fallback.');
      resolve({ lat: VALENCIA_LAT, lng: VALENCIA_LNG });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('[LOCATION] Got current position:', pos.coords.latitude, pos.coords.longitude);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn('[LOCATION] Geolocation error, using fallback:', err.message);
        resolve({ lat: VALENCIA_LAT, lng: VALENCIA_LNG });
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000, 
        maximumAge: 0 // Force fresh location for reports
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
  nightlife: {
    category: { id: 'nightlife', label: 'Ocio nocturno', icon: '🌙', color: '#3B82F6', sort_order: 2, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Qué rollo buscas?', mood_subtitle: 'Elige el ambiente de la noche' },
    subcategories: [
      { id: 'bar', label: 'Bar de copas', emoji: '🍻' },
      { id: 'club', label: 'Discoteca', emoji: '🕺' },
      { id: 'cocktail', label: 'Coctelería', emoji: '🍸' },
      { id: 'lounge', label: 'Lounge / Chill', emoji: '🛋️' },
      { id: 'rooftop', label: 'Terraza / Rooftop', emoji: '🌃' },
      { id: 'wine_bar', label: 'Vinoteca', emoji: '🍷' },
      { id: 'karaoke', label: 'Karaoke', emoji: '🎤' },
      { id: 'live_music', label: 'Música en vivo', emoji: '🎸' },
      { id: 'pub', label: 'Irish Pub', emoji: '🍺' },
    ],
    moods: [
      { id: 'chill', label: 'Tranquilo', emoji: '🍷' },
      { id: 'party', label: 'Fiesta total', emoji: '💃' },
      { id: 'intimate', label: 'Íntimo / Cita', emoji: '🥂' },
      { id: 'friends', label: 'Con amigos', emoji: '🍻' },
      { id: 'live_show', label: 'Espectáculo', emoji: '💃' },
      { id: 'afterwork', label: 'After work', emoji: '👔' },
    ],
  },
  shopping: {
    category: { id: 'shopping', label: 'Compras', icon: '🛒', color: '#10B981', sort_order: 3, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Cómo quieres comprar?', mood_subtitle: 'Elige tu estilo de compras' },
    subcategories: [
      { id: 'clothes', label: 'Moda y ropa', emoji: '👗' },
      { id: 'electronics', label: 'Electrónica', emoji: '💻' },
      { id: 'supermarket', label: 'Supermercado', emoji: '🛒' },
      { id: 'mall', label: 'Centro Comercial', emoji: '🏬' },
      { id: 'vintage', label: 'Vintage / Segunda mano', emoji: '🕰️' },
      { id: 'bookstore', label: 'Librería', emoji: '📚' },
      { id: 'deco', label: 'Decoración / Hogar', emoji: '🏠' },
      { id: 'sports_gear', label: 'Deportes', emoji: '⚽' },
      { id: 'gifts', label: 'Regalos / Souvenirs', emoji: '🎁' },
    ],
    moods: [
      { id: 'quick', label: 'Compra rápida', emoji: '⏱️' },
      { id: 'window', label: 'Solo mirar', emoji: '👀' },
      { id: 'treat_myself', label: 'Darse un capricho', emoji: '🎁' },
      { id: 'sale', label: 'Ofertas / Outlet', emoji: '🏷️' },
      { id: 'luxury', label: 'Lujo / Premium', emoji: '💎' },
      { id: 'local_brands', label: 'Marcas locales', emoji: '🏪' },
    ],
  },
  health: {
    category: { id: 'health', label: 'Salud y farmacia', icon: '💊', color: '#EF4444', sort_order: 4, is_active: true, requires_price: false, search_mode: 'guided_ranked', mood_title: '¿Cuál es la urgencia?', mood_subtitle: 'Elige tu situación actual' },
    subcategories: [
      { id: 'pharmacy', label: 'Farmacia', emoji: '💊' },
      { id: 'hospital', label: 'Hospital / Urgencias', emoji: '🏥' },
      { id: 'clinic', label: 'Clínica / Médico', emoji: '⚕️' },
      { id: 'dentist', label: 'Dentista', emoji: '🦷' },
      { id: 'optician', label: 'Óptica', emoji: '👓' },
      { id: 'physiotherapy', label: 'Fisioterapia', emoji: '💆' },
      { id: 'mental_health', label: 'Salud mental', emoji: '🧠' },
      { id: 'vet', label: 'Veterinario', emoji: '🩺' },
    ],
    moods: [
      { id: 'urgent', label: 'Urgencia', emoji: '🚨' },
      { id: 'checkup', label: 'Cita rutinaria', emoji: '📅' },
      { id: 'specialist', label: 'Especialista', emoji: '👨‍⚕️' },
      { id: 'night_service', label: 'Guardia 24h', emoji: '🌙' },
    ],
  },
  nature: {
    category: { id: 'nature', label: 'Naturaleza', icon: '🌿', color: '#22C55E', sort_order: 5, is_active: true, requires_price: false, search_mode: 'guided_ranked', mood_title: '¿Qué plan tienes?', mood_subtitle: 'Elige qué quieres hacer' },
    subcategories: [
      { id: 'park', label: 'Parque urbano', emoji: '🌲' },
      { id: 'beach', label: 'Playa', emoji: '🏖️' },
      { id: 'hiking', label: 'Senderismo / Ruta', emoji: '🥾' },
      { id: 'garden', label: 'Jardín botánico', emoji: '🌺' },
      { id: 'viewpoint', label: 'Mirador', emoji: '🏔️' },
      { id: 'lake', label: 'Lago / Río', emoji: '🏞️' },
      { id: 'picnic', label: 'Zona de picnic', emoji: '🧺' },
    ],
    moods: [
      { id: 'relax', label: 'Paz y relax', emoji: '🧘' },
      { id: 'active', label: 'Aventura / Deporte', emoji: '🏃' },
      { id: 'family', label: 'Plan con niños', emoji: '👶' },
      { id: 'photo_spot', label: 'Buenas vistas', emoji: '📸' },
      { id: 'dog_friendly', label: 'Con mi perro', emoji: '🐕' },
      { id: 'sunset', label: 'Ver el atardecer', emoji: '🌅' },
    ],
  },
  culture: {
    category: { id: 'culture', label: 'Cultura y ocio', icon: '🎭', color: '#F59E0B', sort_order: 6, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Cuál es tu objetivo?', mood_subtitle: 'Elige qué buscas de esta visita' },
    subcategories: [
      { id: 'museum', label: 'Museo', emoji: '🏛️' },
      { id: 'gallery', label: 'Galería de arte', emoji: '🖼️' },
      { id: 'theater', label: 'Teatro / Musicales', emoji: '🎭' },
      { id: 'library', label: 'Biblioteca', emoji: '📚' },
      { id: 'historic_site', label: 'Sitio histórico', emoji: '🏰' },
      { id: 'cultural_center', label: 'Centro cultural', emoji: '🎪' },
    ],
    moods: [
      { id: 'learn', label: 'Para aprender', emoji: '🧠' },
      { id: 'interactive', label: 'Plan interactivo', emoji: '🎨' },
      { id: 'classic', label: 'Visita clásica', emoji: '🏛️' },
      { id: 'entertainment', label: 'Solo diversión', emoji: '🍿' },
      { id: 'free', label: 'Gratis', emoji: '🆓' },
      { id: 'guided_tour', label: 'Con guía', emoji: '🎙️' },
    ],
  },
  sport: {
    category: { id: 'sport', label: 'Deporte', icon: '⚽', color: '#0EA5E9', sort_order: 9, is_active: true, requires_price: false, search_mode: 'guided_ranked', mood_title: '¿Cómo quieres entrenar?', mood_subtitle: 'Elige la intensidad o compañía' },
    subcategories: [
      { id: 'gym', label: 'Gimnasio', emoji: '🏋️' },
      { id: 'padel', label: 'Pádel / Tenis', emoji: '🏓' },
      { id: 'football', label: 'Fútbol / Basket', emoji: '⚽' },
      { id: 'pool', label: 'Piscina', emoji: '🏊' },
      { id: 'yoga', label: 'Yoga / Pilates', emoji: '🧘' },
      { id: 'climbing', label: 'Rocodromo', emoji: '🧗' },
      { id: 'running', label: 'Rutas running', emoji: '🏃' },
    ],
    moods: [
      { id: 'classes', label: 'Clases dirigidas', emoji: '🏋️' },
      { id: 'casual', label: 'Pasar el rato', emoji: '😆' },
      { id: 'competition', label: 'Competición', emoji: '🏆' },
      { id: 'outdoor', label: 'Al aire libre', emoji: '🌳' },
      { id: 'beginner', label: 'Principiante', emoji: '🌱' },
    ],
  },
  education: {
    category: { id: 'education', label: 'Educación', icon: '📚', color: '#8B5CF6', sort_order: 10, is_active: true, requires_price: false, search_mode: 'guided_ranked', mood_title: '¿Qué necesitas?', mood_subtitle: 'Elige tu prioridad' },
    subcategories: [
      { id: 'library', label: 'Biblioteca', emoji: '📚' },
      { id: 'study_cafe', label: 'Café para estudiar', emoji: '☕' },
      { id: 'university', label: 'Universidad', emoji: '🎓' },
      { id: 'language_school', label: 'Idiomas', emoji: '🗣️' },
      { id: 'academy', label: 'Academia', emoji: '📖' },
    ],
    moods: [
      { id: 'quiet', label: 'Silencio total', emoji: '🤫' },
      { id: 'group', label: 'Trabajo en grupo', emoji: '👥' },
      { id: 'wifi', label: 'WiFi rápido', emoji: '📶' },
      { id: 'long_hours', label: 'Muchas horas', emoji: '🕑' },
    ],
  },
  cinema: {
    category: { id: 'cinema', label: 'Cine', icon: '🎬', color: '#EF4444', sort_order: 11, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Cuál es la ocasión?', mood_subtitle: 'Elige con quién vas' },
    subcategories: [
      { id: 'blockbuster', label: 'Estrenos / Multiplex', emoji: '🍿' },
      { id: 'indie', label: 'Cine de autor / Indie', emoji: '📽️' },
      { id: 'imax', label: 'Experiencia IMAX / 3D', emoji: '🎬' },
      { id: 'vos', label: 'Versión original (VOSE)', emoji: '🇬🇧' },
      { id: 'summer_cinema', label: 'Cine de verano', emoji: '🌙' },
    ],
    moods: [
      { id: 'action', label: 'Acción / Sci-Fi', emoji: '💥' },
      { id: 'comedy', label: 'Comedia / Familiar', emoji: '😂' },
      { id: 'drama', label: 'Drama / Thriller', emoji: '🎭' },
      { id: 'kids', label: 'Plan infantil', emoji: '👦' },
      { id: 'date_night', label: 'Cita romántica', emoji: '❤️' },
      { id: 'horror', label: 'Miedo / Terror', emoji: '👻' },
    ],
  },
  wellness: {
    category: { id: 'wellness', label: 'Bienestar', icon: '💆', color: '#F472B6', sort_order: 12, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Qué tipo de bienestar?', mood_subtitle: 'Elige tu experiencia de relax' },
    subcategories: [
      { id: 'spa', label: 'Spa / Circuito', emoji: '🧖' },
      { id: 'massage', label: 'Masajes', emoji: '💆' },
      { id: 'meditation', label: 'Retiro / Meditación', emoji: '🧘' },
      { id: 'hot_springs', label: 'Termas naturales', emoji: '♨️' },
      { id: 'beauty', label: 'Estética / Belleza', emoji: '💅' },
    ],
    moods: [
      { id: 'disconnect', label: 'Desconexión total', emoji: '🧘' },
      { id: 'couples', label: 'Relax en pareja', emoji: '💑' },
      { id: 'detox', label: 'Cuerpo sano', emoji: '🍃' },
      { id: 'luxury', label: 'Lujo asiático', emoji: '💎' },
    ],
  },
  coworking: {
    category: { id: 'coworking', label: 'Coworking', icon: '💻', color: '#3B82F6', sort_order: 13, is_active: true, requires_price: true, search_mode: 'guided_ranked', mood_title: '¿Qué tipo de espacio?', mood_subtitle: 'Elige donde trabajar', skip_price_subcategories: ['library', 'cafe_workspace'] },
    subcategories: [
      { id: 'open_space', label: 'Hot desk / Open space', emoji: '🏢' },
      { id: 'private_office', label: 'Oficina privada', emoji: '🚪' },
      { id: 'meeting_room', label: 'Sala de reuniones', emoji: '📊' },
      { id: 'cafe_workspace', label: 'Cafetería con WiFi', emoji: '☕' },
      { id: 'library', label: 'Biblioteca pública', emoji: '📚' },
    ],
    moods: [
      { id: 'focus', label: 'Concentración', emoji: '🤫' },
      { id: 'networking', label: 'Hacer contactos', emoji: '🤝' },
      { id: 'cheap', label: 'Económico', emoji: '💰' },
      { id: 'premium', label: 'Ambiente premium', emoji: '⭐' },
      { id: 'twentyfour_h', label: 'Horario 24h', emoji: '🕑' },
    ],
  },
  pets: {
    category: { id: 'pets', label: 'Mascotas', icon: '🐾', color: '#10B981', sort_order: 14, is_active: true, requires_price: false, search_mode: 'guided_ranked', mood_title: '¿Qué necesita tu mascota?', mood_subtitle: 'Elige el servicio' },
    subcategories: [
      { id: 'vet', label: 'Veterinario / Urgencias', emoji: '🩺' },
      { id: 'pet_shop', label: 'Tienda de mascotas', emoji: '🐾' },
      { id: 'dog_park', label: 'Parque de perros', emoji: '🐕' },
      { id: 'grooming', label: 'Peluquería canina', emoji: '✂️' },
      { id: 'pet_hotel', label: 'Residencia / Hotel', emoji: '🏨' },
    ],
    moods: [
      { id: 'urgent', label: 'Es una urgencia', emoji: '🚨' },
      { id: 'routine_care', label: 'Cuidado regular', emoji: '📅' },
      { id: 'training', label: 'Educación / Adiestramiento', emoji: '🐕‍🦺' },
      { id: 'fun', label: 'Juego y socializar', emoji: '🎾' },
    ],
  },
  automotive: {
    category: { id: 'automotive', label: 'Vehículo', icon: '🚗', color: '#6366F1', sort_order: 15, is_active: true, requires_price: false, search_mode: 'guided_ranked', mood_title: '¿Qué necesita tu vehículo?', mood_subtitle: 'Elige el servicio' },
    subcategories: [
      { id: 'gas_station', label: 'Gasolinera', emoji: '⛽' },
      { id: 'ev_charging', label: 'Carga eléctrica', emoji: '🔌' },
      { id: 'mechanic', label: 'Taller mecánico', emoji: '🔧' },
      { id: 'car_wash', label: 'Lavado / Detailing', emoji: '🚿' },
      { id: 'parking', label: 'Parking', emoji: '🅿️' },
      { id: 'tires', label: 'Neumáticos / Ruedas', emoji: '🛞' },
      { id: 'itv', label: 'Centro ITV', emoji: '📋' },
      { id: 'car_rental', label: 'Alquiler coches', emoji: '🚗' },
    ],
    moods: [
      { id: 'breakdown', label: 'Avería / Emergencia', emoji: '🚨' },
      { id: 'maintenance', label: 'Mantenimiento', emoji: '📅' },
      { id: 'quick_stop', label: 'Parada rápida', emoji: '💰' },
      { id: 'roadtrip', label: 'Antes de viajar', emoji: '📍' },
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
        }))
      : [],
    liveData:           typeof raw.liveData === 'object' && raw.liveData !== null ? raw.liveData as Record<string, any> : undefined,
  };
}

const DEFAULT_METRICS: ReviewMetrics = {
  calidad_precio: 50,
  servicio: 50,
  comida: 50,
  ambiente: 50,
  rapidez: 50,
};

const DEFAULT_CATEGORIES: RestaurantCategories = {
  romantico: 0.3,
  tapas: 0.3,
  comida_rapida: 0.3,
  premium: 0.3,
  familiar: 0.3,
  para_amigos: 0.3,
  turistico: 0.3,
  local_hidden_gem: 0.2,
};

function sanitizeMetrics(raw: unknown): ReviewMetrics {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    calidad_precio: clamp(Number(obj.calidad_precio ?? DEFAULT_METRICS.calidad_precio)),
    servicio: clamp(Number(obj.servicio ?? DEFAULT_METRICS.servicio)),
    comida: clamp(Number(obj.comida ?? DEFAULT_METRICS.comida)),
    ambiente: clamp(Number(obj.ambiente ?? DEFAULT_METRICS.ambiente)),
    rapidez: clamp(Number(obj.rapidez ?? DEFAULT_METRICS.rapidez)),
  };
}

function sanitizeCategories(raw: unknown): RestaurantCategories {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    romantico: clamp(Number(obj.romantico ?? DEFAULT_CATEGORIES.romantico)),
    tapas: clamp(Number(obj.tapas ?? DEFAULT_CATEGORIES.tapas)),
    comida_rapida: clamp(Number(obj.comida_rapida ?? DEFAULT_CATEGORIES.comida_rapida)),
    premium: clamp(Number(obj.premium ?? DEFAULT_CATEGORIES.premium)),
    familiar: clamp(Number(obj.familiar ?? DEFAULT_CATEGORIES.familiar)),
    para_amigos: clamp(Number(obj.para_amigos ?? DEFAULT_CATEGORIES.para_amigos)),
    turistico: clamp(Number(obj.turistico ?? DEFAULT_CATEGORIES.turistico)),
    local_hidden_gem: clamp(Number(obj.local_hidden_gem ?? DEFAULT_CATEGORIES.local_hidden_gem)),
  };
}

const ALLOWED_CUISINES = new Set([
  'italian',
  'japanese',
  'spanish',
  'mexican',
  'indian',
  'american',
  'other',
]);

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
  const res = await fetch(`${BASE_URL}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      return data.votes ?? {};
  } catch {
      return {};
  }
}

export async function getVotes(
  itemId: string,
): Promise<VoteData | null> {
  try {
      const res = await fetch(`${BASE_URL}/votes/${itemId}`);
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
      headers: { Accept: 'application/json' },
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

export async function getCartaRecommendations(params: {
  lat: number;
  lng: number;
  priceLevel?: 1 | 2 | 3 | null;
  language?: string;
}): Promise<CartaSection[]> {
  const cartaUrl = buildUrl('/api/carta', {
    lat: String(params.lat),
    lng: String(params.lng),
    price_level: params.priceLevel ? String(params.priceLevel) : undefined,
    language: params.language ?? 'es',
  });

  try {
    const res = await fetch(cartaUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];

    const data = await res.json() as { sections?: Array<Record<string, unknown>> };
    if (!Array.isArray(data.sections)) return [];

    return data.sections
      .map((section, index) => {
        const rawRestaurants = Array.isArray(section.restaurants)
          ? (section.restaurants as Array<Record<string, unknown>>)
          : [];

        const dedup = new Map<string, CartaRestaurant>();
        for (const raw of rawRestaurants) {
          const base = sanitize(raw);
          if (!base.id) continue;

          const summary = String(raw.summary ?? raw.tagline ?? raw.why ?? '').trim();
          const cuisineRaw = String(raw.cuisine ?? 'other').toLowerCase();
          const cuisine = ALLOWED_CUISINES.has(cuisineRaw)
            ? (cuisineRaw as CartaRestaurant['cuisine'])
            : 'other';

          dedup.set(base.id, {
            ...base,
            tagline: summary || base.tagline,
            why: summary || base.why,
            summary: summary || base.tagline || base.why,
            cuisine,
            metrics: sanitizeMetrics(raw.metrics),
            categories: sanitizeCategories(raw.categories),
          });
        }

        return {
          id: String(section.id ?? `carta_${index}`),
          title: String(section.title ?? 'Sección'),
          restaurants: Array.from(dedup.values()).slice(0, 10),
        };
      })
      .filter((section) => section.restaurants.length > 0);
  } catch {
    return [];
  }
}

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
  const { lat, lng } = await getCurrentLocation();

  const recommendUrl = buildUrl('/recommend', { fast: fast ? 'true' : undefined });

  const res = await fetch(recommendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const data = await res.json();
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

const POLL_INTERVAL_MS = 500;
const STAGGER_DELAY_MS = 350; // delay between rendering each result within a batch

export async function recommendRestaurantsStream(
  input: RecommendStreamInput,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { parentCategory, subcategory, mood, priceLevel, language = 'es' } = input;
  const { lat, lng } = await getCurrentLocation();

  // Step 1: Start the job
  const startRes = await fetch(`${BASE_URL}/recommend/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const { job_id } = await startRes.json();

  // Step 2: Poll for results every POLL_INTERVAL_MS
  let cursor = 0;
  let metaFired = false;

  return new Promise<void>((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await fetch(`${BASE_URL}/recommend/poll/${job_id}?after=${cursor}`);
        if (!res.ok) {
          throw new Error(`Poll error ${res.status}`);
        }
        const data = await res.json();

        // Fire meta once we know the total
        if (!metaFired && data.total != null) {
          metaFired = true;
          callbacks.onMeta?.({ total: data.total });
        }

        cursor = data.cursor;

        if (data.results.length > 0) {
          // Stagger delivery of results to break React batching.
          // Each result gets its own setTimeout so React renders each individually.
          const results = data.results;
          const isDone = data.done;

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
            const nextPollDelay = Math.max(POLL_INTERVAL_MS, results.length * STAGGER_DELAY_MS + 100);
            setTimeout(poll, nextPollDelay);
          }
        } else if (data.done) {
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
    setTimeout(poll, 400);
  });
}

export async function getCategoryFlow(categoryId: string): Promise<CategoryFlowResponse> {
  const fallback = FLOW_FALLBACKS[categoryId] ?? FLOW_FALLBACKS.food;

  try {
    const res = await fetch(`${BASE_URL}/categories/flow/${categoryId}`, {
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
    const res = await fetch(`${BASE_URL}/reports/types`);
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
      headers: { 'Authorization': `Bearer ${session.access_token}` },
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

    const res = await fetch(liveDataUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { type: 'none' };
    return await res.json();
  } catch {
    return { type: 'none' };
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
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch {
        return [];
    }
}
