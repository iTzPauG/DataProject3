/**
 * Re-export shared map types from the central types/index.ts.
 * MapItem and Category are defined there to avoid duplication.
 */
export type { Category, ItemType, MapItem } from './index';

// Legacy string-union kept for reference only — actual report types come from the API.
export type ReportTypeId =
  | 'food_stand'
  | 'street_festival'
  | 'popup_market'
  | 'live_music'
  | 'food_truck'
  | 'street_performer'
  | 'queue_alert'
  | 'closure'
  | 'free_food'
  | 'other';
