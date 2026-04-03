export function formatPriceLevel(level: 1 | 2 | 3): string {
  return '€'.repeat(level);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatReviews(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/** Format distance in metres to a human-readable string. */
export function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres)}m`;
  }
  return `${(metres / 1000).toFixed(1)}km`;
}

/**
 * Format an ISO date string as a relative "time ago" label in Spanish.
 * Examples: "hace 5 minutos", "hace 2 horas", "hace 3 días"
 */
export function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return 'hace un momento';
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `hace ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
}

/**
 * Format an ISO date string as a short expiry label.
 * Returns "Expira en Xh Ym" while active, or "Expirado" if past.
 */
export function formatExpiry(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return 'Expirado';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `Expira en ${diffMinutes}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (mins === 0) return `Expira en ${hours}h`;
  return `Expira en ${hours}h ${mins}m`;
}
