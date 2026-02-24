"use client";
import React from "react";

/**
 * Anime-style aura flame icon for Funbrain Forge.
 * Controlled via `isOpen` — when true the flame powers up with a
 * multi-layer cyan / white / blue aura + particle sparks.
 */
export default function AnimatedFlameIcon({
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
                    <filter id="ffCoreGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
                        <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur2" />
                        <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="ffAmbientGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                <style>{`
          .ff-aura-layer {
            transform-origin: 150px 250px;
            transition: d 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                        fill 0.5s ease,
                        opacity 0.5s ease,
                        transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            d: path("M 150 235 C 185 235, 195 190, 180 160 C 175 145, 165 130, 150 70 C 135 130, 125 145, 120 160 C 105 190, 115 235, 150 235 Z");
          }
          .ff-layer-outer { opacity: 0.6; fill: #EA580C; filter: drop-shadow(0px 0px 8px rgba(234, 88, 12, 0.4)); }
          .ff-layer-mid   { opacity: 0.8; fill: #F59E0B; filter: drop-shadow(0px 0px 6px rgba(245, 158, 11, 0.5)); }
          .ff-layer-core  { opacity: 1; fill: #FDE047; filter: drop-shadow(0px 0px 12px rgba(253, 224, 71, 0.8)); }

          /* ACTIVE = powered-up state */
          .ff-container.active .ff-layer-outer {
            opacity: 0.8;
            fill: #0066CC;
            filter: url(#ffAmbientGlow);
            d: path("M 150 260 C 230 260, 270 200, 250 140 C 230 80, 270 60, 220 40 C 180 60, 170 90, 150 10 C 130 90, 120 60, 80 40 C 30 60, 70 80, 50 140 C 30 200, 70 260, 150 260 Z");
          }
          .ff-container.active .ff-layer-mid {
            opacity: 1;
            fill: #00E5FF;
            d: path("M 150 250 C 210 250, 240 200, 220 150 C 200 100, 240 80, 200 60 C 170 80, 160 100, 150 30 C 140 100, 130 80, 100 60 C 60 80, 100 100, 80 150 C 60 200, 90 250, 150 250 Z");
          }
          .ff-container.active .ff-layer-core {
            opacity: 1;
            fill: #FFFFFF;
            filter: url(#ffCoreGlow);
            d: path("M 150 240 C 190 240, 210 200, 190 160 C 170 120, 200 100, 170 80 C 160 90, 155 110, 150 50 C 145 110, 140 90, 130 80 C 100 100, 130 120, 110 160 C 90 200, 110 240, 150 240 Z");
          }

          @keyframes ffAuraPulse {
            0%, 100% { transform: scale(1); }
            50%      { transform: scale(1.02) translateY(-5px); }
          }
          .ff-container.active .ff-aura-layer {
            animation: ffAuraPulse 1.5s ease-in-out infinite alternate;
            animation-delay: 0.5s;
          }

          /* Sparks */
          .ff-spark {
            opacity: 0;
            transform-origin: center;
            d: path("M 150 240 L 154 225 L 150 210 L 146 225 Z");
          }
          .ff-container.active .ff-spark {
            animation: ffShootToSky var(--dur) cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite var(--del);
          }
          @keyframes ffShootToSky {
            0%   { transform: translateY(0) translateX(0) scale(0); opacity: 0; }
            10%  { opacity: 1; }
            30%  { transform: translateY(-50px) translateX(calc(var(--dir) * 15px)) scale(1.2); opacity: 1; }
            100% { transform: translateY(var(--ty)) translateX(calc(var(--dir) * 50px)) scale(0); opacity: 0; }
          }
        `}</style>

                <g className={`ff-container ${activeClass}`}>
                    {/* Sparks */}
                    <path className="ff-spark" fill="#00E5FF" style={{ "--dur": "1.2s", "--del": "0.0s", "--dir": -1, "--ty": "-200px" } as React.CSSProperties} />
                    <path className="ff-spark" fill="#FFFFFF" style={{ "--dur": "1.5s", "--del": "0.2s", "--dir": 1, "--ty": "-220px" } as React.CSSProperties} />
                    <path className="ff-spark" fill="#0066CC" style={{ "--dur": "1.0s", "--del": "0.4s", "--dir": -2, "--ty": "-180px" } as React.CSSProperties} />
                    <path className="ff-spark" fill="#FFFFFF" style={{ "--dur": "1.8s", "--del": "0.6s", "--dir": 0.5, "--ty": "-250px" } as React.CSSProperties} />
                    <path className="ff-spark" fill="#00E5FF" style={{ "--dur": "1.1s", "--del": "0.1s", "--dir": 1.5, "--ty": "-190px" } as React.CSSProperties} />
                    <path className="ff-spark" fill="#FFFFFF" style={{ "--dur": "1.4s", "--del": "0.8s", "--dir": -0.5, "--ty": "-210px" } as React.CSSProperties} />

                    {/* Aura layers */}
                    <path className="ff-aura-layer ff-layer-outer" />
                    <path className="ff-aura-layer ff-layer-mid" />
                    <path className="ff-aura-layer ff-layer-core" />
                </g>
            </svg>
        </div>
    );
}
