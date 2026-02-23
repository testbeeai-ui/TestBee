"use client";
import React from "react";

/**
 * Animated biology DNA icon for the Biology subject card.
 * Controlled via `isOpen` — when true a holographic AI scanner activates
 * and runs down the DNA sequence.
 */
export default function AnimatedBiologyIcon({
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
                    <linearGradient id="backboneGradBio" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#334155" />
                        <stop offset="50%" stopColor="#64748B" />
                        <stop offset="100%" stopColor="#1E293B" />
                    </linearGradient>

                    <linearGradient id="pairRedBio" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#EF4444" />
                        <stop offset="100%" stopColor="#B91C1C" />
                    </linearGradient>
                    <linearGradient id="pairBlueBio" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#1D4ED8" />
                    </linearGradient>

                    <linearGradient id="scanBeamGradBio" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
                        <stop offset="50%" stopColor="#00E5FF" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
                    </linearGradient>

                    <filter id="screenGlowBio" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    <clipPath id="screenClipBio">
                        <rect x="50" y="50" width="200" height="200" rx="10" />
                    </clipPath>

                    <clipPath id="textScrollClipBio">
                        <rect x="200" y="80" width="50" height="130" />
                    </clipPath>
                </defs>

                <style>{`
          /* --- 1. IDLE STATE: The Molecular Model --- */
          @keyframes slowBobBio {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
          .dna-structure {
            transform-origin: 150px 150px;
            animation: slowBobBio 4s ease-in-out infinite;
          }
          .base-rung {
            stroke-width: 7;
            stroke-linecap: round;
            transition: all 0.3s ease;
          }

          /* --- 2. ACTIVE HOVER: The AI Scan --- */
          
          /* Top-to-Bottom Scanner Bar */
          .scanner-bar {
            opacity: 0;
            transform: translateY(40px);
          }
          @keyframes topDownScanBio {
            0%   { transform: translateY(40px); opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 1; }
            100% { transform: translateY(260px); opacity: 0; }
          }
          .biology-engine.active .scanner-bar {
            animation: topDownScanBio 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }

          /* Base Pairs highlighting as the scanner hits them */
          @keyframes rungHighlightBio {
            0%, 100% { filter: none; stroke-width: 7; }
            50% { filter: url(#screenGlowBio); stroke: #00E5FF; stroke-width: 9; }
          }
          /* Timed delays for sequential lighting */
          .biology-engine.active .rung-1 { animation: rungHighlightBio 2s infinite; animation-delay: 0.2s; }
          .biology-engine.active .rung-2 { animation: rungHighlightBio 2s infinite; animation-delay: 0.5s; }
          .biology-engine.active .rung-3 { animation: rungHighlightBio 2s infinite; animation-delay: 0.8s; }
          .biology-engine.active .rung-4 { animation: rungHighlightBio 2s infinite; animation-delay: 1.1s; }
          .biology-engine.active .rung-5 { animation: rungHighlightBio 2s infinite; animation-delay: 1.4s; }
          .biology-engine.active .rung-6 { animation: rungHighlightBio 2s infinite; animation-delay: 1.7s; }

          /* --- 3. THE AI HOLOGRAPHIC SCREEN --- */
          .ai-screen {
            opacity: 0;
            transition: opacity 0.4s ease-in;
            pointer-events: none;
          }
          .biology-engine.active .ai-screen {
            opacity: 1;
          }

          /* AI UI Elements Animations */
          @keyframes spinReticleBio { 100% { transform: rotate(360deg); } }
          .reticle { transform-origin: 150px 150px; animation: spinReticleBio 4s linear infinite; }

          @keyframes waveFlowBio { 100% { stroke-dashoffset: -200; } }
          .analysis-wave { stroke-dasharray: 100 100; animation: waveFlowBio 2s linear infinite; }

          /* NEW: Infinite Smooth Data Scroll */
          @keyframes infiniteScrollBio {
            0% { transform: translateY(0px); }
            100% { transform: translateY(-100px); } 
          }
          .data-stream-container {
            animation: infiniteScrollBio 4s linear infinite; 
          }
        `}</style>

                {/* 
          SCALED GROUP to make the icon 1.8x larger (180%) inside the 300x300 viewBox.
          Since the SVG has overflow-visible, it will bleed outside gracefully if needed.
        */}
                <g
                    className={`biology-engine ${activeClass}`}
                    style={{ transform: "scale(1.8) translateY(-15px)", transformOrigin: "150px 150px" }}
                >
                    <circle cx="150" cy="150" r="140" fill="transparent" />

                    <ellipse cx="150" cy="275" rx="45" ry="8" fill="#E2E8F0" />

                    <g className="dna-structure">
                        <path
                            d="M 120 50 C 120 50, 180 90, 180 150 C 180 210, 120 250, 120 250"
                            fill="none"
                            stroke="url(#backboneGradBio)"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />

                        <line className="base-rung rung-1" x1="130" y1="80" x2="170" y2="80" stroke="url(#pairRedBio)" />
                        <line className="base-rung rung-2" x1="125" y1="110" x2="175" y2="110" stroke="url(#pairBlueBio)" />
                        <line className="base-rung rung-3" x1="122" y1="140" x2="178" y2="140" stroke="url(#pairRedBio)" />
                        <line className="base-rung rung-4" x1="122" y1="170" x2="178" y2="170" stroke="url(#pairBlueBio)" />
                        <line className="base-rung rung-5" x1="125" y1="200" x2="175" y2="200" stroke="url(#pairRedBio)" />
                        <line className="base-rung rung-6" x1="130" y1="230" x2="170" y2="230" stroke="url(#pairBlueBio)" />

                        <path
                            d="M 180 50 C 180 50, 120 90, 120 150 C 120 210, 180 250, 180 250"
                            fill="none"
                            stroke="url(#backboneGradBio)"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                    </g>

                    <rect className="scanner-bar" x="80" y="0" width="140" height="10" fill="url(#scanBeamGradBio)" filter="url(#screenGlowBio)" />

                    <g className="ai-screen" clipPath="url(#screenClipBio)">
                        <rect x="50" y="50" width="200" height="200" fill="#0EA5E9" opacity="0.08" />

                        <rect x="55" y="55" width="190" height="190" rx="8" fill="none" stroke="#00E5FF" strokeWidth="1.5" opacity="0.5" />
                        <line x1="50" y1="220" x2="250" y2="220" stroke="#00E5FF" strokeWidth="1.5" opacity="0.3" />

                        <g className="reticle">
                            <circle cx="150" cy="150" r="30" fill="none" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="10 5" opacity="0.7" />
                            <line x1="150" y1="110" x2="150" y2="130" stroke="#00E5FF" strokeWidth="2" />
                            <line x1="150" y1="190" x2="150" y2="170" stroke="#00E5FF" strokeWidth="2" />
                            <line x1="110" y1="150" x2="130" y2="150" stroke="#00E5FF" strokeWidth="2" />
                            <line x1="190" y1="150" x2="170" y2="150" stroke="#00E5FF" strokeWidth="2" />
                        </g>

                        <path className="analysis-wave" d="M 60 235 Q 80 225, 100 235 T 140 235 T 180 235 T 220 235 T 260 235" fill="none" stroke="#00E5FF" strokeWidth="2" opacity="0.6" />

                        <g clipPath="url(#textScrollClipBio)" fontFamily="monospace" fontSize="10" fill="#00E5FF" opacity="0.8">
                            <g className="data-stream-container">
                                <g>
                                    <text x="210" y="100">SEQ: A-T</text>
                                    <text x="210" y="115">SEQ: C-G</text>
                                    <text x="210" y="130">ANALYZING</text>
                                    <text x="210" y="145">MATCHING</text>
                                    <text x="210" y="160">---</text>
                                    <text x="210" y="175">SEQ: G-C</text>
                                </g>
                                <g transform="translate(0, 100)">
                                    <text x="210" y="100">SEQ: A-T</text>
                                    <text x="210" y="115">SEQ: C-G</text>
                                    <text x="210" y="130">ANALYZING</text>
                                    <text x="210" y="145">MATCHING</text>
                                    <text x="210" y="160">---</text>
                                    <text x="210" y="175">SEQ: G-C</text>
                                </g>
                            </g>
                        </g>

                        <text x="65" y="80" fontFamily="sans-serif" fontSize="12" fill="#00E5FF" fontWeight="bold" letterSpacing="1">AI DIAGNOSTIC ACTIVE</text>
                    </g>
                </g>
            </svg>
        </div>
    );
}
