import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en', 'es', 'de', 'ar', 'zh'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed'
});
