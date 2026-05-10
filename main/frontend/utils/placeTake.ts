/**
 * Single source of truth for the "Whim's Take" synthesis pipeline.
 *
 * USAGE: any screen that displays a restaurant should call `synthesizeFallbackTake`
 * when the backend `/take` endpoint returns null or fails. This guarantees the
 * user always sees an honest summary of what's known about the place — never
 * "Análisis no disponible".
 *
 * HONESTY RULES (mirror the backend prompt in pipeline.py):
 *  - High rating + many short/lukewarm reviews → flag mixed signal explicitly.
 *  - Pros require a specific noun (food, service, ambience) AND strong wording —
 *    generic "muy bueno"/"buen ambiente" is dropped.
 *  - Cons get pulled from reviews ≤3 stars OR any review hitting a negative
 *    pattern when the overall rating contradicts review quality.
 *  - Verdict tiers reflect reality, not marketing fluff.
 */

interface ReviewLike {
  text?: string | null;
  rating?: number | null;
}

interface SynthInput {
  rating?: number | null;
  reviews?: ReviewLike[];
}

export interface SynthesizedTake {
  verdict: string;
  pros: string[];
  cons: string[];
}

const SPECIFIC_POSITIVE =
  /(servicio|atenci[oó]n|trato|sushi|pizza|pasta|carne|postre|vino|cerveza|terraza|ambiente|carta|menú|men[ñn]u|precio|relación calidad|relaci[oó]n calidad|napolitana|fresc[oa])/i;
const STRONG_POSITIVE =
  /(brutal|excelente|delici[oa]|increíble|incre[ií]ble|espectacular|recomend|el mejor|los mejores|fant[aá]stic|wonderful|outstanding)/i;
const NEGATIVE_PATTERNS =
  /(tarde|tard[oó]|fría|frío|fri[oa]|caro|car[ií]simo|sucio|lent[oa]|esperar|cola|peor|horrible|nada del otro mundo|del montón|mediocre|regular|nothing special|slow|cold|overpriced|rude|not worth)/i;

/**
 * Returns a synthesized take. Always non-null so the UI never has to
 * conditionally render the take card (which caused the "appears and
 * disappears at the instant" flicker on screens opened from outside the
 * explore flow). When there's literally no signal we still emit a short,
 * honest "no data yet" verdict instead of yanking the card off the page.
 */
export function synthesizeFallbackTake(input: SynthInput): SynthesizedTake {
  const rating = typeof input.rating === 'number' && Number.isFinite(input.rating) ? input.rating : null;
  const reviews: ReviewLike[] = Array.isArray(input.reviews) ? input.reviews : [];
  if (rating == null && reviews.length === 0) {
    return {
      verdict:
        'Aún no tenemos reseñas ni puntuación para este sitio — guarda el lugar y vuelve cuando haya más datos.',
      pros: [],
      cons: [],
    };
  }

  const reviewCount = reviews.length;
  const lowRated = reviews.filter((r) => (r.rating ?? 5) <= 3).length;
  const hasMixedSignal =
    rating != null && rating >= 4.2 && lowRated >= Math.max(1, Math.floor(reviewCount * 0.25));

  const verdict = buildVerdict(rating, reviewCount, lowRated, hasMixedSignal);

  const pros: string[] = [];
  const cons: string[] = [];
  const seen = new Set<string>();

  for (const r of reviews.slice(0, 8)) {
    const text = (r.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 22 && s.length < 200);
    for (const raw of sentences) {
      const s = raw.trim();
      const key = s.slice(0, 40).toLowerCase();
      if (seen.has(key)) continue;

      if (
        pros.length < 2 &&
        (r.rating ?? 5) >= 4 &&
        STRONG_POSITIVE.test(s) &&
        SPECIFIC_POSITIVE.test(s)
      ) {
        pros.push(s);
        seen.add(key);
        continue;
      }
      if (
        cons.length < 2 &&
        NEGATIVE_PATTERNS.test(s) &&
        ((r.rating ?? 5) <= 3 || hasMixedSignal)
      ) {
        cons.push(s);
        seen.add(key);
      }
    }
  }

  return { verdict, pros, cons };
}

function buildVerdict(
  rating: number | null,
  reviewCount: number,
  lowRated: number,
  hasMixedSignal: boolean,
): string {
  if (rating == null) {
    return 'Sin nota disponible — el análisis se basa solo en reseñas individuales.';
  }
  if (hasMixedSignal) {
    return `★ ${rating.toFixed(1)} de media, pero ${lowRated} de ${reviewCount} reseñas son críticas — la nota engaña, lee abajo antes de fiarte.`;
  }
  if (rating >= 4.6) {
    return `★ ${rating.toFixed(1)} con ${reviewCount} reseñas — el consenso es claro, pero sigue habiendo matices que conviene leer.`;
  }
  if (rating >= 4.2) {
    return `★ ${rating.toFixed(1)} (${reviewCount} reseñas) — bien valorado en general, sin grandes alarmas.`;
  }
  if (rating >= 3.5) {
    return `★ ${rating.toFixed(1)} (${reviewCount} reseñas) — opiniones partidas: lee tanto las buenas como las malas antes de ir.`;
  }
  return `★ ${rating.toFixed(1)} (${reviewCount} reseñas) — críticas frecuentes y patrones negativos repetidos. Pasa de largo salvo que no tengas alternativa.`;
}

/**
 * Picks the "effective" take to display — the backend-generated one when
 * available, otherwise the local synthesis. Returns null only if both are absent.
 *
 * SHAPE: backend take has many fields (verdict, pros, cons, reviews, photoUrl, …).
 * The synthesized fallback is a subset (verdict + pros + cons). This helper
 * keeps the shape compatible so the UI doesn't have to branch.
 */
export function pickEffectiveTake<T extends { verdict?: string; pros?: string[]; cons?: string[] }>(
  backendTake: T | null | undefined,
  fallback: SynthesizedTake | null,
): (T & SynthesizedTake) | SynthesizedTake | null {
  if (backendTake && (backendTake.verdict || (backendTake.pros && backendTake.pros.length))) {
    return backendTake as T & SynthesizedTake;
  }
  return fallback;
}
