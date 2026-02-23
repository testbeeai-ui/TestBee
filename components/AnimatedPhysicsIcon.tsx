"use client";
import React from "react";

/**
 * Animated electricity/plasma icon for the Physics subject card.
 * Controlled via `isOpen` — when true the lightning idle state disappears
 * and the active plasma engine powers up with magnetic rings and erratic arcs.
 */
export default function AnimatedPhysicsIcon({
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
                viewBox="60 40 180 230"
                className="w-full h-full overflow-visible"
            >
                <defs>
                    <linearGradient id="physIdleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FF8C00" />
                        <stop offset="100%" stopColor="#EF4444" />
                    </linearGradient>

                    <linearGradient id="physActivePlasmaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#7E22CE" />
                        <stop offset="50%" stopColor="#D946EF" />
                        <stop offset="100%" stopColor="#E11D48" />
                    </linearGradient>

                    <linearGradient id="physActiveCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FDE047" />
                        <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>

                    <filter id="physPlasmaBurn" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#9333EA" floodOpacity="0.8" />
                        <feDropShadow dx="0" dy="0" stdDeviation="15" floodColor="#E11D48" floodOpacity="0.4" />
                    </filter>
                </defs>

                <style>{`
          /* --- IDLE PHYSICS (Potential Energy) --- */
          @keyframes physLevitateHeavy {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          .phys-idle-bolt {
            transform-origin: 150px 150px;
            animation: physLevitateHeavy 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            transition: opacity 0.15s ease;
          }

          /* --- ACTIVE PHYSICS (Kinetic Discharge) --- */
          .phys-active-engine {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease;
          }
          
          .phys-container.active .phys-idle-bolt { opacity: 0; }
          .phys-container.active .phys-active-engine { opacity: 1; pointer-events: auto; }

          /* 1. Core Jitter (Raw Unstable Electricity) */
          @keyframes physElectricJitter {
            0% { transform: translate(0, 0) scale(1.1) skew(0deg); }
            10% { transform: translate(-3px, 2px) scale(1.15) skew(-2deg); }
            20% { transform: translate(4px, -3px) scale(1.05) skew(3deg); }
            30% { transform: translate(-2px, 4px) scale(1.2) skew(-4deg); }
            40% { transform: translate(3px, -2px) scale(1.1) skew(2deg); }
            50% { transform: translate(-4px, -4px) scale(1.15) skew(-3deg); }
            60% { transform: translate(2px, 3px) scale(1.08) skew(1deg); }
            70% { transform: translate(-3px, -2px) scale(1.18) skew(-2deg); }
            80% { transform: translate(4px, 4px) scale(1.1) skew(3deg); }
            90% { transform: translate(-2px, -3px) scale(1.12) skew(-1deg); }
            100% { transform: translate(0, 0) scale(1.1) skew(0deg); }
          }
          .phys-core-bolt {
            transform-origin: 150px 150px;
          }
          .phys-container.active .phys-core-bolt {
            animation: physElectricJitter 0.1s infinite alternate;
          }

          /* 2. Magnetic Flux Rings (Physics Containment) */
          @keyframes physSpinFlux {
            0% { transform: rotate(0deg) scale(0.8); opacity: 0; stroke-width: 1; }
            10% { opacity: 0.9; stroke-width: 4; }
            50% { transform: rotate(180deg) scale(1.4); opacity: 0.4; stroke-width: 1.5; }
            100% { transform: rotate(360deg) scale(1.8); opacity: 0; stroke-width: 0.1; }
          }
          .phys-flux-ring {
            fill: none;
            transform-origin: 150px 150px;
          }
          .phys-container.active .phys-flux-1 { animation: physSpinFlux 1s cubic-bezier(0.1, 0.8, 0.3, 1) infinite; stroke: #7E22CE; stroke-dasharray: 10 20 40 10; }
          .phys-container.active .phys-flux-2 { animation: physSpinFlux 1.5s cubic-bezier(0.1, 0.8, 0.3, 1) infinite reverse; animation-delay: 0.2s; stroke: #EA580C; stroke-dasharray: 5 30 15 5; }

          /* 3. Erratic Plasma Branches (Fractal Electricity) */
          @keyframes physStrobeArc {
            0%, 10% { opacity: 0; transform: scale(0.8) translate(0,0); }
            12%, 18% { opacity: 1; transform: scale(1.2) translate(var(--tx), var(--ty)); filter: brightness(1.1); }
            20%, 100% { opacity: 0; transform: scale(0.9) translate(calc(var(--tx)*0.5), calc(var(--ty)*0.5)); }
          }
          
          .phys-arc {
            fill: none;
            strokeLinecap: round;
            strokeLinejoin: round;
            transform-origin: 150px 150px;
            opacity: 0;
          }

          .phys-container.active .phys-arc-a { animation: physStrobeArc 0.3s infinite; --tx: -20px; --ty: -10px; stroke-width: 4; stroke: #9333EA; }
          .phys-container.active .phys-arc-b { animation: physStrobeArc 0.45s infinite 0.1s; --tx: 30px; --ty: 15px; stroke-width: 3; stroke: #D97706; }
          .phys-container.active .phys-arc-c { animation: physStrobeArc 0.25s infinite 0.05s; --tx: -15px; --ty: 35px; stroke-width: 3; stroke: #0284C7; }
          .phys-container.active .phys-arc-d { animation: physStrobeArc 0.5s infinite 0.2s; --tx: 25px; --ty: -25px; stroke-width: 5; stroke: #E11D48; }
          .phys-container.active .phys-arc-e { animation: physStrobeArc 0.35s infinite 0.15s; --tx: 0px; --ty: -40px; stroke-width: 2; stroke: #2563EB; }
        `}</style>

                <g className={`phys-container ${activeClass}`}>
                    <circle cx="150" cy="150" r="140" fill="transparent" />

                    {/* Optional bottom shadow/glow if needed
          <ellipse cx="150" cy="260" rx="40" ry="6" fill="#E2E8F0" opacity="0.8" />
          */}

                    <g className="phys-active-engine">
                        <circle className="phys-flux-ring phys-flux-1" cx="150" cy="150" r="50" />
                        <circle className="phys-flux-ring phys-flux-2" cx="150" cy="150" r="70" />

                        <g className="phys-core-bolt">
                            <path className="phys-arc phys-arc-a" d="M 150 150 L 110 130 L 90 140 L 70 110" />
                            <path className="phys-arc phys-arc-b" d="M 150 150 L 190 160 L 210 140 L 240 170" />
                            <path className="phys-arc phys-arc-c" d="M 150 150 L 130 190 L 140 210 L 110 230" />
                            <path className="phys-arc phys-arc-d" d="M 150 150 L 180 110 L 170 90 L 210 60" />
                            <path className="phys-arc phys-arc-e" d="M 150 150 L 140 110 L 160 80 L 145 50" />

                            <path d="M 160 50 L 90 150 L 140 150 L 110 250 L 200 130 L 150 130 Z" fill="url(#physActivePlasmaGrad)" filter="url(#physPlasmaBurn)" />
                            <path d="M 155 70 L 105 150 L 140 150 L 120 220 L 180 130 L 145 130 Z" fill="url(#physActiveCoreGrad)" />
                        </g>
                    </g>

                    <g className="phys-idle-bolt">
                        <path d="M 160 50 L 90 150 L 140 150 L 110 250 L 200 130 L 150 130 Z" fill="url(#physIdleGrad)" filter="drop-shadow(0px 10px 15px rgba(220, 38, 38, 0.2))" />
                    </g>
                </g>
            </svg>
        </div>
    );
}
