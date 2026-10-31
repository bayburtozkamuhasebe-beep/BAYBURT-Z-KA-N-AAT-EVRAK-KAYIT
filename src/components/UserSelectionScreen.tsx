import React from 'react';
import { AmbientBackground } from './AmbientBackground';
import { Logo } from './Logo';
import {
  UserCheck,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Building2,
  Lock,
  Compass,
} from 'lucide-react';

export interface AuthorizedUser {
  id: string;
  name: string;
  initials: string;
  role: string;
  themeColor: 'ruby' | 'sapphire' | 'emerald';
  badge: string;
  glowClass: string;
  borderClass: string;
  avatarGradient: string;
  btnGradient: string;
}

export const AUTHORIZED_USERS: AuthorizedUser[] = [
  {
    id: 'hamza-kaldirim',
    name: 'Hamza Kaldırım',
    initials: 'HK',
    role: 'Şirket Yöneticisi',
    themeColor: 'ruby',
    badge: 'YÖNETİCİ',
    glowClass: 'hover:shadow-[0_0_35px_rgba(225,29,72,0.45)]',
    borderClass: 'border-rose-500/40 hover:border-rose-400 group-hover:border-rose-400',
    avatarGradient: 'from-[#7A0C1E] via-[#A8152F] to-[#E11D48] text-white',
    btnGradient: 'hover:bg-gradient-to-r hover:from-rose-950/40 hover:to-slate-900/60',
  },
  {
    id: 'murat-kaldirim',
    name: 'Murat Kaldırım',
    initials: 'MK',
    role: 'Şirket Yöneticisi',
    themeColor: 'sapphire',
    badge: 'YÖNETİCİ',
    glowClass: 'hover:shadow-[0_0_35px_rgba(59,130,246,0.45)]',
    borderClass: 'border-blue-500/40 hover:border-blue-400 group-hover:border-blue-400',
    avatarGradient: 'from-blue-900 via-blue-700 to-indigo-600 text-white',
    btnGradient: 'hover:bg-gradient-to-r hover:from-blue-950/40 hover:to-slate-900/60',
  },
  {
    id: 'emirhan-kalhan',
    name: 'Emirhan Kalhan',
    initials: 'EK',
    role: 'Yazılım ve Sistem Geliştirici',
    themeColor: 'emerald',
    badge: 'SİSTEM & YAZILIM',
    glowClass: 'hover:shadow-[0_0_35px_rgba(16,185,129,0.45)]',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400 group-hover:border-emerald-400',
    avatarGradient: 'from-emerald-900 via-teal-700 to-emerald-500 text-white',
    btnGradient: 'hover:bg-gradient-to-r hover:from-emerald-950/40 hover:to-slate-900/60',
  },
];

interface UserSelectionScreenProps {
  onSelectUser: (userName: string) => void;
}

export const UserSelectionScreen: React.FC<UserSelectionScreenProps> = ({ onSelectUser }) => {
  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* Dynamic Animated Ambient Background */}
      <AmbientBackground intensity="vibrant" />

      {/* Rotating Graphic Reticle / Compass (Architectural Blueprint Graphic) */}
      <div className="absolute w-[600px] h-[600px] sm:w-[750px] sm:h-[750px] pointer-events-none opacity-10 animate-spin-slow">
        <svg viewBox="0 0 200 200" className="w-full h-full text-rose-400">
          <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="75" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="6 4" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <line x1="100" y1="0" x2="100" y2="200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
        </svg>
      </div>

      {/* Floating Blueprint Coordinates Accent */}
      <div className="absolute top-6 left-6 hidden md:flex flex-col gap-1 text-[10px] font-mono text-slate-500 opacity-60">
        <span>SYS.LAT: 39.9208° N</span>
        <span>SYS.LNG: 32.8541° E</span>
        <span className="text-rose-400 font-bold">SECURE_GATEWAY_V3</span>
      </div>

      <div className="absolute top-6 right-6 hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-emerald-400 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>GÜVENLİ BAĞLANTI AKTİF</span>
      </div>

      {/* Main Glass Portal Container */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
        {/* Company Identity Header */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Glowing Logo Frame */}
          <div className="relative mb-4 group">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-rose-600 via-amber-500 to-blue-600 opacity-60 blur-lg group-hover:opacity-90 transition duration-500 animate-pulse" />
            <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-slate-950/90 border border-slate-700/80 p-3 shadow-2xl backdrop-blur-2xl">
              <Logo className="h-full w-full object-contain" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase flex items-center justify-center gap-2">
            <span>BAYBURT ÖZ-KA İNŞAAT</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide mt-1">
            Çek & Evrak Kayıt Yönetim Sistemi
          </p>

          {/* Glowing Badge for Entrance */}
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-rose-500/40 text-rose-300 shadow-[0_0_20px_rgba(225,29,72,0.25)] backdrop-blur-xl">
            <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">KENDİNİZİ TANITIN</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md">
            Lütfen sisteme giriş yapmak ve işlem gerçekleştirmek için yetkili profilinizi seçiniz:
          </p>
        </div>

        {/* The 3 Profile Buttons */}
        <div className="w-full flex flex-col gap-3.5 sm:gap-4">
          {AUTHORIZED_USERS.map((user, index) => {
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectUser(user.name)}
                className={`group relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border bg-slate-900/75 p-4 sm:p-5 text-left transition-all duration-300 backdrop-blur-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xl ${user.borderClass} ${user.glowClass} ${user.btnGradient}`}
              >
                {/* Subtle Inner Ambient Glow on Hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                <div className="flex items-center justify-between gap-4 relative z-10">
                  {/* Left Avatar & Info */}
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    {/* User Initials Avatar with Luminous Ring */}
                    <div
                      className={`relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${user.avatarGradient} font-black text-lg sm:text-xl tracking-wider transition-transform duration-300 group-hover:scale-105 border border-white/20`}
                    >
                      <span>{user.initials}</span>
                      {/* Active status indicator dot */}
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 border-2 border-slate-900">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        <span className="absolute h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                    </div>

                    {/* Name & Role */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-base sm:text-lg text-white group-hover:text-white transition tracking-tight">
                          {user.name}
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700">
                          {user.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">
                        {user.role}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 font-mono">
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>Sisteme Giriş Yetkisi: Aktif</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Button Arrow */}
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-800/80 group-hover:bg-[#7A0C1E] text-slate-400 group-hover:text-white border border-slate-700/80 group-hover:border-rose-500 transition-all duration-300 shadow-md">
                    <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Security Note */}
        <div className="mt-8 flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Yetkilendirilmiş Personel Giriş Kapısı</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Seçilen isim oturum boyunca evrak kayıtlarında ve sistem arayüzünde aktif kullanıcı olarak yer alacaktır.
          </p>
        </div>
      </div>
    </div>
  );
};
