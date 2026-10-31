import React from 'react';

export const AmbientBackground: React.FC<{ intensity?: 'normal' | 'vibrant' }> = ({
  intensity = 'normal',
}) => {
  const isVibrant = intensity === 'vibrant';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none">
      {/* 1. Deep Midnight Base Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030611] via-[#050a18] to-[#02040a]" />

      {/* 2. Primary Bordo / Ruby Ambient Glow (Animated Float & Pulse) */}
      <div
        className={`absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full bg-[#7A0C1E]/${
          isVibrant ? '45' : '30'
        } blur-[140px] animate-float-orb-1`}
      />

      {/* 3. Deep Royal Indigo / Sapphire Glow (Animated Float & Pulse) */}
      <div
        className={`absolute -top-40 -right-24 w-[750px] h-[750px] rounded-full bg-blue-700/${
          isVibrant ? '35' : '22'
        } blur-[150px] animate-float-orb-2`}
      />

      {/* 4. Center Radiant Aura (Subtle Emerald/Teal Financial Accent) */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[850px] h-[500px] rounded-full bg-emerald-700/${
          isVibrant ? '25' : '15'
        } blur-[160px] animate-float-orb-3`}
      />

      {/* 5. Center Bordo Atmosphere Orb */}
      <div
        className={`absolute top-2/3 -left-20 w-[600px] h-[550px] rounded-full bg-[#7A0C1E]/${
          isVibrant ? '30' : '18'
        } blur-[150px] animate-float-orb-2`}
      />

      {/* 6. Bottom Cyan / Midnight Foundation Light */}
      <div
        className="absolute -bottom-40 right-1/4 w-[750px] h-[550px] rounded-full bg-cyan-900/20 blur-[180px] animate-float-orb-1"
      />

      {/* 7. Animated Drifting High-Tech Architectural Blueprint Grid */}
      <div
        className="absolute inset-0 opacity-[0.16] animate-grid-drift"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 90% 75% at 50% 35%, black 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 75% at 50% 35%, black 30%, transparent 85%)',
        }}
      />

      {/* 8. Fine Engineering Dot Matrix */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 25%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 25%, transparent 80%)',
        }}
      />

      {/* 9. Animated Graphic Laser Scan Beam */}
      <div className="absolute inset-x-0 top-0 h-40 pointer-events-none opacity-40 animate-laser-scan">
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500/80 via-cyan-400/80 to-transparent shadow-[0_0_20px_rgba(244,63,94,0.9)]" />
        <div className="w-full h-full bg-gradient-to-b from-rose-500/10 via-rose-500/0 to-transparent" />
      </div>

      {/* 10. Top Edge Luminous Horizon Line */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-rose-500/60 via-blue-400/60 to-transparent" />
    </div>
  );
};
