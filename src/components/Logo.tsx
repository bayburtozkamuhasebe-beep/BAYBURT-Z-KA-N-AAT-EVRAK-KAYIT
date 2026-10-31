import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-10 w-10', size }) => {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
    >
      <defs>
        {/* Navy circle gradient */}
        <linearGradient id="circleNavy" x1="15" y1="20" x2="85" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#251e58" />
          <stop offset="100%" stopColor="#1a1542" />
        </linearGradient>

        {/* Tower and chevron vibrant blues */}
        <linearGradient id="towerBlue1" x1="42" y1="5" x2="52" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#75a5f5" />
          <stop offset="100%" stopColor="#5588e4" />
        </linearGradient>

        <linearGradient id="towerBlue2" x1="52" y1="2" x2="66" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6094ee" />
          <stop offset="100%" stopColor="#487cdb" />
        </linearGradient>

        <linearGradient id="chevronGrad" x1="50" y1="40" x2="50" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6ea0f2" />
          <stop offset="100%" stopColor="#5386e1" />
        </linearGradient>

        <filter id="crispDrop" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* 1. Dark Navy Circular Backdrop */}
      <circle cx="50" cy="65" r="40" fill="url(#circleNavy)" />

      {/* 2. Top Towers Rising Above */}
      {/* Left Tower */}
      <path
        d="M39 52V20L49 14V46L39 52Z"
        fill="url(#towerBlue1)"
      />
      <path
        d="M49 14L52 16V47L49 46V14Z"
        fill="#3f6fc4"
        opacity="0.9"
      />

      {/* Right Tower (Taller) */}
      <path
        d="M52 46V6L64 13V55L52 46Z"
        fill="url(#towerBlue2)"
      />
      <path
        d="M64 13L68 15.5V58L64 55V13Z"
        fill="#3965b5"
      />

      {/* 3. Outer Chevron Layer */}
      {/* White gap boundary */}
      <path
        d="M50 35L81 54V76L74 85L50 49L26 85L19 76V54L50 35Z"
        fill="#ffffff"
      />

      {/* Outer Blue Chevron */}
      <path
        d="M50 38L78 55V73L50 45L22 73V55L50 38Z"
        fill="url(#chevronGrad)"
      />

      {/* 4. Middle Chevron Layer */}
      {/* White divider */}
      <path
        d="M50 47L73 62V79L50 56L27 79V62L50 47Z"
        fill="#ffffff"
      />

      {/* Middle Blue Chevron */}
      <path
        d="M50 50L70 63V76L50 53L30 76V63L50 50Z"
        fill="url(#chevronGrad)"
      />

      {/* 5. Inner Core Chevron / Archway */}
      {/* White Divider */}
      <path
        d="M50 58L65 67V88L50 71L35 88V67L50 58Z"
        fill="#ffffff"
      />

      {/* Inner Central Tower / Door Pillar */}
      <path
        d="M50 62L62 70V96H38V70L50 62Z"
        fill="url(#chevronGrad)"
      />

      {/* Inner White Cutout / Arch portal */}
      <path
        d="M50 72L57 77V96H43V77L50 72Z"
        fill="#ffffff"
      />
    </svg>
  );
};
