import type { TFunction } from 'i18next';
import { resolveUiLanguage, type ResolvedLanguage } from './language';

const INTL_LOCALE_MAP: Record<ResolvedLanguage, string> = {
  es: 'es-ES',
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-PT',
  de: 'de-DE',
};

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

export function getIntlLocale(language?: string | null): string {
  const resolved = resolveUiLanguage(language);
  return INTL_LOCALE_MAP[resolved];
}

export function formatLocaleDate(
  value: string | number | Date,
  language?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(date);
}

export function formatLocaleTime(
  value: string | number | Date,
  language?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getIntlLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function formatLocaleDateTime(
  value: string | number | Date,
  language?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(date);
}

/**
 * Format an ISO date string as a relative "time ago" label in Spanish.
 * Examples: "hace 5 minutos", "hace 2 horas", "hace 3 días"
 */
export function formatTimeAgo(isoDate: string, t?: TFunction): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return t ? t('time.momentAgo') : 'hace un momento';
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return t
      ? t('time.minutesAgo', { count: diffMinutes })
      : `hace ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t
      ? t('time.hoursAgo', { count: diffHours })
      : `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return t
      ? t('time.daysAgo', { count: diffDays })
      : `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return t
    ? t('time.monthsAgo', { count: diffMonths })
    : `hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
}

/**
 * Format an ISO date string as a short expiry label.
 * Returns "Expira en Xh Ym" while active, or "Expirado" if past.
 */
export function formatExpiry(isoDate: string, t?: TFunction): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return t ? t('time.expired') : 'Expirado';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return t ? t('time.expiresInMinutes', { count: diffMinutes }) : `Expira en ${diffMinutes}m`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (mins === 0) return t ? t('time.expiresInHours', { count: hours }) : `Expira en ${hours}h`;
  return t
    ? t('time.expiresInHoursMinutes', { hours, minutes: mins })
    : `Expira en ${hours}h ${mins}m`;
}
