import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

// `vi` (default + fallback) is bundled so it is always available synchronously;
// other locales are fetched on demand as separate chunks.
import vi from './locales/vi/translation.json';

export const LANGUAGES = ['vi', 'en'] as const;

i18n.on('languageChanged', lng => {
  document.documentElement.lang = lng;
});

/** Resolves once the detected language is loaded; render after it to avoid showing fallback text. */
export const i18nReady = i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (lng: string, ns: string) => import(`./locales/${lng}/${ns}.json`)
    )
  )
  .use(initReactI18next)
  .init({
    resources: { vi: { translation: vi } },
    partialBundledLanguages: true,
    supportedLngs: LANGUAGES,
    load: 'languageOnly',
    fallbackLng: 'vi',
    interpolation: { escapeValue: false }
  });

export default i18n;

export const trans = i18n.t;
