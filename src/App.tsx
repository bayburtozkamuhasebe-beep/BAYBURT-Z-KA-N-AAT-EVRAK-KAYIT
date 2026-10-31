import React, { useState } from 'react';
import { TABS } from './types';
import { TabContent } from './components/TabContent';
import { Logo } from './components/Logo';
import { AmbientBackground } from './components/AmbientBackground';
import { UserSelectionScreen } from './components/UserSelectionScreen';
import { LogOut, Users } from 'lucide-react';

function getUserInitials(name: string | null): string {
  if (!name) return 'BK';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('bayburt_aktif_kullanici');
  });
  const [activeTabId, setActiveTabId] = useState<string>(TABS[0].id);

  const handleSelectUser = (name: string) => {
    setCurrentUser(name);
    localStorage.setItem('bayburt_aktif_kullanici', name);
  };

  const handleSwitchUser = () => {
    setCurrentUser(null);
    localStorage.removeItem('bayburt_aktif_kullanici');
  };

  // If user has not identified / logged in yet, show luminous entrance screen
  if (!currentUser) {
    return <UserSelectionScreen onSelectUser={handleSelectUser} />;
  }

  const activeTab = TABS.find((t) => t.id === activeTabId) || TABS[0];

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white relative">
      {/* Dynamic Ambient Background with Architectural Grid & Glowing Mesh */}
      <AmbientBackground />

      {/* Header */}
      <header className="h-16 sm:h-20 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between px-2.5 sm:px-8 shrink-0 backdrop-blur-xl sticky top-0 z-20 shadow-xl shadow-black/20 gap-2 sm:gap-3">
        {/* Brand Logo & App Name */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-lg p-1">
            <Logo className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-lg md:text-xl font-bold tracking-tight text-white uppercase truncate flex items-center gap-2">
              <span className="truncate">BAYBURT ÖZ-KA İNŞAAT</span>
            </h1>
            <p className="text-[8px] sm:text-[11px] text-slate-400 font-medium tracking-wider uppercase truncate">
              Çek ve Evrak Kayıt Sistemi
            </p>
          </div>
        </div>

        {/* Right Tools & Active User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 text-xs">
          {/* Active User Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 border border-slate-700/80 pl-1 sm:pl-1.5 pr-2 sm:pr-3 py-1 rounded-2xl shadow-lg backdrop-blur-md">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7A0C1E] to-rose-600 text-white font-black text-[11px] sm:text-xs shadow-md border border-rose-400/40 shrink-0">
              {getUserInitials(currentUser)}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white tracking-tight truncate max-w-[85px] xs:max-w-[130px] sm:max-w-none">
                  {currentUser}
                </span>
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono leading-none hidden xs:inline">
                Aktif Kullanıcı
              </span>
            </div>
          </div>

          {/* Switch User Button */}
          <button
            type="button"
            onClick={handleSwitchUser}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer shadow-md"
            title="Kullanıcı Değiştir / Çıkış Yap"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">Kullanıcı Değiştir</span>
          </button>

          {/* SUPABASE BAĞLI GÖSTERGE */}
          <span className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-semibold backdrop-blur-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>SUPABASE</span> BAĞLI
          </span>
        </div>
      </header>

      {/* Navigation Tab Strip */}
      <nav className="flex border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl overflow-x-auto scrollbar-none shrink-0 sticky top-16 sm:top-20 z-10" aria-label="Şantiye ve Bölge Sekmeleri">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              type="button"
              className={`flex-1 min-w-[95px] sm:min-w-[120px] py-3 sm:py-4 text-xs sm:text-sm font-semibold border-b-2 transition-all text-center tracking-wide uppercase whitespace-nowrap px-3 ${
                isActive
                  ? 'border-rose-500 bg-rose-500/10 text-rose-300 font-bold shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              {tab.name}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-3 sm:p-6 md:p-8 flex flex-col">
        <TabContent key={activeTab.id} tab={activeTab} currentUser={currentUser} />
      </main>

      {/* Immersive Footer */}
      <footer className="py-4 bg-slate-950/70 backdrop-blur-md px-4 sm:px-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-medium shrink-0 gap-2">
        <span className="text-slate-400 font-medium tracking-wide">
          Yazılım ve Tasarım : <span className="text-slate-200 font-semibold">Emirhan KALHAN</span>
        </span>
        <span className="text-[10px] text-slate-600 tracking-wider font-mono">
          &copy; {new Date().getFullYear()} BAYBURT ÖZ-KA İNŞAAT
        </span>
      </footer>
    </div>
  );
}
