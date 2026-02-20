
import React, { useState, useEffect } from 'react';
import { AppSection, PrayerTimes } from './types';
import { ESSENTIAL_DUAS, SAMPLE_QURAN } from './constants';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.PRAYER);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [city, setCity] = useState<string>(() => localStorage.getItem('userCity') || 'Dhaka');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => localStorage.getItem('notifications') === 'true');

  useEffect(() => {
    fetchPrayerTimes();
    const interval = setInterval(checkNotification, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [city]);

  const fetchPrayerTimes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Bangladesh&method=2`);
      const data = await response.json();
      if (data.code === 200) {
        setPrayerTimes(data.data.timings);
      }
    } catch (error) {
      console.error("Error fetching prayer times:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkNotification = () => {
    if (!notificationsEnabled || !prayerTimes) return;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const times = [
      { name: 'ফজর', time: prayerTimes.Fajr },
      { name: 'যোহর', time: prayerTimes.Dhuhr },
      { name: 'আসর', time: prayerTimes.Asr },
      { name: 'মাগরিব', time: prayerTimes.Maghrib },
      { name: 'এশা', time: prayerTimes.Isha },
    ];

    const match = times.find(t => t.time === currentTime);
    if (match) {
      new Notification(`${match.name} নামাজের সময় হয়েছে`, {
        body: `আজকের ${match.name} নামাজের সময় শুরু হয়েছে (${match.time})`,
        icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png'
      });
    }
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

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-50 shadow-xl relative overflow-hidden">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold">ইসলামিক অ্যাপ</h1>
          <button onClick={() => setActiveSection(AppSection.SETTINGS)} className="text-xl">
            <i className="fa-solid fa-gear"></i>
          </button>
        </div>
        <p className="text-emerald-100 text-sm opacity-90">
          {new Date().toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-5 overflow-y-auto pb-24">
        {activeSection === AppSection.PRAYER && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-clock text-emerald-600"></i> নামাজের সময়সূচি
            </h2>
            {loading ? (
              <div className="flex justify-center p-10"><i className="fas fa-spinner fa-spin text-3xl text-emerald-500"></i></div>
            ) : prayerTimes && (
              <div className="grid gap-3">
                {[
                  { name: 'ফজর', time: prayerTimes.Fajr, icon: 'fa-sun' },
                  { name: 'সূর্যোদয়', time: prayerTimes.Sunrise, icon: 'fa-mountain-sun' },
                  { name: 'যোহর', time: prayerTimes.Dhuhr, icon: 'fa-sun' },
                  { name: 'আসর', time: prayerTimes.Asr, icon: 'fa-cloud-sun' },
                  { name: 'মাগরিব', time: prayerTimes.Maghrib, icon: 'fa-moon' },
                  { name: 'এশা', time: prayerTimes.Isha, icon: 'fa-stars' },
                ].map((p, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                         <i className={`fa-solid ${p.icon}`}></i>
                      </div>
                      <span className="font-medium text-slate-700">{p.name}</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{p.time}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-center mt-4 text-slate-400">অবস্থান: {city} (বাংলাদেশ)</p>
          </div>
        )}

        {activeSection === AppSection.QURAN && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-book-quran text-emerald-600"></i> কুরআন মজীদ
            </h2>
            <div className="grid gap-6">
              {SAMPLE_QURAN.map((v) => (
                <div key={v.id} className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-emerald-500">
                  <p className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">{v.surah}</p>
                  <p className="text-right text-2xl font-arabic mb-4 text-slate-800 leading-relaxed" dir="rtl">
                    {v.arabic}
                  </p>
                  <p className="text-sm text-slate-500 italic mb-2">"{v.pronunciation}"</p>
                  <p className="text-slate-700 leading-snug">{v.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === AppSection.DUA && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-hands-praying text-emerald-600"></i> প্রয়োজনীয় দোয়া
            </h2>
            <div className="grid gap-4">
              {ESSENTIAL_DUAS.map((d) => (
                <div key={d.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg text-emerald-700 mb-3">{d.title}</h3>
                  <p className="text-right text-xl mb-3 text-slate-800 font-arabic" dir="rtl">{d.arabic}</p>
                  <p className="text-sm text-slate-500 italic mb-2">{d.pronunciation}</p>
                  <p className="text-slate-700 text-sm border-t pt-2 border-slate-50">{d.meaning}</p>
                  {d.reference && <p className="text-[10px] text-right mt-2 text-slate-400">সূত্র: {d.reference}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === AppSection.SETTINGS && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4">সেটিংস</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">আপনার শহর</label>
                <input 
                  type="text" 
                  value={city}
                  onChange={handleCityChange}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="যেমন: Dhaka"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-700">নামাজের নোটিফিকেশন</h4>
                  <p className="text-xs text-slate-400">নামাজের সময় হলে বার্তা দিবে</p>
                </div>
                <button 
                  onClick={toggleNotifications}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
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
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 flex justify-around p-3 pb-6 z-50 rounded-t-3xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveSection(AppSection.PRAYER)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.PRAYER ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <i className="fa-solid fa-clock text-lg"></i>
          <span className="text-[10px] font-bold">নামাজ</span>
        </button>
        <button 
          onClick={() => setActiveSection(AppSection.QURAN)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.QURAN ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <i className="fa-solid fa-book-quran text-lg"></i>
          <span className="text-[10px] font-bold">কুরআন</span>
        </button>
        <button 
          onClick={() => setActiveSection(AppSection.DUA)}
          className={`flex flex-col items-center gap-1 transition-colors ${activeSection === AppSection.DUA ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <i className="fa-solid fa-hands-praying text-lg"></i>
          <span className="text-[10px] font-bold">দোয়া</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
