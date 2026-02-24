"use client";
import React from "react";

/**
 * Animated math cube icon for the Math subject card.
 * Controlled via `isOpen` — when true the glass cube shatters to reveal a quantum HUD
 * with sine waves, a parabola, a geometry core, and floating equations.
 */
export default function AnimatedMathIcon({
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
                    <linearGradient id="glassTop" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#E0F2FE" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="glassLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="glassRight" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.3} />
                    </linearGradient>

                    <filter id="hudGlowMath" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
                        <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur2" />
                        <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    <filter id="cubeShadowMath" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="18" stdDeviation="12" floodColor="#1E3A8A" floodOpacity={0.2} />
                    </filter>

                    <radialGradient id="fadeGradMath" cx="50%" cy="50%" r="50%">
                        <stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
                        <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                    </radialGradient>

                    <mask id="hudFadeMath">
                        <rect width="300" height="300" fill="url(#fadeGradMath)" />
                    </mask>
                </defs>

                <style>{`
          /* --- 1. IDLE STATE: The Detailed Glass Cube --- */
          @keyframes floatCube {
            0%, 100% { transform: translateY(0px); }
            50%      { transform: translateY(-8px); }
          }
          .idle-cube {
            transform-origin: 150px 150px;
            animation: floatCube 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          
          /* Hover Shatter Mechanics */
          .face { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
          .math-engine.active .face-top   { transform: translateY(-50px) scale(1.1); opacity: 0; }
          .math-engine.active .face-left  { transform: translate(-40px, 30px) scale(1.1); opacity: 0; }
          .math-engine.active .face-right { transform: translate(40px, 30px) scale(1.1); opacity: 0; }
          .math-engine.active .face-inner { transform: scale(0.5); opacity: 0; }
          .math-engine.active .idle-shadow { opacity: 0; transition: opacity 0.3s; }

          /* --- 2. ACTIVE STATE: The Masked Quantum HUD --- */
          .hud-container {
            opacity: 0;
            pointer-events: none;
          }
          .math-engine.active .hud-container {
            opacity: 1;
            transition: opacity 0.3s ease-in 0.1s;
          }

          /* A. The Cartesian Grid */
          .grid-axis {
            stroke: #94A3B8;
            stroke-width: 2;
            stroke-dasharray: 300;
            stroke-dashoffset: 300;
            transition: stroke-dashoffset 0.6s cubic-bezier(0.1, 0.8, 0.3, 1);
          }
          .math-engine.active .grid-axis { stroke-dashoffset: 0; transition-delay: 0.1s; }

          /* B. Trigonometry (Continuous Sine Wave perfectly masked) */
          @keyframes flowWave {
            100% { stroke-dashoffset: -150; }
          }
          .sine-wave {
            fill: none;
            stroke: #00E5FF;
            stroke-width: 4;
            stroke-linecap: round;
            stroke-dasharray: 150;
            opacity: 0;
          }
          .math-engine.active .sine-wave {
            opacity: 1;
            animation: flowWave 1.2s linear infinite;
            transition: opacity 0.3s ease 0.3s;
          }

          /* C. Calculus (Parabola Trace) */
          .parabola {
            fill: none;
            stroke: #D946EF;
            stroke-width: 4;
            stroke-linecap: round;
            stroke-dasharray: 400;
            stroke-dashoffset: 400;
            transition: stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .math-engine.active .parabola {
            stroke-dashoffset: 0;
            transition-delay: 0.3s;
          }

          /* D. The Geometry Core */
          @keyframes spinCore { 100% { transform: rotate(360deg); } }
          @keyframes spinCoreRev { 100% { transform: rotate(-360deg); } }
          @keyframes pulseCore { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
          
          .geo-core {
            transform-origin: 150px 150px;
            opacity: 0;
            transform: scale(0);
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .math-engine.active .geo-core { opacity: 1; transform: scale(1); transition-delay: 0.4s; }
          .math-engine.active .poly-1 { animation: spinCore 3s linear infinite; transform-origin: 150px 150px; }
          .math-engine.active .poly-2 { animation: spinCoreRev 4s linear infinite; transform-origin: 150px 150px; }
          .math-engine.active .core-node { animation: pulseCore 1s ease-in-out infinite; }

          /* E. Holographic Equations */
          .equation {
            font-family: 'Courier New', Courier, monospace;
            font-weight: 900;
            font-size: 18px;
            opacity: 0;
            transform-origin: center;
          }
          @keyframes strobeText {
            0%, 100% { opacity: 0.9; transform: scale(1); filter: brightness(1.2); }
            50% { opacity: 0.4; transform: scale(0.95); filter: brightness(0.8); }
          }
          
          .math-engine.active .eq-1 { opacity: 1; transition: opacity 0.3s ease 0.5s; animation: strobeText 2s infinite 0.5s; }
          .math-engine.active .eq-2 { opacity: 1; transition: opacity 0.3s ease 0.6s; animation: strobeText 2.5s infinite 0.6s; }
          .math-engine.active .eq-3 { opacity: 1; transition: opacity 0.3s ease 0.7s; animation: strobeText 1.8s infinite 0.7s; }
          .math-engine.active .eq-4 { opacity: 1; transition: opacity 0.3s ease 0.8s; animation: strobeText 2.2s infinite 0.8s; }
        `}</style>

                {/* 
          SCALED GROUP to make the icon 1.8x larger (180%) inside the 300x300 viewBox.
          Since the SVG has overflow-visible, it will bleed outside gracefully if needed.
        */}
                <g
                    className={`math-engine ${activeClass}`}
                    style={{ transform: "scale(1.8) translateY(10px)", transformOrigin: "150px 150px" }}
                >
                    <circle cx="150" cy="150" r="140" fill="transparent" />

                    <ellipse className="idle-shadow" cx="150" cy="255" rx="55" ry="8" fill="#DBEAFE" />

                    <g className="hud-container" mask="url(#hudFadeMath)">
                        <path className="grid-axis" d="M 20 150 L 280 150" />
                        <path className="grid-axis" d="M 150 20 L 150 280" />
                        <g stroke="#CBD5E1" strokeWidth="2">
                            <line x1="80" y1="145" x2="80" y2="155" />
                            <line x1="220" y1="145" x2="220" y2="155" />
                            <line x1="145" y1="80" x2="155" y2="80" />
                            <line x1="145" y1="220" x2="155" y2="220" />
                        </g>
                        <path className="sine-wave" filter="url(#hudGlowMath)" d="M -75 150 Q -37.5 70 0 150 T 75 150 T 150 150 T 225 150 T 300 150 T 375 150" />
                        <path className="parabola" filter="url(#hudGlowMath)" d="M 40 50 Q 150 290 260 50" />
                        <g className="geo-core" filter="url(#hudGlowMath)">
                            <polygon className="poly-1" points="150,110 185,130 185,170 150,190 115,170 115,130" fill="none" stroke="#FDE047" strokeWidth="3" />
                            <polygon className="poly-2" points="150,195 195,115 105,115" fill="none" stroke="#F59E0B" strokeWidth="3" />
                            <circle className="core-node" cx="150" cy="150" r="14" fill="#FFFFFF" />
                            <circle className="core-node" cx="150" cy="150" r="20" fill="none" stroke="#FDE047" strokeWidth="2" />
                        </g>
                        <g filter="url(#hudGlowMath)">
                            <text className="equation eq-1" x="50" y="90" fill="#7E22CE">∫ f(x)dx</text>
                            <text className="equation eq-2" x="190" y="70" fill="#0EA5E9">∑ n=1</text>
                            <text className="equation eq-3" x="40" y="210" fill="#E11D48">Δy/Δx</text>
                            <text className="equation eq-4" x="175" y="235" fill="#9333EA">e^(iπ)+1=0</text>
                        </g>
                    </g>

                    <g className="idle-cube" filter="url(#cubeShadowMath)">

                        <path className="face face-inner" d="M 135 125 L 165 125 L 150 145 L 165 165 L 135 165" fill="none" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />

                        <path className="face face-left" d="M 150 210 L 80 170 L 80 90 L 150 130 Z" fill="url(#glassLeft)" stroke="#E0F2FE" strokeWidth="2" strokeLinejoin="round" />

                        <path className="face face-right" d="M 150 210 L 220 170 L 220 90 L 150 130 Z" fill="url(#glassRight)" stroke="#BFDBFE" strokeWidth="2" strokeLinejoin="round" />

                        <path className="face face-top" d="M 150 50 L 220 90 L 150 130 L 80 90 Z" fill="url(#glassTop)" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />

                        <path className="face face-left" d="M 85 97 L 85 162" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                        <path className="face face-top" d="M 90 88 L 145 56" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.9" />

                        <path className="face face-inner" d="M 150 132 L 150 205" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                    </g>

                </g>
            </svg>
        </div>
    );
}
