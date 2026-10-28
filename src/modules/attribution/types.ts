export interface AttributionPayload {
  channel: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  refCode?: string;
  landingPath?: string;
  referrerUrl?: string;
  capturedAt: number;
}

export interface UserAttributionRecord {
  id: string;
  user_id: string;
  channel: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  ref_code: string | null;
  landing_path: string | null;
  referrer_url: string | null;
  created_at: number;
}

export interface ChannelStat {
  channel: string;
  count: number;
}
