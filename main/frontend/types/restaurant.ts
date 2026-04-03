export type PlaceReview = {
  author: string;
  rating: number;
  text: string;
  relative_time: string;
};

export type Restaurant = {
  id: string;
  name: string;
  priceLevel: 1 | 2 | 3;
  rating: number; // 0..5
  reviewsCount: number;
  address: string;
  phone: string; // E.164 or local format
  photoUrl: string;
  tagline: string;
  why: string;
  tags: string[]; // e.g. ["🍕 pizza", "🕯️ date", "😎 casual"]
  lat: number;
  lng: number;
  /** Distance from user in metres */
  distanceM: number;
  /** Best review quote extracted by quality agent */
  bestReviewQuote: string;
  /** Review quality score 0.0–1.0 */
  reviewQualityScore: number;
  pros: string[];
  cons: string[];
  verdict: string;
  reviews: PlaceReview[];
  /** Real-time data from APIs like weather, fuel prices, TMDB, pharmacy duties, etc. */
  liveData?: Record<string, any>;
};
