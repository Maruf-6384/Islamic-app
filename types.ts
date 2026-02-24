
export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
  Firstthird: string;
  Lastthird: string;
}

export interface HijriDate {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
    ar: string;
  };
  month: {
    number: number;
    en: string;
    ar: string;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
}

export interface GregorianDate {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
  };
  month: {
    number: number;
    en: string;
  };
  year: string;
}

export interface DateInfo {
  readable: string;
  timestamp: string;
  hijri: HijriDate;
  gregorian: GregorianDate;
}

export interface PrayerData {
  timings: PrayerTimes;
  date: DateInfo;
  meta: any;
}

export interface QuranVerse {
  id: number;
  arabic: string;
  pronunciation: string;
  meaning: string;
  surah: string;
}

export interface Dua {
  id: number;
  title: string;
  arabic: string;
  pronunciation: string;
  meaning: string;
  reference?: string;
}

export enum AppSection {
  PRAYER = 'prayer',
  RAMADAN = 'ramadan',
  QURAN = 'quran',
  DUA = 'dua',
  SETTINGS = 'settings'
}
