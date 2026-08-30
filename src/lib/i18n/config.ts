export const locales = ['fr', 'en', 'es', 'de', 'ar', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export const ocrLangMap: Record<Locale, string[]> = {
  fr: ['fra', 'eng'],
  en: ['eng'],
  es: ['spa', 'eng'],
  de: ['deu', 'eng'],
  ar: ['ara', 'eng'],
  zh: ['chi_sim', 'eng']
};

export const rtlLocales: Locale[] = ['ar'];
