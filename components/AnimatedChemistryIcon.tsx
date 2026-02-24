"use client";
import React from "react";

/**
 * Animated chemistry flask icon for the Chemistry subject card.
 * Controlled via `isOpen` — when true the test tube pours green liquid into the flask,
 * creating a magenta reaction and an eruption of fire.
 */
export default function AnimatedChemistryIcon({
  size = "40px",
  isOpen = false,
}: {
  size?: string;
  isOpen?: boolean;
}) {
  const activeClass = isOpen ? "active" : "";

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 300 300"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id="glassBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="liquidCyan" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          <linearGradient id="liquidMagenta" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D946EF" />
            <stop offset="100%" stopColor="#7E22CE" />
          </linearGradient>
          <linearGradient id="liquidGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>

          <filter id="glassShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.15" />
          </filter>

          <filter id="fireGlowChem" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <clipPath id="flaskClip">
            <path d="M 135 150 L 165 150 L 165 180 L 210 240 C 220 255, 80 255, 90 240 L 135 180 Z" />
          </clipPath>
          <clipPath id="tubeClip">
            <path d="M 175 45 L 205 45 L 205 110 C 205 125, 175 125, 175 110 Z" />
          </clipPath>
        </defs>

        <style>{`
          /* --- 1. IDLE STATE: Floating Tube --- */
          @keyframes floatTube {
            0%, 100% { transform: translateY(0px) rotate(-15deg); }
            50%      { transform: translateY(-6px) rotate(-18deg); }
          }
          .test-tube-rig {
            transform-origin: 190px 45px;
            animation: floatTube 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          /* --- 2. SEQUENCE: The Accurate Pour --- */
          .premium-chem.active .test-tube-rig {
            animation: none;
            transform: translate(-35px, 65px) rotate(-110deg);
          }
          
          @keyframes drainTube {
            0%   { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-65px); opacity: 0; }
          }
          .premium-chem.active .tube-liquid-level {
            animation: drainTube 0.6s ease-in forwards;
            animation-delay: 0.15s;
          }

          @keyframes chemicalStream {
            0%   { transform: scaleY(0); opacity: 0; }
            20%  { transform: scaleY(1); opacity: 1; }
            80%  { transform: scaleY(1); opacity: 1; }
            100% { transform: scaleY(0); opacity: 0; transform-origin: 150px 200px; }
          }
          .pour-stream {
            transform-origin: 150px 110px;
            transform: scaleY(0);
            opacity: 0;
          }
          .premium-chem.active .pour-stream {
            animation: chemicalStream 0.7s ease-in-out forwards;
            animation-delay: 0.25s;
          }

          /* --- 3. SEQUENCE: The Chemical Reaction --- */
          .flask-liquid-cyan { opacity: 1; transition: opacity 0.4s ease; }
          .flask-liquid-magenta { opacity: 0; transition: opacity 0.4s ease; }
          
          .premium-chem.active .flask-liquid-cyan { opacity: 0; transition-delay: 0.65s; }
          .premium-chem.active .flask-liquid-magenta { opacity: 1; transition-delay: 0.65s; }

          /* --- 4. SEQUENCE: The Light-Mode Fire Eruption --- */
          .fire-layer {
            transform-origin: 150px 140px;
            transform: scale(0);
            opacity: 0;
            transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          
          .premium-chem.active .fire-outer { transform: scale(1); opacity: 0.9; transition-delay: 0.7s; }
          .premium-chem.active .fire-mid   { transform: scale(1); opacity: 1;   transition-delay: 0.75s; }
          .premium-chem.active .fire-core  { transform: scale(1); opacity: 1;   transition-delay: 0.8s; }

          @keyframes roar {
            0%, 100% { transform: scale(1) skew(0deg); }
            50%      { transform: scale(1.05) skew(-2deg) translateY(-2px); }
          }
          .premium-chem.active .fire-group {
            animation: roar 1.5s ease-in-out infinite;
            animation-delay: 1.2s;
          }

          /* --- 5. EFFECTS: Shooting Embers --- */
          .ember {
            opacity: 0;
            transform-origin: center;
          }
          @keyframes shootEmber {
            0%   { transform: translateY(0) scale(0); opacity: 0; }
            20%  { opacity: 1; }
            100% { transform: translateY(-80px) translateX(var(--tx)) scale(1.5) rotate(45deg); opacity: 0; }
          }
          .premium-chem.active .e1 { animation: shootEmber 1s cubic-bezier(0.1,0.8,0.3,1) infinite; animation-delay: 0.9s; --tx: -30px; }
          .premium-chem.active .e2 { animation: shootEmber 1.2s cubic-bezier(0.1,0.8,0.3,1) infinite; animation-delay: 1.1s; --tx: 40px; }
          .premium-chem.active .e3 { animation: shootEmber 0.9s cubic-bezier(0.1,0.8,0.3,1) infinite; animation-delay: 1.3s; --tx: 10px; }
        `}</style>

        {/* 
          SCALED GROUP to make the icon 1.8x larger (180%) inside the 300x300 viewBox.
          Since the SVG has overflow-visible, it will bleed outside gracefully if needed,
          but will appear much larger as requested.
        */}
        <g
          className={`premium-chem ${activeClass}`}
          style={{ transform: "scale(1.8) translateY(10px)", transformOrigin: "150px 150px" }}
        >
          <circle cx="150" cy="150" r="140" fill="transparent" />

          <ellipse cx="150" cy="245" rx="55" ry="8" fill="#E2E8F0" />

          <g className="fire-group">
            <path className="fire-layer fire-outer" d="M 150 140 C 180 140, 220 90, 200 40 C 180 80, 190 80, 150 20 C 110 80, 120 80, 100 40 C 80 90, 120 140, 150 140 Z" fill="#9333EA" filter="url(#fireGlowChem)" />
            <path className="fire-layer fire-mid" d="M 150 140 C 170 140, 190 100, 180 60 C 165 90, 170 90, 150 40 C 130 90, 135 90, 120 60 C 110 100, 130 140, 150 140 Z" fill="#0EA5E9" />
            <path className="fire-layer fire-core" d="M 150 140 C 160 140, 175 110, 165 80 C 155 100, 160 100, 150 60 C 140 100, 145 100, 135 80 C 125 110, 140 140, 150 140 Z" fill="#FDE047" />
          </g>

          <rect className="ember e1" x="145" y="110" width="8" height="8" fill="#0EA5E9" />
          <rect className="ember e2" x="155" y="100" width="6" height="6" fill="#D946EF" />
          <rect className="ember e3" x="140" y="120" width="10" height="10" fill="#F59E0B" />

          <g className="flask-rig" filter="url(#glassShadow)">
            <path d="M 135 150 L 165 150 L 165 180 L 210 240 C 220 255, 80 255, 90 240 L 135 180 Z" fill="#CBD5E1" opacity="0.4" />

            <g clipPath="url(#flaskClip)">
              <rect className="flask-liquid-cyan" x="60" y="200" width="180" height="60" fill="url(#liquidCyan)" />
              <ellipse className="flask-liquid-cyan" cx="150" cy="200" rx="42" ry="6" fill="#0E7490" />

              <rect className="flask-liquid-magenta" x="60" y="190" width="180" height="80" fill="url(#liquidMagenta)" />
              <ellipse className="flask-liquid-magenta" cx="150" cy="190" rx="35" ry="6" fill="#7E22CE" />
            </g>

            <path d="M 135 150 L 165 150 L 165 180 L 210 240 C 220 255, 80 255, 90 240 L 135 180 Z" fill="url(#glassBody)" stroke="#94A3B8" strokeWidth="3" strokeLinejoin="round" />

            <path d="M 98 230 L 138 175 L 138 152" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.8" />

            <rect x="125" y="140" width="50" height="12" rx="6" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
            <path d="M 130 143 L 170 143" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          </g>

          <rect className="pour-stream" x="146" y="110" width="8" height="85" fill="#16A34A" rx="4" />

          <g className="test-tube-rig" filter="url(#glassShadow)">
            <path d="M 175 45 L 205 45 L 205 110 C 205 125, 175 125, 175 110 Z" fill="#CBD5E1" opacity="0.4" />

            <g clipPath="url(#tubeClip)">
              <g className="tube-liquid-level">
                <rect x="160" y="70" width="60" height="70" fill="url(#liquidGreen)" />
                <ellipse cx="190" cy="70" rx="15" ry="4" fill="#15803D" />
              </g>
            </g>

            <path d="M 175 45 L 205 45 L 205 110 C 205 125, 175 125, 175 110 Z" fill="url(#glassBody)" stroke="#94A3B8" strokeWidth="3" />
            <path d="M 181 52 L 181 108" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.8" />

            <rect x="170" y="38" width="40" height="10" rx="4" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
            <path d="M 175 41 L 205 41" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          </g>

        </g>
      </svg>
    </div>
  );
}
