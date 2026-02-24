import React, { useState, useEffect } from 'react';
import { AppSection, PrayerData } from './types';
import { ESSENTIAL_DUAS, SAMPLE_QURAN } from './constants';

// Helper to convert English numbers to Bengali
const toBengaliNumber = (num: number | string): string => {
  const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, (d) => bengaliNumerals[parseInt(d)]);
};

// Helper to format time to 12h format in Bengali
const formatTime = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const hours12 = hours % 12 || 12;
  return `${toBengaliNumber(hours12)}:${toBengaliNumber(minutes.toString().padStart(2, '0'))}`;
};

// Helper to get Bengali Date
const getBengaliDate = (date: Date) => {
  const months = [
    "বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", 
    "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"
  ];
  const day = date.getDate();
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();

  // Simplified logic for Bengali Calendar (starts April 14)
  let bnDay, bnMonth, bnYear;
  
  if (month > 3 || (month === 3 && day >= 14)) {
    bnYear = year - 593;
  } else {
    bnYear = year - 594;
  }

  const monthDays = [31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29, 30];
  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
    monthDays[10] = 30; // Leap year Falgun
  }

  const start = new Date(year, 3, 14); // April 14
  const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  let totalDays = diff;
  if (totalDays < 0) {
    totalDays += 365 + (monthDays[10] === 30 ? 1 : 0);
  }

  let m = 0;
  while (totalDays >= monthDays[m]) {
    totalDays -= monthDays[m];
    m++;
  }
  
  bnMonth = months[m];
  bnDay = totalDays + 1;

  return { day: toBengaliNumber(bnDay), month: bnMonth, year: toBengaliNumber(bnYear) };
};

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.PRAYER);
  const [prayerData, setPrayerData] = useState<PrayerData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [city, setCity] = useState<string>(() => localStorage.getItem('userCity') || 'Dhaka');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => localStorage.getItem('notifications') === 'true');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [activePrayer, setActivePrayer] = useState<string>('');
  const [nextPrayer, setNextPrayer] = useState<string>('');

  useEffect(() => {
    fetchPrayerTimes();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      checkNotification();
    }, 1000);
    return () => clearInterval(interval);
  }, [city]);

  useEffect(() => {
    if (prayerData) {
      calculateActivePrayer();
    }
  }, [currentTime, prayerData]);

  const fetchPrayerTimes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Bangladesh&method=2`);
      const data = await response.json();
      if (data.code === 200) {
        setPrayerData(data.data);
      }
    } catch (error) {
      console.error("Error fetching prayer times:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateActivePrayer = () => {
    if (!prayerData) return;
    
    const timings = prayerData.timings;
    const now = new Date();
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const prayers = [
      { name: 'Fajr', start: timings.Fajr, end: timings.Sunrise },
      { name: 'Dhuhr', start: timings.Dhuhr, end: timings.Asr },
      { name: 'Asr', start: timings.Asr, end: timings.Maghrib },
      { name: 'Maghrib', start: timings.Maghrib, end: timings.Isha },
      { name: 'Isha', start: timings.Isha, end: timings.Fajr } 
    ];

    let active = null;
    let next = null;
    let remainingSeconds = 0;
    let totalDuration = 0;

    for (let i = 0; i < prayers.length; i++) {
      const p = prayers[i];
      const start = timeToMinutes(p.start);
      const end = timeToMinutes(p.end);
      
      // Handle Isha crossing midnight
      if (p.name === 'Isha' && end < start) {
         if (currentMinutes >= start || currentMinutes < end) {
             active = p;
             next = prayers[0]; // Fajr
             if (currentMinutes >= start) {
                 remainingSeconds = ((24 * 60) - currentMinutes + end) * 60 - now.getSeconds();
                 totalDuration = ((24 * 60) - start + end) * 60;
             } else {
                 remainingSeconds = (end * 60) - (currentMinutes * 60 + now.getSeconds());
                 totalDuration = ((24 * 60) - start + end) * 60;
             }
             break;
         }
      } else if (currentMinutes >= start && currentMinutes < end) {
        active = p;
        next = prayers[(i + 1) % prayers.length];
        remainingSeconds = (end * 60) - (currentMinutes * 60 + now.getSeconds());
        totalDuration = (end - start) * 60;
        break;
      }
    }

    if (!active) {
       // Logic for times between prayers (e.g. after Sunrise before Dhuhr)
       const sunrise = timeToMinutes(timings.Sunrise);
       const dhuhr = timeToMinutes(timings.Dhuhr);
       
       if (currentMinutes >= sunrise && currentMinutes < dhuhr) {
         active = { name: 'Ishraq', start: timings.Sunrise, end: timings.Dhuhr };
         next = prayers[1]; // Dhuhr
         remainingSeconds = (dhuhr * 60) - (currentMinutes * 60 + now.getSeconds());
         totalDuration = (dhuhr - sunrise) * 60;
       } else {
         // Fallback or late night logic
         active = { name: 'Waiting', start: '00:00', end: '00:00' };
       }
    }

    if (active) {
      setActivePrayer(active.name);
      setNextPrayer(next?.name || '');
      
      const h = Math.floor(remainingSeconds / 3600);
      const m = Math.floor((remainingSeconds % 3600) / 60);
      const s = remainingSeconds % 60;
      setTimeLeft(`${toBengaliNumber(h.toString().padStart(2, '0'))}:${toBengaliNumber(m.toString().padStart(2, '0'))}:${toBengaliNumber(s.toString().padStart(2, '0'))}`);
      
      const prog = ((totalDuration - remainingSeconds) / totalDuration) * 100;
      setProgress(prog);
    }
  };

  const checkNotification = () => {
    if (!notificationsEnabled || !prayerData) return;
    // Notification logic placeholder
  };

  const toggleNotifications = () => {
    if (!notificationsEnabled) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          localStorage.setItem('notifications', 'true');
        }
      });
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('notifications', 'false');
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCity = e.target.value;
    setCity(newCity);
    localStorage.setItem('userCity', newCity);
  };

  const bnDate = getBengaliDate(currentTime);
  const hijriDate = prayerData?.date.hijri;

  const prayerNameMap: {[key: string]: string} = {
    Fajr: 'ফজর',
    Sunrise: 'সূর্যোদয়',
    Dhuhr: 'যোহর',
    Asr: 'আসর',
    Maghrib: 'মাগরিব',
    Isha: 'এশা',
    Ishraq: 'চাশত'
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-900 text-white shadow-xl relative overflow-hidden font-sans">
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeSection === AppSection.PRAYER && (
          <div className="animate-fade-in space-y-3 p-3">
            
            {/* Top Header Card */}
            <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
               <div className="flex justify-between items-center relative z-10">
                 <div>
                   <h2 className="text-xl font-bold">{hijriDate ? `${toBengaliNumber(hijriDate.day)} ${hijriDate.month.en === 'Ramadan' ? 'রমজান' : hijriDate.month.en}` : '...'}</h2>
                   <p className="text-sm opacity-90 mt-1">
                     {currentTime.toLocaleDateString('bn-BD', { weekday: 'long' })}, {toBengaliNumber(currentTime.getDate())} {currentTime.toLocaleDateString('bn-BD', { month: 'long' })}
                   </p>
                   <p className="text-sm opacity-90">{bnDate.day} {bnDate.month}</p>
                 </div>
                 <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <i className="fa-solid fa-sun text-yellow-300 text-2xl animate-pulse"></i>
                      <div className="text-right">
                        <p className="text-xl font-bold">{prayerData ? formatTime(prayerData.timings.Sunrise) : '--:--'}</p>
                        <p className="text-xs opacity-80">সূর্যোদয়</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-xl font-bold">{prayerData ? formatTime(prayerData.timings.Sunset) : '--:--'}</p>
                        <p className="text-xs opacity-80">সূর্যাস্ত</p>
                      </div>
                    </div>
                 </div>
               </div>
               {/* Decorative circles */}
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
               <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
            </div>

            {/* Prayer Times Card */}
            <div className="bg-slate-800 rounded-2xl p-4 shadow-lg border border-slate-700">
              <div className="flex gap-4">
                {/* Left: Circular Timer */}
                <div className="w-1/3 flex flex-col items-center justify-center">
                  <h3 className="text-lg font-bold text-white mb-1">{prayerNameMap[activePrayer] || activePrayer}</h3>
                  <p className="text-xs text-slate-400 mb-2">শেষ হতে বাকি</p>
                  
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700" />
                      <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={2 * Math.PI * 48} 
                        strokeDashoffset={2 * Math.PI * 48 * (1 - progress / 100)} 
                        className="text-emerald-500 transition-all duration-1000 ease-linear" 
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xl font-bold tracking-wider">{timeLeft}</span>
                  </div>
                </div>

                {/* Right: Prayer List */}
                <div className="w-2/3 space-y-2">
                  {[
                    { key: 'Fajr', name: 'ফজর', end: 'Sunrise' },
                    { key: 'Dhuhr', name: 'যোহর', end: 'Asr' },
                    { key: 'Asr', name: 'আসর', end: 'Maghrib' },
                    { key: 'Maghrib', name: 'মাগরিব', end: 'Isha' },
                    { key: 'Isha', name: 'এশা', end: 'Fajr' }
                  ].map((p) => {
                    const isActive = activePrayer === p.key;
                    const startTime = prayerData?.timings[p.key as keyof typeof prayerData.timings];
                    const endTime = p.end === 'Fajr' ? prayerData?.timings.Fajr : prayerData?.timings[p.end as keyof typeof prayerData.timings];
                    
                    return (
                      <div key={p.key} className={`flex justify-between items-center p-2 rounded-lg ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}>
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className="font-mono text-sm">
                          {startTime ? formatTime(startTime) : '--:--'} - {endTime ? formatTime(endTime) : '--:--'}
                        </span>
                      </div>
                    );
                  })}
                  <div className="text-right text-xs text-slate-400 mt-2">
                    মাকরূহ: রাত ১১:৪০ (আনুমানিক)
                  </div>
                </div>
              </div>
            </div>

            {/* Sehri & Iftar Card */}
            <div className="bg-slate-800 rounded-2xl p-5 shadow-lg border border-slate-700 relative">
               <button className="absolute top-3 right-3 text-slate-400 hover:text-white">
                 <i className="fa-solid fa-expand"></i>
               </button>
               <div className="flex justify-between items-center text-center divide-x divide-slate-700">
                 <div className="px-2 flex-1">
                   <h3 className="text-2xl font-bold text-white mb-1">{prayerData ? formatTime(prayerData.timings.Fajr) : '--:--'}</h3>
                   <p className="text-xs text-slate-400 mb-2">পরবর্তী সাহরি</p>
                   <button className="text-emerald-500 text-xs border border-emerald-500/30 px-3 py-1 rounded-full hover:bg-emerald-500/10">অ্যালার্ম</button>
                 </div>
                 <div className="px-2 flex-1">
                   <h3 className="text-2xl font-bold text-white mb-1">{prayerData ? formatTime(prayerData.timings.Maghrib) : '--:--'}</h3>
                   <p className="text-xs text-slate-400 mb-2">পরবর্তী ইফতার</p>
                   <button className="text-emerald-500 text-xs border border-emerald-500/30 px-3 py-1 rounded-full hover:bg-emerald-500/10">অ্যালার্ম</button>
                 </div>
                 <div className="px-2 flex-1">
                   <h3 className="text-2xl font-bold text-white mb-1">০২:৪১:১৩</h3>
                   <p className="text-xs text-slate-400">ইফতারের বাকি</p>
                 </div>
               </div>
            </div>

          </div>
        )}

        {activeSection === AppSection.QURAN && (
          <div className="animate-fade-in p-4">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <i className="fa-solid fa-book-quran text-emerald-500"></i> কুরআন মজীদ
            </h2>
            <div className="grid gap-4">
              {SAMPLE_QURAN.map((v) => (
                <div key={v.id} className="bg-slate-800 p-5 rounded-2xl shadow-sm border-l-4 border-emerald-500">
                  <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">{v.surah}</p>
                  <p className="text-right text-2xl font-arabic mb-4 text-white leading-relaxed" dir="rtl">
                    {v.arabic}
                  </p>
                  <p className="text-sm text-slate-400 italic mb-2">"{v.pronunciation}"</p>
                  <p className="text-slate-300 leading-snug">{v.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === AppSection.DUA && (
          <div className="animate-fade-in p-4">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <i className="fa-solid fa-hands-praying text-emerald-500"></i> প্রয়োজনীয় দোয়া
            </h2>
            <div className="grid gap-4">
              {ESSENTIAL_DUAS.map((d) => (
                <div key={d.id} className="bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-700">
                  <h3 className="font-bold text-lg text-emerald-400 mb-3">{d.title}</h3>
                  <p className="text-right text-xl mb-3 text-white font-arabic" dir="rtl">{d.arabic}</p>
                  <p className="text-sm text-slate-400 italic mb-2">{d.pronunciation}</p>
                  <p className="text-slate-300 text-sm border-t pt-2 border-slate-700">{d.meaning}</p>
                  {d.reference && <p className="text-[10px] text-right mt-2 text-slate-500">সূত্র: {d.reference}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === AppSection.SETTINGS && (
          <div className="animate-fade-in p-4">
            <h2 className="text-xl font-bold text-white mb-4">সেটিংস</h2>
            <div className="bg-slate-800 p-6 rounded-2xl shadow-sm space-y-6 border border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">আপনার শহর</label>
                <input 
                  type="text" 
                  value={city}
                  onChange={handleCityChange}
                  className="w-full p-3 rounded-xl bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="যেমন: Dhaka"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-300">নামাজের নোটিফিকেশন</h4>
                  <p className="text-xs text-slate-500">নামাজের সময় হলে বার্তা দিবে</p>
                </div>
                <button 
                  onClick={toggleNotifications}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            <button 
              onClick={() => setActiveSection(AppSection.PRAYER)}
              className="w-full mt-6 bg-emerald-600 text-white p-4 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-colors"
            >
              সেভ করুন
            </button>
          </div>
        )}
      </main>

      {/* Navigation Footer */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900 border-t border-slate-800 flex justify-around p-3 pb-6 z-50 rounded-t-3xl shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
        <button 
          onClick={() => setActiveSection(AppSection.PRAYER)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.PRAYER ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-clock text-lg"></i>
          <span className="text-[10px] font-bold">নামাজ</span>
        </button>
        <button 
          onClick={() => setActiveSection(AppSection.QURAN)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.QURAN ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-book-quran text-lg"></i>
          <span className="text-[10px] font-bold">কুরআন</span>
        </button>
        <button 
          onClick={() => setActiveSection(AppSection.DUA)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.DUA ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-hands-praying text-lg"></i>
          <span className="text-[10px] font-bold">দোয়া</span>
        </button>
        <button 
          onClick={() => setActiveSection(AppSection.SETTINGS)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.SETTINGS ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-gear text-lg"></i>
          <span className="text-[10px] font-bold">সেটিংস</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
