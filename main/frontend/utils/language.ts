export type LanguagePreference = 'system' | 'es' | 'en' | 'fr' | 'pt' | 'de';

const SUPPORTED_I18N_LANGS = new Set(['es', 'en', 'pt', 'de']);

export function getSystemLanguage(): 'es' | 'en' {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() ?? 'es';
  return locale.startsWith('en') ? 'en' : 'es';
}

export function resolveI18nLanguage(pref: string | null | undefined): string {
  if (!pref || pref === 'system') return getSystemLanguage();

  const normalized = pref.toLowerCase().split('-')[0];
  if (SUPPORTED_I18N_LANGS.has(normalized)) return normalized;
  if (normalized === 'fr') return 'en';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('de')) return 'de';
  return 'es';
}

export function resolveUiLanguage(pref: string | null | undefined): 'es' | 'en' {
  const lang = resolveI18nLanguage(pref);
  return lang === 'en' ? 'en' : 'es';
}
