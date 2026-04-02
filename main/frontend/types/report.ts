import { ReportType } from './index';

export interface CommunityReport {
  id: string;
  report_type: ReportType;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  address_hint?: string;
  photo_urls: string[];
  created_at: string;
  expires_at: string;
  confirmations: number;
  denials: number;
  confidence: number;
  is_active: boolean;
}
