import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translations for English and Spanish
const resources = {
  en: {
    translation: {
      settings: {
        title: 'Settings',
        subtitle: 'Customize your experience',
        sync: {
          local: 'Local preference only',
          saving: 'Syncing...',
          saved: 'Settings saved',
          error: 'Sync error',
          cloud: 'Connected to cloud',
        },
        appearance: {
          title: 'Appearance',
          subtitle: 'Choose the visual tone of the application.',
          system: 'System',
          dark: 'Dark',
          light: 'Light',
          systemDesc: 'Match device',
          darkDesc: 'Night mode',
          lightDesc: 'Day mode',
        },
        language: {
          title: 'Language',
          subtitle: 'Customize the app and reviews language.',
          system: 'System',
          es: 'Español',
          en: 'English',
          fr: 'Français',
        },
        mapLayer: {
          title: 'Map Layer',
          subtitle: 'How the city is rendered under your data.',
          minimal: { label: 'Minimal', desc: 'Clean and calm' },
          standard: { label: 'Standard', desc: 'Default city map' },
          hybrid: { label: 'Hybrid', desc: 'Satellite with labels' },
          satellite: { label: 'Satellite', desc: 'Imagery first' },
          terrain: { label: 'Terrain', desc: 'Topography and parks' },
        },
        gadoOverlay: {
          title: 'WHIM Overlay',
          subtitle: 'Highlight reports and events with strong visual cues.',
          liveActivity: 'Live activity emphasis',
          liveActivityDesc: 'Inspired by traffic apps, but for the WHIM community.',
        },
        defaultRadius: {
          title: 'Default Radius',
          subtitle: 'Map Filters.',
          realTime: 'Real-time events',
          realTimeDesc: 'Show community events and reports on the main map.',
          autoSearch: 'Maximum auto-search distance.',
        },
        done: 'Done',
      },
    },
  },
  es: {
    translation: {
      settings: {
        title: 'Ajustes',
        subtitle: 'Personaliza tu experiencia',
        sync: {
          local: 'Local preference only',
          saving: 'Sincronizando...',
          saved: 'Ajustes guardados',
          error: 'Error de sincronización',
          cloud: 'Conectado a la nube',
        },
        appearance: {
          title: 'Apariencia',
          subtitle: 'Elige el tono visual de la aplicación.',
          system: 'Sistema',
          dark: 'Oscuro',
          light: 'Claro',
          systemDesc: 'Match dispositivo',
          darkDesc: 'Modo noche',
          lightDesc: 'Modo día',
        },
        language: {
          title: 'Idioma',
          subtitle: 'Personaliza el idioma de la app y reseñas.',
          system: 'Sistema',
          es: 'Español',
          en: 'English',
          fr: 'Français',
        },
        mapLayer: {
          title: 'Capa de Mapa',
          subtitle: 'Cómo se renderiza la ciudad bajo tus datos.',
          minimal: { label: 'Minimal', desc: 'Clean and calm' },
          standard: { label: 'Standard', desc: 'Default city map' },
          hybrid: { label: 'Hybrid', desc: 'Satellite with labels' },
          satellite: { label: 'Satellite', desc: 'Imagery first' },
          terrain: { label: 'Terrain', desc: 'Topography and parks' },
        },
        gadoOverlay: {
          title: 'WHIM Overlay',
          subtitle: 'Resalta reportes y eventos con señales visuales fuertes.',
          liveActivity: 'Énfasis en actividad viva',
          liveActivityDesc: 'Inspirado en apps de tráfico, pero para la comunidad WHIM.',
        },
        defaultRadius: {
          title: 'Radio por Defecto',
          subtitle: 'Filtros del Mapa.',
          realTime: 'Eventos en tiempo real',
          realTimeDesc: 'Muestra eventos y reportes de la comunidad en el mapa principal.',
          autoSearch: 'Distancia máxima de búsqueda automática.',
        },
        done: 'Listo',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'es', // default language
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
  compatibilityJSON: 'v4', // Required for React Native
});

export default i18n;
