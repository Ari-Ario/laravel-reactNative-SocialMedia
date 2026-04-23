import * as Localization from 'expo-localization';
import { useContext, useMemo, useEffect } from 'react';
import AuthContext from '@/context/AuthContext';
import { useTranslationStore } from '@/stores/translationStore';

export type Locale = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'ru' | 'tr' | 'ar' | 'fa' | 'ckb' | 'ku' | 'zh' | 'hi' | 'bn' | 'ja' | 'ko' | 'id' | 'ur' | 'th' | 'vi' | 'tl' | 'ms' | 'nl' | 'sv' | 'el' | 'he' | 'zza' | 'hac';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'fa', label: 'Persian', native: 'فارسی' },
  { code: 'ckb', label: 'Kurdish (Sorani)', native: 'کوردی (سۆرانی)' },
  { code: 'ku', label: 'Kurdish (Kurmanji)', native: 'Kurdî (Kurmancî)' },
  { code: 'zza', label: 'Kurdish (Zaza)', native: 'Zazaki' },
  { code: 'hac', label: 'Kurdish (Hawrami)', native: 'Hewramî' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ur', label: 'Urdu', native: 'اردو' },
  { code: 'th', label: 'Thai', native: 'ไทย' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'tl', label: 'Tagalog', native: 'Tagalog' },
  { code: 'ms', label: 'Malay', native: 'Bahasa Melayu' },
  { code: 'nl', label: 'Dutch', native: 'Nederlands' },
  { code: 'sv', label: 'Swedish', native: 'Svenska' },
  { code: 'el', label: 'Greek', native: 'Ελληνικά' },
  { code: 'he', label: 'Hebrew', native: 'עبری' },
];

/**
 * Static T function for use outside of components.
 * Note: This will use whatever is currently loaded in the store.
 */
export const t = (key: string, params?: Record<string, any>): string => {
  const translations = useTranslationStore.getState().translations;
  let text = translations[key] || key;
  if (params) {
    Object.keys(params).forEach(p => {
      text = text.replace(`{${p}}`, params[p]);
    });
  }
  return text;
};

export const setLocale = async (locale: Locale) => {
  await useTranslationStore.getState().setLocale(locale);
};

export const getLocale = (): Locale => useTranslationStore.getState().locale;

/**
 * Reactive hook for translations.
 * Listens only to the TranslationStore for maximum performance and global reactivity.
 */
export const useTranslation = () => {
  const { locale, translations, isLoading } = useTranslationStore();
  
  return useMemo(() => ({
    t: (key: string, params?: Record<string, any>) => {
      let text = translations[key] || key;
      if (params) {
        Object.keys(params).forEach(p => {
          text = text.replace(`{${p}}`, params[p]);
        });
      }
      return text;
    },
    locale,
    isLoading,
    isRTL: ['ar', 'fa', 'ckb', 'ur', 'he'].includes(locale)
  }), [translations, locale, isLoading]);
};
