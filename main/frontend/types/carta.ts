import { Restaurant } from "./restaurant";

export interface ReviewMetrics {
  calidad_precio: number;
  servicio: number;
  comida: number;
  ambiente: number;
  rapidez: number;
}

export interface RestaurantCategories {
  romantico: number;
  tapas: number;
  comida_rapida: number;
  premium: number;
  familiar: number;
  para_amigos: number;
  turistico: number;
  local_hidden_gem: number;
}

export type CartaCuisine =
  | "italian"
  | "japanese"
  | "spanish"
  | "mexican"
  | "indian"
  | "american"
  | "other";

export interface CartaRestaurant extends Restaurant {
  summary: string;
  cuisine: CartaCuisine;
  metrics: ReviewMetrics;
  categories: RestaurantCategories;
}

export interface CartaSection {
  id: string;
  title: string;
  restaurants: CartaRestaurant[];
}
