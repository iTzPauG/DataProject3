export type Profile = {
  id: string;
  display_name?: string;
  avatar_url?: string;
  anon_fingerprint?: string;
  reputation_score: number;
  reports_count: number;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

export type ItemType = 'place' | 'event' | 'report';

export type MapItem = {
  item_type: ItemType;
  item_id: string;
  category_id: string;
  title: string;
  lat: number;
  lng: number;
  distance_m: number;
  icon?: string;
  color?: string;
  metadata: Record<string, unknown>;
};

export type Place = {
  id: string;
  external_id?: string;
  osm_id?: string;
  osm_type?: string;
  source: string;
  category_id: string;
  subcategory?: string;
  amenity?: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  photo_url?: string;
  rating?: number;
  price_level?: number;
  lat: number;
  lng: number;
  tags: Record<string, unknown>;
  opening_hours?: string;
  metadata: Record<string, unknown>;
  is_verified: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  category_id: string;
  subcategory?: string;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  photo_url?: string;
  source_url?: string;
  starts_at: string;
  ends_at?: string;
  is_recurring: boolean;
  recurrence?: string;
  price_info?: string;
  metadata: Record<string, unknown>;
  status: 'draft' | 'active' | 'cancelled' | 'completed';
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type ReportType = {
  id: string;
  label: string;
  icon: string;
  color: string;
  duration_h: number;
  sort_order: number;
  is_active: boolean;
};

export type CommunityReport = {
  id: string;
  report_type: string;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  address_hint?: string;
  photo_urls: string[];
  created_by?: string;
  anon_fingerprint?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  confirmations: number;
  denials: number;
  confidence: number;
  is_flagged: boolean;
  flag_reason?: string;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'auto_expired';
  viewer_vote?: -1 | 0 | 1;
};

export type SavedItem = {
  id: string;
  user_id: string;
  item_type: 'place' | 'event' | 'report';
  item_id: string;
  created_at: string;
};

export type UserPreference = {
  user_id: string;
  default_radius_m: number;
  favorite_cats: string[];
  map_style: string;
  notifications_on: boolean;
  language: string;
  updated_at: string;
};
