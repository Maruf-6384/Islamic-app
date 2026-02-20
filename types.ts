
export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
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
  QURAN = 'quran',
  DUA = 'dua',
  SETTINGS = 'settings'
}
