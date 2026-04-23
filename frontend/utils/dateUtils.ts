import { 
  formatDistanceToNow, 
  format, 
  isToday, 
  isYesterday, 
  differenceInDays,
  parseISO
} from 'date-fns';
import { 
  enUS, 
  ckb, 
  ar, 
  faIR, 
  tr, 
  ru, 
  de, 
  fr, 
  es, 
  it, 
  pt, 
  zhCN, 
  hi, 
  bn, 
  ja, 
  ko, 
  id, 
  ur, 
  th, 
  vi, 
  nl, 
  sv, 
  el, 
  he 
} from 'date-fns/locale';
import { t, getLocale } from '@/constants/i18n';

/**
 * Maps our internal locale codes to date-fns locale objects
 */
const localeMap: Record<string, any> = {
  en: enUS,
  ckb: ckb,
  ar: ar,
  fa: faIR,
  tr: tr,
  ru: ru,
  de: de,
  fr: fr,
  es: es,
  it: it,
  pt: pt,
  zh: zhCN,
  hi: hi,
  bn: bn,
  ja: ja,
  ko: ko,
  id: id,
  ur: ur,
  th: th,
  vi: vi,
  nl: nl,
  sv: sv,
  el: el,
  he: he
};

/**
 * Formats a date to a localized "time ago" string.
 * Supports compact formatting for social media.
 * 
 * @param date - Date object, ISO string, or timestamp
 * @returns Localized time ago string
 */
export const formatTimeAgo = (date: Date | string | number): string => {
    if (!date) return '';
    
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diffInDays = differenceInDays(now, d);
    const currentLocale = getLocale();
    const dateFnsLocale = localeMap[currentLocale] || enUS;

    // For very recent dates (less than 7 days), use relative time
    if (diffInDays < 7) {
        return formatDistanceToNow(d, { 
            addSuffix: true, 
            locale: dateFnsLocale 
        });
    }
    
    // For older dates, use a standardized date format
    // Today: "Today, 3:45 PM"
    // Yesterday: "Yesterday, 1:20 PM"
    // Others: "Jan 15, 2024"
    if (isToday(d)) {
        return t('today_at').replace('{time}', format(d, 'p', { locale: dateFnsLocale }));
    }
    
    if (isYesterday(d)) {
        return t('yesterday_at').replace('{time}', format(d, 'p', { locale: dateFnsLocale }));
    }

    return format(d, 'PPP', { locale: dateFnsLocale });
};

