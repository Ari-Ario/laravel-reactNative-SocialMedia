import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { Locale, LANGUAGES } from '@/constants/i18n';
import enTranslations from '../constants/locales/en.json';

interface TranslationState {
  locale: Locale;
  translations: Record<string, string>;
  isLoading: boolean;
  setLocale: (locale: Locale) => Promise<void>;
}

const LOADERS: Record<string, () => Promise<any>> = {
  en: () => import('../constants/locales/en.json'),
  de: () => import('../constants/locales/de.json'),
  fr: () => import('../constants/locales/fr.json'),
  es: () => import('../constants/locales/es.json'),
  it: () => import('../constants/locales/it.json'),
  pt: () => import('../constants/locales/pt.json'),
  ru: () => import('../constants/locales/ru.json'),
  tr: () => import('../constants/locales/tr.json'),
  ar: () => import('../constants/locales/ar.json'),
  fa: () => import('../constants/locales/fa.json'),
  ckb: () => import('../constants/locales/ckb.json'),
  ku: () => import('../constants/locales/ku.json'),
  zza: () => import('../constants/locales/zza.json'),
  hac: () => import('../constants/locales/hac.json'),
  zh: () => import('../constants/locales/zh.json'),
  hi: () => import('../constants/locales/hi.json'),
  bn: () => import('../constants/locales/bn.json'),
  ja: () => import('../constants/locales/ja.json'),
  ko: () => import('../constants/locales/ko.json'),
  id: () => import('../constants/locales/id.json'),
  ur: () => import('../constants/locales/ur.json'),
  th: () => import('../constants/locales/th.json'),
  vi: () => import('../constants/locales/vi.json'),
  tl: () => import('../constants/locales/tl.json'),
  ms: () => import('../constants/locales/ms.json'),
  nl: () => import('../constants/locales/nl.json'),
  sv: () => import('../constants/locales/sv.json'),
  el: () => import('../constants/locales/el.json'),
  he: () => import('../constants/locales/he.json'),
};

const getDeviceLocale = (): Locale => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode;
  const normalized = (deviceLocale as string)?.split('-')[0]?.split('_')[0];
  return LOADERS[normalized] ? (normalized as Locale) : 'en';
};

export const useTranslationStore = create<TranslationState>()(
  persist(
    (set, get) => ({
      locale: 'en', // Default until hydration
      translations: enTranslations as Record<string, string>,
      isLoading: false,
      setLocale: async (newLocale: Locale) => {
        const locale = (newLocale as string)?.split('-')[0]?.split('_')[0] as Locale;
        
        // Skip if already loaded and NOT in initial state (where translations are just en)
        if (get().locale === locale && !get().isLoading && locale !== 'en' && get().translations['settings'] !== enTranslations['settings']) {
          set({ isLoading: false });
          return;
        }

        // If another load is already in progress for the SAME locale, wait for it
        if (get().isLoading && get().locale === locale) {
           return;
        }
        
        if (locale === 'en') {
          set({ locale: 'en', translations: enTranslations as Record<string, string>, isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          console.log(`[TranslationStore] Loading shard: ${locale}`);
          const loader = LOADERS[locale] || LOADERS['en'];
          const module = await loader();
          const nextTranslations = module.default || module;
          
          set({ 
            locale, 
            translations: { ...enTranslations, ...nextTranslations }, 
            isLoading: false 
          });
        } catch (error) {
          console.error(`[TranslationStore] Failed to load ${locale}:`, error);
          set({ 
            locale: 'en', 
            translations: enTranslations as Record<string, string>, 
            isLoading: false 
          });
        }
      },
    }),
    {
      name: 'zmzir-translation-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const initialLocale = state.locale || getDeviceLocale();
          state.setLocale(initialLocale);
        }
      },
    }
  )
);
