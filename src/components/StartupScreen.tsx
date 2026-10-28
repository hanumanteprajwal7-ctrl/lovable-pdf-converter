import React, { useEffect, useState } from 'react';

export const StartupScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Brief graceful load
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(onComplete, 400);
    }, 600);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-400 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center text-center px-4 max-w-sm">
        {/* Animated Brand Emblem */}
        <div className="relative w-16 h-16 rounded-2xl bg-[#00288e] flex items-center justify-center text-white shadow-xl shadow-blue-900/10 mb-6">
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
          <div className="absolute -inset-1 rounded-2xl border border-blue-400/30 animate-pulse pointer-events-none" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
          Lovable PDF Converter
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 font-medium">
          Your Documents, Simplified.
        </p>

        {/* Subtle Loading Track */}
        <div className="w-36 h-1 bg-slate-100 rounded-full mt-6 overflow-hidden">
          <div className="h-full bg-[#00288e] rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
};
