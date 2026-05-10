import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';
import de from '../locales/de.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  de: { translation: de },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'es', // default language
  fallbackLng: 'en',
  supportedLngs: ['es', 'en', 'fr', 'pt', 'de'],
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
  compatibilityJSON: 'v4', // Required for React Native
});

export default i18n;
