import React, { useState, useEffect } from 'react';
import { AppSection, PrayerData } from './types';
import { ESSENTIAL_DUAS, SAMPLE_QURAN, RAMADAN_DATA } from './constants';

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

// Helper to add/subtract minutes from 24h time string
const adjustTime = (timeStr: string, minutes: number): string => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + minutes);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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

  const [nextEvent, setNextEvent] = useState<{ name: string, time: string, timeLeft: string } | null>(null);

  // Ramadan State
  const [ramadanDay, setRamadanDay] = useState<number>(1);
  const [salahTracker, setSalahTracker] = useState<Record<string, { fard: boolean, sunnah: boolean }>>(() => {
    const saved = localStorage.getItem('salahTracker');
    return saved ? JSON.parse(saved) : {};
  });
  const [checklistTracker, setChecklistTracker] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('checklistTracker');
    return saved ? JSON.parse(saved) : {};
  });

  // Tasbih State
  const [tasbihCount, setTasbihCount] = useState<number>(0);
  const [tasbihTarget, setTasbihTarget] = useState<number>(100);
  const [activeTasbih, setActiveTasbih] = useState<string>('সুবহানাল্লাহ');
  const [customTargetInput, setCustomTargetInput] = useState<string>('100');
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const tasbihOptions = [
    { name: 'সুবহানাল্লাহ', defaultTarget: 100 },
    { name: 'আলহামদুলিল্লাহ', defaultTarget: 100 },
    { name: 'আল্লাহু আকবার', defaultTarget: 100 },
    { name: 'লা ইলাহা ইল্লাল্লাহ', defaultTarget: 100 },
    { name: 'আস্তাগফিরুল্লাহ', defaultTarget: 100 },
    { name: 'দরুদে ইব্রাহিম', defaultTarget: 100 },
  ];

  const handleTasbihClick = () => {
    const newCount = tasbihCount + 1;
    setTasbihCount(newCount);
    
    // Vibrate on tap (short)
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }

    // Alarm/Vibrate on target (long)
    if (newCount === tasbihTarget) {
      if (navigator.vibrate) {
        // Distinct pattern: Long, pause, Long
        navigator.vibrate([500, 200, 500]);
      }
      // Visual feedback is handled in UI, removed alert to prevent interruption
    }
  };

  const resetTasbih = () => {
    setTasbihCount(0);
  };

  const selectTasbih = (name: string, target: number) => {
    setActiveTasbih(name);
    setTasbihTarget(target);
    setTasbihCount(0);
  };

  const [showMoreSalah, setShowMoreSalah] = useState(false);
  const [quranExpanded, setQuranExpanded] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [quranProgress, setQuranProgress] = useState<Record<string, { tilawat: string, meaning: string }>>(() => {
    const saved = localStorage.getItem('quranProgress');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist Ramadan State
  useEffect(() => {
    localStorage.setItem('salahTracker', JSON.stringify(salahTracker));
  }, [salahTracker]);

  useEffect(() => {
    localStorage.setItem('checklistTracker', JSON.stringify(checklistTracker));
  }, [checklistTracker]);

  useEffect(() => {
    localStorage.setItem('quranProgress', JSON.stringify(quranProgress));
  }, [quranProgress]);

  const toggleSalah = (day: number, salah: string, type: 'fard' | 'sunnah') => {
    const key = `${day}-${salah}`;
    setSalahTracker(prev => ({
      ...prev,
      [key]: {
        ...prev[key] || { fard: false, sunnah: false },
        [type]: !prev[key]?.[type]
      }
    }));
  };

  const toggleChecklist = (day: number, item: string) => {
    const key = `${day}-${item}`;
    setChecklistTracker(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const updateQuranProgress = (day: number, type: 'tilawat' | 'meaning', value: string) => {
    const key = day.toString();
    setQuranProgress(prev => ({
      ...prev,
      [key]: {
        ...prev[key] || { tilawat: '', meaning: '' },
        [type]: value
      }
    }));
  };

  const currentRamadanData = RAMADAN_DATA[ramadanDay - 1] || RAMADAN_DATA[0];

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
      calculateNextEvent();
    }
  }, [currentTime, prayerData]);

  const fetchPrayerTimes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Bangladesh&method=1`);
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
         active = { name: 'Ishraq/Doha', start: timings.Sunrise, end: timings.Dhuhr };
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

  const calculateNextEvent = () => {
    if (!prayerData) return;
    const timings = prayerData.timings;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const fajr = timeToMinutes(timings.Fajr);
    const maghrib = timeToMinutes(timings.Maghrib);

    let targetTime = 0;
    let eventName = '';
    let isTomorrow = false;

    if (currentMinutes < fajr) {
      targetTime = fajr;
      eventName = 'সাহরি';
    } else if (currentMinutes < maghrib) {
      targetTime = maghrib;
      eventName = 'ইফতার';
    } else {
      targetTime = fajr;
      eventName = 'সাহরি';
      isTomorrow = true;
    }

    let remainingSeconds = 0;
    if (isTomorrow) {
      remainingSeconds = ((24 * 60) - currentMinutes + targetTime) * 60 - now.getSeconds();
    } else {
      remainingSeconds = (targetTime * 60) - (currentMinutes * 60 + now.getSeconds());
    }

    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    const s = remainingSeconds % 60;
    
    setNextEvent({
      name: eventName,
      time: isTomorrow ? timings.Fajr : (eventName === 'ইফতার' ? timings.Maghrib : timings.Fajr),
      timeLeft: `${toBengaliNumber(h.toString().padStart(2, '0'))}:${toBengaliNumber(m.toString().padStart(2, '0'))}:${toBengaliNumber(s.toString().padStart(2, '0'))}`
    });
  };

  const checkNotification = () => {
    if (!notificationsEnabled || !prayerData) return;
    
    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    Object.entries(prayerData.timings).forEach(([name, time]) => {
      if (time === currentTimeStr && now.getSeconds() === 0) {
        new Notification("নামাজের সময় হয়েছে", {
          body: `এখন ${name} ওয়াক্তের সময়।`,
          icon: '/icon.png' // Assuming an icon exists or browser default
        });
      }
    });
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
      
      {/* Location Header */}
      {activeSection === AppSection.PRAYER && (
        <header className="bg-slate-900 p-4 pt-6 pb-2 flex items-center gap-2">
          <i className="fa-solid fa-location-dot text-slate-400 text-xl"></i>
          <div className="flex items-center gap-1 cursor-pointer" onClick={() => setActiveSection(AppSection.SETTINGS)}>
            <h1 className="text-2xl font-bold text-white">{city},</h1>
            <span className="text-slate-400 text-lg">Bangladesh</span>
            <i className="fa-solid fa-chevron-down text-slate-400 text-sm ml-1"></i>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeSection === AppSection.PRAYER && (
          <div className="animate-fade-in space-y-3 p-3">
            
            {/* Top Date & Sun Card */}
            {(() => {
              let bgImage = 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1000&auto=format&fit=crop'; // Default
              let overlayColor = 'bg-emerald-900/40';
              let isForbiddenTime = false;

              // Check for forbidden times
              if (prayerData) {
                 const now = new Date();
                 const sunrise = prayerData.timings.Sunrise;
                 const dhuhr = prayerData.timings.Dhuhr;
                 const sunset = prayerData.timings.Sunset;

                 const getMinutes = (timeStr: string) => {
                   const [h, m] = timeStr.split(':').map(Number);
                   return h * 60 + m;
                 };

                 const currentMinutes = now.getHours() * 60 + now.getMinutes();
                 
                 // Calculate end times for forbidden periods
                 // Sunrise forbidden: Sunrise to Sunrise + 15min
                 const sunriseStartMin = getMinutes(sunrise);
                 const sunriseEndMin = sunriseStartMin + 15;

                 // Dhuhr forbidden: Dhuhr - 7min to Dhuhr - 1min
                 const dhuhrStartMin = getMinutes(dhuhr) - 7;
                 const dhuhrEndMin = getMinutes(dhuhr) - 1;

                 // Sunset forbidden: Sunset - 16min to Sunset
                 const sunsetStartMin = getMinutes(sunset) - 16;
                 const sunsetEndMin = getMinutes(sunset);

                 if (
                   (currentMinutes >= sunriseStartMin && currentMinutes <= sunriseEndMin) ||
                   (currentMinutes >= dhuhrStartMin && currentMinutes <= dhuhrEndMin) ||
                   (currentMinutes >= sunsetStartMin && currentMinutes <= sunsetEndMin)
                 ) {
                   isForbiddenTime = true;
                 }
              }

              if (isForbiddenTime) {
                 // Forbidden Time: Red Background (Gradient)
                 bgImage = ''; 
                 overlayColor = 'bg-gradient-to-r from-red-600 to-red-900';
              } else if (activePrayer === 'Fajr') {
                // Fajr: Distinct Reddish dawn sky
                bgImage = 'https://images.unsplash.com/photo-1600456567530-02213d223847?q=80&w=1000&auto=format&fit=crop'; 
                overlayColor = 'bg-red-900/30';
              } else if (activePrayer === 'Sunrise' || activePrayer === 'Ishraq' || activePrayer === 'Ishraq/Doha') {
                 // Ishraq/Doha: Bright morning sky
                 bgImage = 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?q=80&w=1000&auto=format&fit=crop';
                 overlayColor = 'bg-orange-400/10'; 
              } else if (activePrayer === 'Dhuhr') {
                // Dhuhr: Bright sun slightly tilted west (110-120 degrees)
                bgImage = 'https://images.unsplash.com/photo-1533378936506-6a72e4bc9e84?q=80&w=1000&auto=format&fit=crop'; 
                overlayColor = 'bg-blue-600/10';
              } else if (activePrayer === 'Asr') {
                // Asr: Reddish Sunset (Swapped from Maghrib)
                bgImage = 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1000&auto=format&fit=crop'; 
                overlayColor = 'bg-red-900/30';
              } else if (activePrayer === 'Maghrib') {
                // Maghrib: Sun tilted 160-180 degrees (Swapped from Asr)
                bgImage = 'https://images.unsplash.com/photo-1472120435266-53107fd0c44a?q=80&w=1000&auto=format&fit=crop'; 
                overlayColor = 'bg-orange-600/20';
              } else if (activePrayer === 'Isha') {
                // Isha: Night sky with moon and stars
                bgImage = 'https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?q=80&w=1000&auto=format&fit=crop'; 
                overlayColor = 'bg-slate-900/40';
              }

              return (
                <div className={`rounded-2xl p-4 text-white shadow-lg relative overflow-hidden bg-cover bg-center transition-all duration-1000 bg-slate-800 ${isForbiddenTime ? 'bg-red-600' : ''}`} style={{ backgroundImage: isForbiddenTime ? 'none' : `url('${bgImage}')` }}>
                   <div className={`absolute inset-0 ${overlayColor} backdrop-blur-[0px]`}></div>
                   <div className="relative z-10 flex justify-between items-center">
                     <div className="space-y-1">
                       <h2 className="text-2xl font-bold">{currentTime.toLocaleDateString('bn-BD', { weekday: 'long' })}</h2>
                       <p className="text-lg font-medium opacity-90">
                         {hijriDate ? `${toBengaliNumber(hijriDate.day)} ${hijriDate.month.en === 'Ramadan' ? 'রমজান' : hijriDate.month.en} ${toBengaliNumber(hijriDate.year)}` : '...'}
                       </p>
                       <p className="text-sm opacity-90">
                         {toBengaliNumber(currentTime.getDate())} {currentTime.toLocaleDateString('bn-BD', { month: 'long' })}, {toBengaliNumber(currentTime.getFullYear())}
                       </p>
                       <p className="text-sm opacity-90">{bnDate.day} {bnDate.month}, {bnDate.year}</p>
                     </div>
                     <div className="text-right space-y-2">
                        <p className="text-sm font-medium">{city}, Bangladesh</p>
                        <div className="flex items-center justify-end gap-3">
                          {activePrayer === 'Isha' ? (
                             <i className="fa-solid fa-moon text-slate-200 text-3xl animate-pulse"></i>
                          ) : (
                             <i className="fa-solid fa-sun text-yellow-300 text-3xl animate-pulse"></i>
                          )}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0 text-center">
                            <p className="text-xl font-bold">{prayerData ? formatTime(prayerData.timings.Sunrise) : '--:--'}</p>
                            <p className="text-xl font-bold">{prayerData ? formatTime(prayerData.timings.Sunset) : '--:--'}</p>
                            <p className="text-xs opacity-80">সূর্যোদয়</p>
                            <p className="text-xs opacity-80">সূর্যাস্ত</p>
                          </div>
                        </div>
                     </div>
                   </div>
                </div>
              );
            })()}

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
                    মাকরূহ: {prayerData ? formatTime(prayerData.timings.Midnight) : '--:--'} (আনুমানিক)
                  </div>
                </div>
              </div>
            </div>

            {/* Beta Warning Notification */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
              <div className="bg-amber-500/20 p-2 rounded-full flex-shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xl"></i>
              </div>
              <p className="text-sm text-amber-200 font-medium leading-relaxed">
                এই App বেটা পর্যায়ে রয়েছে তাই কেউ নামাজ এর টাইম সেহরি ইফতারের টাইম ফলো করবেন না এখান থেকে
              </p>
            </div>

            {/* Sehri & Iftar Card */}
            <div className="bg-slate-800 rounded-2xl p-5 shadow-lg border border-slate-700 relative">
               <button className="absolute top-3 right-3 text-slate-400 hover:text-white">
                 <i className="fa-solid fa-expand"></i>
               </button>
               <div className="flex justify-between items-center text-center divide-x divide-slate-700">
                 <div className="px-2 flex-1">
                   <h3 className="text-2xl font-bold text-white mb-1">{prayerData ? formatTime(prayerData.timings.Fajr) : '--:--'}</h3>
                   <p className="text-xs text-slate-400 mb-2">সাহরি শেষ</p>
                   <button className="text-emerald-500 text-xs border border-emerald-500/30 px-3 py-1 rounded-full hover:bg-emerald-500/10">অ্যালার্ম</button>
                 </div>
                 <div className="px-2 flex-1">
                   <h3 className="text-2xl font-bold text-white mb-1">{prayerData ? formatTime(prayerData.timings.Maghrib) : '--:--'}</h3>
                   <p className="text-xs text-slate-400 mb-2">ইফতার শুরু</p>
                   <button className="text-emerald-500 text-xs border border-emerald-500/30 px-3 py-1 rounded-full hover:bg-emerald-500/10">অ্যালার্ম</button>
                 </div>
                 <div className="px-2 flex-1">
                   <h3 className="text-2xl font-bold text-white mb-1">{nextEvent ? nextEvent.timeLeft : '--:--:--'}</h3>
                   <p className="text-xs text-slate-400">{nextEvent ? `${nextEvent.name}র বাকি` : 'সময় বাকি'}</p>
                 </div>
               </div>
            </div>

            {/* Forbidden Times Card */}
            <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-200">
              <div className="flex items-center justify-center gap-2 mb-4">
                <i className="fa-solid fa-circle-exclamation text-red-600 text-sm animate-pulse"></i>
                <h2 className="text-lg font-bold text-red-900">সালাতের নিষিদ্ধ সময়</h2>
              </div>
              
              <div className="flex justify-between items-center text-center divide-x divide-red-200">
                <div className="flex-1 px-2">
                  <p className="text-sm font-medium text-red-700 mb-1">ভোর</p>
                  <p className="text-lg font-bold text-red-900 font-mono leading-none">
                    {prayerData ? `${formatTime(prayerData.timings.Sunrise)} - ${formatTime(adjustTime(prayerData.timings.Sunrise, 15))}` : '--:--'}
                  </p>
                </div>
                <div className="flex-1 px-2">
                  <p className="text-sm font-medium text-red-700 mb-1">দুপুর</p>
                  <p className="text-lg font-bold text-red-900 font-mono leading-none">
                     {prayerData ? `${formatTime(adjustTime(prayerData.timings.Dhuhr, -7))} - ${formatTime(adjustTime(prayerData.timings.Dhuhr, -1))}` : '--:--'}
                  </p>
                </div>
                <div className="flex-1 px-2">
                  <p className="text-sm font-medium text-red-700 mb-1">সন্ধ্যা</p>
                  <p className="text-lg font-bold text-red-900 font-mono leading-none">
                     {prayerData ? `${formatTime(adjustTime(prayerData.timings.Sunset, -16))} - ${formatTime(prayerData.timings.Sunset)}` : '--:--'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeSection === AppSection.RAMADAN && (
          <div className="animate-fade-in p-3 space-y-4 bg-slate-900 min-h-full text-white rounded-t-3xl">
            {/* Ramadan Header */}
            <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-2">
              <div className="bg-emerald-600 text-white px-4 py-1 rounded-r-full font-bold flex items-center gap-2">
                <span className="text-xl">{toBengaliNumber(ramadanDay)}</span>
                <span className="text-lg">রমাদান</span>
                <div className="flex flex-col ml-2">
                   <i className="fa-solid fa-chevron-up text-[10px] cursor-pointer" onClick={() => setRamadanDay(d => Math.min(30, d + 1))}></i>
                   <i className="fa-solid fa-chevron-down text-[10px] cursor-pointer" onClick={() => setRamadanDay(d => Math.max(1, d - 1))}></i>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-serif font-bold text-slate-200 leading-tight">NOOR-UL-ILM</h2>
                <p className="text-[10px] tracking-widest text-slate-400 font-bold">QURAN SCHOOL</p>
              </div>
            </div>

            {/* Allah's Names Header */}
            <div className="bg-emerald-900/20 rounded-2xl p-2 border border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">الله</div>
                <span className="font-bold text-xs text-slate-300">আল্লাহর নাম</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {currentRamadanData.names.map((name, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <p className="font-arabic text-emerald-400 font-bold">{name.ar}</p>
                    <p className="text-[8px] text-slate-500">{name.bn}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Verse & Hadith Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-900/20 p-3 rounded-2xl border border-blue-800 relative">
                <h3 className="text-center bg-blue-900/50 text-blue-300 text-xs font-bold py-1 rounded-full mb-2">আজকের আয়াত</h3>
                <p className="text-right text-lg font-arabic mb-2 leading-relaxed text-slate-200" dir="rtl">{currentRamadanData.ayah.arabic}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{currentRamadanData.ayah.bangla} ({currentRamadanData.ayah.ref})</p>
              </div>
              <div className="bg-orange-900/20 p-3 rounded-2xl border border-orange-800">
                <h3 className="text-center bg-orange-900/50 text-orange-300 text-xs font-bold py-1 rounded-full mb-2">আজকের হাদীস</h3>
                <p className="text-[10px] text-slate-300 leading-tight">{currentRamadanData.hadith.bangla} ({currentRamadanData.hadith.ref})</p>
              </div>
            </div>

            {/* Trackers Section - Vertical Stack */}
            <div className="space-y-4 mt-4">
              
              {/* Salah Tracker */}
              <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-lg">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-500">
                    <i className="fa-solid fa-mosque text-xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-200">সালাত ট্র্যাকার</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-2 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <div className="text-left pl-2">ওয়াক্ত</div>
                  <div>ফরজ</div>
                  <div>সুন্নাত</div>
                </div>
                
                <div className="space-y-3">
                  {['ফজর', 'যোহর', 'আসর', 'মাগরিব', 'এশা'].map(salah => {
                    const key = `${ramadanDay}-${salah}`;
                    const status = salahTracker[key] || { fard: false, sunnah: false };
                    return (
                      <div key={salah} className="grid grid-cols-3 gap-4 items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                        <span className="font-bold text-slate-300 pl-2">{salah}</span>
                        <div className="flex justify-center">
                          <div 
                            onClick={() => toggleSalah(ramadanDay, salah, 'fard')}
                            className={`w-8 h-8 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-center border-2 ${status.fard ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-600 hover:border-emerald-500/50'}`}
                          >
                            {status.fard && <i className="fa-solid fa-check text-white text-sm"></i>}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <div 
                            onClick={() => toggleSalah(ramadanDay, salah, 'sunnah')}
                            className={`w-8 h-8 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-center border-2 ${status.sunnah ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-600 hover:border-emerald-500/50'}`}
                          >
                            {status.sunnah && <i className="fa-solid fa-check text-white text-sm"></i>}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {showMoreSalah && (
                    <div className="space-y-3 animate-fade-in">
                      {['তারাবীহ', 'তাহাজ্জুদ', 'ইশরাক'].map(salah => {
                        const key = `${ramadanDay}-${salah}`;
                        const status = salahTracker[key] || { fard: false, sunnah: false };
                        return (
                          <div key={salah} className="grid grid-cols-3 gap-4 items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                            <span className="font-bold text-slate-300 pl-2">{salah}</span>
                            <div className="flex justify-center">
                              <div 
                                onClick={() => toggleSalah(ramadanDay, salah, 'fard')}
                                className={`w-8 h-8 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-center border-2 ${status.fard ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-600 hover:border-emerald-500/50'}`}
                              >
                                {status.fard && <i className="fa-solid fa-check text-white text-sm"></i>}
                              </div>
                            </div>
                            <div className="flex justify-center">
                              <div 
                                onClick={() => toggleSalah(ramadanDay, salah, 'sunnah')}
                                className={`w-8 h-8 rounded-lg cursor-pointer transition-all duration-300 flex items-center justify-center border-2 ${status.sunnah ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-600 hover:border-emerald-500/50'}`}
                              >
                                {status.sunnah && <i className="fa-solid fa-check text-white text-sm"></i>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setShowMoreSalah(!showMoreSalah)}
                  className="w-full mt-4 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors py-2 rounded-lg hover:bg-slate-700/50"
                >
                  {showMoreSalah ? 'কম দেখান' : 'আরও দেখান'} <i className={`fa-solid fa-chevron-${showMoreSalah ? 'up' : 'down'}`}></i>
                </button>
              </div>

              {/* Quran Tracker */}
              <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden">
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => setQuranExpanded(!quranExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-500/10 p-2.5 rounded-xl text-orange-500">
                      <i className="fa-solid fa-book-open text-xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-200">কুরআন ট্র্যাকার</h3>
                  </div>
                  <i className={`fa-solid fa-chevron-${quranExpanded ? 'up' : 'down'} text-slate-400 transition-transform`}></i>
                </div>

                {quranExpanded && (
                  <div className="p-5 pt-0 space-y-4 animate-fade-in border-t border-slate-700/50 mt-2">
                     {/* Option 1 */}
                     <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-sm">কোরআন তেলাওয়াত</label>
                        <input 
                          type="text" 
                          placeholder="পরিমাণ (আয়াত/পৃষ্ঠা)" 
                          value={quranProgress[ramadanDay.toString()]?.tilawat || ''}
                          onChange={(e) => updateQuranProgress(ramadanDay, 'tilawat', e.target.value)}
                          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder-slate-500"
                        />
                     </div>
                     
                     {/* Option 2 */}
                     <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-sm">অর্থসহ কোরআন তেলাওয়াত</label>
                        <input 
                          type="text" 
                          placeholder="পরিমাণ (আয়াত/পৃষ্ঠা)" 
                          value={quranProgress[ramadanDay.toString()]?.meaning || ''}
                          onChange={(e) => updateQuranProgress(ramadanDay, 'meaning', e.target.value)}
                          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder-slate-500"
                        />
                     </div>
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden">
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => setChecklistExpanded(!checklistExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-500">
                      <i className="fa-solid fa-list-check text-xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-200">দৈনিক চেকলিস্ট</h3>
                  </div>
                  <i className={`fa-solid fa-chevron-${checklistExpanded ? 'up' : 'down'} text-slate-400 transition-transform`}></i>
                </div>

                {checklistExpanded && (
                  <div className="p-5 pt-0 space-y-2 animate-fade-in border-t border-slate-700/50 mt-2">
                    {[
                      'সকাল সন্ধ্যার যিকির', 'সালাত শেষের যিকির', 'দুয়া করা, ক্ষমা প্রার্থনা করা',
                      'কুরআন খতমের তিলাওয়াত', 'দান সাদাকা', 'প্রতি রাতের আমল'
                    ].map(item => {
                      const key = `${ramadanDay}-${item}`;
                      const isChecked = checklistTracker[key] || false;
                      return (
                        <div 
                          key={item} 
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isChecked ? 'bg-blue-900/20 border-blue-800' : 'bg-slate-900/30 border-slate-800 hover:bg-slate-800'}`}
                          onClick={() => toggleChecklist(ramadanDay, item)}
                        >
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                            {isChecked && <i className="fa-solid fa-check text-white text-xs"></i>}
                          </div>
                          <span className={`text-sm ${isChecked ? 'text-slate-400 line-through' : 'text-slate-300'}`}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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

        {activeSection === AppSection.TASBIH && (
          <div 
            className="animate-fade-in h-full flex flex-col relative bg-[#0f172a]"
            onClick={handleTasbihClick}
          >
            {/* Header Area */}
            <div className="pt-8 px-6 z-20" onClick={(e) => e.stopPropagation()}>
              <h1 className="text-3xl font-bold text-white mb-6">তাসবিহ</h1>
              
              {/* Dropdown Selector */}
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-slate-800 border border-emerald-500 rounded-lg px-4 py-3 flex items-center justify-between text-white font-medium shadow-sm active:scale-[0.99] transition-transform"
                >
                  <span className="text-lg">{activeTasbih}</span>
                  <div className="flex items-center gap-3">
                    {/* Target Indicator/Edit inside dropdown bar */}
                    <div 
                      className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomTargetInput(tasbihTarget.toString());
                        setShowTargetModal(true);
                      }}
                    >
                      <span>{toBengaliNumber(tasbihTarget)}</span>
                      <i className="fa-solid fa-pen text-[10px]"></i>
                    </div>
                    <i className={`fa-solid fa-chevron-down transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-30 animate-fade-in">
                    {tasbihOptions.map((opt) => (
                      <button
                        key={opt.name}
                        onClick={() => {
                          selectTasbih(opt.name, opt.defaultTarget);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-700 transition-colors flex justify-between items-center ${activeTasbih === opt.name ? 'text-emerald-500 bg-slate-700/30' : 'text-slate-300'}`}
                      >
                        <span>{opt.name}</span>
                        {activeTasbih === opt.name && <i className="fa-solid fa-check text-sm"></i>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Main Counter Area - Centered */}
            <div className="flex-1 flex flex-col items-center justify-center relative -mt-8">
               
               {/* Counter Circle */}
               <div className="w-72 h-72 rounded-full relative flex flex-col items-center justify-center select-none z-10">
                 {/* Outer Glow/Border */}
                 <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                 
                 {/* Progress Ring */}
                 <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-2xl">
                   {/* Track */}
                   <circle
                     cx="144" cy="144" r="130"
                     stroke="#1e293b" 
                     strokeWidth="8"
                     fill="#1e293b" 
                     fillOpacity="0.5"
                   />
                   {/* Progress */}
                   <circle
                     cx="144" cy="144" r="130"
                     stroke="#10b981" 
                     strokeWidth="8"
                     fill="transparent"
                     strokeDasharray={2 * Math.PI * 130}
                     strokeDashoffset={2 * Math.PI * 130 * (1 - Math.min(tasbihCount / tasbihTarget, 1))}
                     strokeLinecap="round"
                     className="transition-all duration-300 ease-out"
                   />
                 </svg>

                 {/* Inner Content */}
                 <div className="flex flex-col items-center z-10 relative">
                   <h3 className="text-slate-400 text-lg font-medium mb-2">{activeTasbih}</h3>
                   <h1 className="text-8xl font-bold text-white font-mono tracking-tighter drop-shadow-lg">
                     {toBengaliNumber(tasbihCount)}
                   </h1>
                   <p className="text-slate-500 text-sm mt-4">স্ক্রিনে ট্যাপ করুন</p>
                 </div>
               </div>

               {/* Reset Button */}
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   resetTasbih();
                 }}
                 className="mt-16 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-2 px-6 py-3 rounded-full border border-slate-700 z-10 shadow-lg"
               >
                 <i className="fa-solid fa-rotate-right"></i>
                 <span className="font-medium">রিসেট করুন</span>
               </button>
            </div>

            {/* Target Reached Overlay */}
            {tasbihCount === tasbihTarget && (
               <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none backdrop-blur-[2px]">
                  <div className="bg-emerald-600 text-white px-8 py-6 rounded-3xl font-bold animate-bounce shadow-2xl flex flex-col items-center gap-3 border-4 border-emerald-400/30">
                    <div className="bg-white/20 p-3 rounded-full">
                      <i className="fa-solid fa-check text-2xl"></i>
                    </div>
                    <span className="text-lg">আলহামদুলিল্লাহ!</span>
                    <span className="text-sm font-normal opacity-90">টার্গেট পূর্ণ হয়েছে</span>
                  </div>
               </div>
            )}

            {/* Custom Target Modal */}
            {showTargetModal && (
              <div 
                className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-slate-900 p-6 rounded-3xl w-full max-w-xs border border-slate-800 shadow-2xl">
                  <h3 className="text-white font-bold text-lg mb-6 text-center">টার্গেট পরিবর্তন করুন</h3>
                  <div className="relative mb-6">
                    <input
                      type="number"
                      value={customTargetInput}
                      onChange={(e) => setCustomTargetInput(e.target.value)}
                      className="w-full p-4 bg-slate-800 border-2 border-slate-700 rounded-2xl text-white text-center text-3xl font-mono focus:border-emerald-500 outline-none transition-colors"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">বার</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowTargetModal(false)}
                      className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                    >
                      বাতিল
                    </button>
                    <button 
                      onClick={() => {
                        const val = parseInt(customTargetInput);
                        if (!isNaN(val) && val > 0) {
                          setTasbihTarget(val);
                          setTasbihCount(0);
                          setShowTargetModal(false);
                        }
                      }}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
                    >
                      সেভ করুন
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          onClick={() => setActiveSection(AppSection.RAMADAN)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.RAMADAN ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-moon text-lg"></i>
          <span className="text-[10px] font-bold">রমাদান</span>
        </button>
        {/* Quran Removed as per request */}
        <button 
          onClick={() => setActiveSection(AppSection.DUA)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.DUA ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-hands-praying text-lg"></i>
          <span className="text-[10px] font-bold">দোয়া</span>
        </button>
        <button 
          onClick={() => setActiveSection(AppSection.TASBIH)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.TASBIH ? 'text-emerald-500' : 'text-slate-500'}`}
        >
          <i className="fa-solid fa-fingerprint text-lg"></i>
          <span className="text-[10px] font-bold">তাসবিহ</span>
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
