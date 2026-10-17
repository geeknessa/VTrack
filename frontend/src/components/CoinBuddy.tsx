import React from 'react';

export type CoinBuddyMood = 'happy' | 'counting' | 'celebrating' | 'worried' | 'sleepy' | 'waving';

interface CoinBuddyProps {
  mood?: CoinBuddyMood;
  size?: number;
  className?: string;
  speech?: string;
}

export const CoinBuddy: React.FC<CoinBuddyProps> = ({
  mood = 'happy',
  size = 80,
  className = '',
  speech,
}) => {
  // Render distinct SVG facial expressions and accessories based on mood
  const renderFace = () => {
    switch (mood) {
      case 'happy':
        return (
          <>
            {/* Eyes */}
            <circle cx="36" cy="42" r="3.5" fill="#2A1E24" />
            <circle cx="64" cy="42" r="3.5" fill="#2A1E24" />
            {/* Rosy Cheeks */}
            <circle cx="28" cy="48" r="4.5" fill="#F497B6" opacity="0.8" />
            <circle cx="72" cy="48" r="4.5" fill="#F497B6" opacity="0.8" />
            {/* Mouth */}
            <path d="M 40 52 Q 50 60 60 52" fill="none" stroke="#2A1E24" strokeWidth="3" strokeLinecap="round" />
          </>
        );

      case 'counting':
        return (
          <>
            {/* Eyes focused down */}
            <ellipse cx="36" cy="42" rx="3.5" ry="2" fill="#2A1E24" />
            <ellipse cx="64" cy="42" rx="3.5" ry="2" fill="#2A1E24" />
            {/* Rosy Cheeks */}
            <circle cx="28" cy="48" r="4.5" fill="#F497B6" opacity="0.8" />
            <circle cx="72" cy="48" r="4.5" fill="#F497B6" opacity="0.8" />
            {/* Mouth */}
            <ellipse cx="50" cy="54" rx="4" ry="5" fill="#2A1E24" />
            {/* Tiny Notebook in hand */}
            <rect x="62" y="55" width="18" height="22" rx="2" fill="#FFFFFF" stroke="#2A1E24" strokeWidth="2" />
            <line x1="66" y1="60" x2="74" y2="60" stroke="#E60067" strokeWidth="1.5" />
            <line x1="66" y1="65" x2="74" y2="65" stroke="#2A1E24" strokeWidth="1.5" />
            <line x1="66" y1="70" x2="72" y2="70" stroke="#2A1E24" strokeWidth="1.5" />
          </>
        );

      case 'celebrating':
        return (
          <>
            {/* Happy Arch Eyes */}
            <path d="M 32 44 Q 36 38 40 44" fill="none" stroke="#2A1E24" strokeWidth="3" strokeLinecap="round" />
            <path d="M 60 44 Q 64 38 68 44" fill="none" stroke="#2A1E24" strokeWidth="3" strokeLinecap="round" />
            {/* Rosy Cheeks */}
            <circle cx="26" cy="48" r="5" fill="#F497B6" />
            <circle cx="74" cy="48" r="5" fill="#F497B6" />
            {/* Big Joyful Open Mouth */}
            <path d="M 38 52 Q 50 66 62 52 Z" fill="#E60067" stroke="#2A1E24" strokeWidth="2" />
            {/* Sparkles overhead */}
            <path d="M 20 20 L 23 25 L 28 26 L 23 27 L 20 32 L 17 27 L 12 26 L 17 25 Z" fill="#FFC107" />
            <path d="M 75 16 L 77 20 L 81 21 L 77 22 L 75 26 L 73 22 L 69 21 L 73 20 Z" fill="#FFC107" />
          </>
        );

      case 'worried':
        return (
          <>
            {/* Wide Worried Eyes */}
            <circle cx="36" cy="42" r="4.5" fill="#2A1E24" />
            <circle cx="37" cy="41" r="1.5" fill="#FFFFFF" />
            <circle cx="64" cy="42" r="4.5" fill="#2A1E24" />
            <circle cx="65" cy="41" r="1.5" fill="#FFFFFF" />
            {/* Worried Brows */}
            <line x1="30" y1="33" x2="40" y2="36" stroke="#2A1E24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="70" y1="33" x2="60" y2="36" stroke="#2A1E24" strokeWidth="2.5" strokeLinecap="round" />
            {/* Wavy Mouth */}
            <path d="M 38 56 Q 44 50 50 56 T 62 56" fill="none" stroke="#2A1E24" strokeWidth="2.5" strokeLinecap="round" />
            {/* Sweat Drop */}
            <path d="M 72 30 C 72 26 77 26 77 30 C 77 33 72 35 72 30 Z" fill="#29B6F6" />
          </>
        );

      case 'sleepy':
        return (
          <>
            {/* Sleeping Eye Slits */}
            <path d="M 32 43 Q 36 47 40 43" fill="none" stroke="#2A1E24" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 60 43 Q 64 47 68 43" fill="none" stroke="#2A1E24" strokeWidth="2.5" strokeLinecap="round" />
            {/* Soft Mouth */}
            <ellipse cx="50" cy="53" rx="3" ry="3" fill="#2A1E24" />
            {/* Zzz floating */}
            <text x="70" y="25" fontSize="14" fontWeight="bold" fill="#6E5D67">Z</text>
            <text x="78" y="16" fontSize="11" fontWeight="bold" fill="#6E5D67">z</text>
          </>
        );

      case 'waving':
      default:
        return (
          <>
            {/* Winking/Waving Eyes */}
            <circle cx="36" cy="42" r="3.5" fill="#2A1E24" />
            <path d="M 60 42 Q 64 38 68 42" fill="none" stroke="#2A1E24" strokeWidth="3" strokeLinecap="round" />
            {/* Cheeks */}
            <circle cx="28" cy="48" r="4.5" fill="#F497B6" opacity="0.8" />
            <circle cx="72" cy="48" r="4.5" fill="#F497B6" opacity="0.8" />
            {/* Big Smile */}
            <path d="M 38 51 Q 50 62 62 51" fill="none" stroke="#2A1E24" strokeWidth="3" strokeLinecap="round" />
            {/* Waving Hand */}
            <path d="M 78 50 Q 88 40 85 30" fill="none" stroke="#FFB74D" strokeWidth="4" strokeLinecap="round" />
            <circle cx="85" cy="30" r="4" fill="#FFB74D" />
          </>
        );
    }
  };

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      {speech && (
        <div className="mb-2 max-w-[200px] rounded-xl border border-[var(--color-border)] bg-white p-2.5 text-center text-xs font-semibold text-[var(--color-text-main)] shadow-sm relative">
          {speech}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-8 border-t-white" />
        </div>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-200 hover:scale-105"
      >
        {/* Outer Coin Body */}
        <circle cx="50" cy="50" r="44" fill="#FFC107" stroke="#2A1E24" strokeWidth="3.5" />
        {/* Inner Stamped Ring */}
        <circle cx="50" cy="50" r="37" fill="#FFCA28" stroke="#F57F17" strokeWidth="2" strokeDasharray="4 2" />
        {/* Currency Symbol Stamp on Top Header */}
        <text x="50" y="25" textAnchor="middle" fontSize="12" fontWeight="800" fill="#B78103">₦</text>
        {/* Facial Expression & Extras */}
        {renderFace()}
      </svg>
    </div>
  );
};
