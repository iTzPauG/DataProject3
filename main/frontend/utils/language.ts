export type LanguagePreference = 'system' | 'es' | 'en' | 'fr' | 'pt' | 'de';
export type ResolvedLanguage = 'es' | 'en' | 'fr' | 'pt' | 'de';

const SUPPORTED_I18N_LANGS = new Set<ResolvedLanguage>(['es', 'en', 'fr', 'pt', 'de']);

function normalizeBaseLanguage(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase().replace('_', '-').split('-')[0] || 'es';
}

export function getSystemLanguage(): ResolvedLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const normalized = normalizeBaseLanguage(locale);
  if (SUPPORTED_I18N_LANGS.has(normalized as ResolvedLanguage)) {
    return normalized as ResolvedLanguage;
  }
  return 'es';
}

export function resolveI18nLanguage(pref: string | null | undefined): ResolvedLanguage {
  if (!pref || pref === 'system') return getSystemLanguage();

  const normalized = normalizeBaseLanguage(pref);
  if (SUPPORTED_I18N_LANGS.has(normalized as ResolvedLanguage)) {
    return normalized as ResolvedLanguage;
  }
  return 'es';
}

export function resolveUiLanguage(pref: string | null | undefined): ResolvedLanguage {
  return resolveI18nLanguage(pref);
}
