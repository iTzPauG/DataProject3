import { VoteData } from '../../services/api';
import { MapItem } from '../../types/map';
import { Restaurant } from '../../types/restaurant';

export interface MapProps {
  items?: MapItem[];
  selectedId: string | null;
  onSelectItem?: (id: string) => void;
  onRegionChange?: (lat: number, lng: number, latDelta: number, lngDelta: number) => void;
  region?: { lat: number; lng: number; latDelta: number; lngDelta: number };
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'minimal';
  minimalist?: boolean;
  gadoOverlay?: boolean;
  showZoomControls?: boolean;
  restaurants?: Restaurant[];
  onSelectRestaurant?: (id: string) => void;
  votesMap?: Record<string, VoteData>;
}
