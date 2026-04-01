"use client";
import React, { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate, type MotionValue } from "framer-motion";

const project = (x: number, y: number, z: number) => ({
    x: 400 + (x - z) * 0.866025,
    y: 300 - y + (x + z) * 0.5,
});

const generatePagePath = (
    t: number,
    isCover: boolean,
    rightY: number,
    leftY: number
) => {
    const steps = 12;
    const width = 180;
    const zTop = -120;
    const zBottom = 120;
    const bendFactor = isCover ? 0.1 : 0.5;
    const topPoints = [];
    const bottomPoints = [];
    const currentYOffset = rightY * (1 - t) + leftY * t;
    for (let i = 0; i <= steps; i++) {
        const w = (i / steps) * width;
        const baseTheta = t * Math.PI;
        const theta = baseTheta - bendFactor * (w / width) * Math.sin(baseTheta);
        const x = w * Math.cos(theta);
        const y = w * Math.sin(theta) + currentYOffset;
        topPoints.push(project(x, y, zTop));
        bottomPoints.push(project(x, y, zBottom));
    }
    let d = `M ${topPoints[0].x} ${topPoints[0].y}`;
    for (let i = 1; i <= steps; i++)
        d += ` L ${topPoints[i].x} ${topPoints[i].y}`;
    for (let i = steps; i >= 0; i--)
        d += ` L ${bottomPoints[i].x} ${bottomPoints[i].y}`;
    d += " Z";
    return d;
};

function StaticBlock({
    yTop,
    yBottom,
    colorTop,
    colorSide,
    colorFront,
}: {
    yTop: number;
    yBottom: number;
    colorTop: string;
    colorSide: string;
    colorFront: string;
}) {
    const topPath = generatePagePath(0, false, yTop, yTop);
    const p1 = project(180, yTop, -120);
    const p2 = project(180, yTop, 120);
    const p3 = project(180, yBottom, 120);
    const p4 = project(180, yBottom, -120);
    const sidePath = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
    const p5 = project(0, yTop, 120);
    const p6 = project(180, yTop, 120);
    const p7 = project(180, yBottom, 120);
    const p8 = project(0, yBottom, 120);
    const frontPath = `M ${p5.x} ${p5.y} L ${p6.x} ${p6.y} L ${p7.x} ${p7.y} L ${p8.x} ${p8.y} Z`;
    return (
        <g>
            <path d={sidePath} fill={colorSide} />
            <path d={frontPath} fill={colorFront} />
            <path d={topPath} fill={colorTop} />
        </g>
    );
}

function AnimatedPage({
    progress,
    isCover,
    rightY,
    leftY,
    side,
    fill,
    stroke,
}: {
    progress: MotionValue<number>;
    isCover: boolean;
    rightY: number;
    leftY: number;
    side: string;
    fill: string;
    stroke: string;
}) {
    const d = useTransform(progress, (t: number) =>
        generatePagePath(t, isCover, rightY, leftY)
    );
    const opacity = useTransform(progress, (t: number) => {
        if (side === "right") return t < 0.5 ? 1 : 0;
        if (side === "left") return t >= 0.5 ? 1 : 0;
        return 1;
    });
    const shadowOpacity = useTransform(progress, [0, 0.5, 1], [0, 0.3, 0]);
    return (
        <motion.g style={{ opacity }}>
            <motion.path
                d={d}
                fill={fill}
                stroke={stroke}
                strokeWidth={isCover ? 2 : 1}
                strokeLinejoin="round"
            />
            <motion.path d={d} fill="black" style={{ opacity: shadowOpacity }} />
        </motion.g>
    );
}

function CoverPage({
    progress,
    rightY,
    leftY,
    side,
}: {
    progress: MotionValue<number>;
    rightY: number;
    leftY: number;
    side: string;
}) {
    const d = useTransform(progress, (t: number) =>
        generatePagePath(t, true, rightY, leftY)
    );
    const opacity = useTransform(progress, (t: number) => {
        if (side === "right") return t < 0.5 ? 1 : 0;
        if (side === "left") return t >= 0.5 ? 1 : 0;
        return 1;
    });
    const fill = side === "right" ? "url(#abCoverGrad)" : "#f3f4f6";
    const stroke = side === "right" ? "#5B21B6" : "#d1d5db";
    const shadowOpacity = useTransform(progress, [0, 0.5, 1], [0, 0.4, 0]);
    return (
        <motion.g style={{ opacity }}>
            <motion.path
                d={d}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
                strokeLinejoin="round"
            />
            <motion.path d={d} fill="black" style={{ opacity: shadowOpacity }} />
        </motion.g>
    );
}

/**
 * Compact animated 3D book icon.
 * Controlled via `isOpen` prop — pass true when the parent card is hovered.
 *
 * @param size    CSS size string, defaults to "36px"
 * @param isOpen  Whether the book should animate open
 */
export default function AnimatedBookIcon({ size = "36px", isOpen = false }: { size?: string; isOpen?: boolean }) {
    const masterProgress = useMotionValue(0);

    useEffect(() => {
        animate(masterProgress, isOpen ? 1 : 0, {
            duration: isOpen ? 2.5 : 1.2,
            ease: "easeInOut",
        });
    }, [isOpen, masterProgress]);

    const coverP = useTransform(masterProgress, [0, 0.5], [0, 1], {
        clamp: true,
    });
    const p1P = useTransform(masterProgress, [0.1, 0.6], [0, 1], {
        clamp: true,
    });
    const p2P = useTransform(masterProgress, [0.2, 0.7], [0, 1], {
        clamp: true,
    });
    const p3P = useTransform(masterProgress, [0.3, 0.8], [0, 1], {
        clamp: true,
    });
    const p4P = useTransform(masterProgress, [0.4, 0.9], [0, 1], {
        clamp: true,
    });
    const p5P = useTransform(masterProgress, [0.5, 1.0], [0, 1], {
        clamp: true,
    });

    const spineP1 = project(0, 0, 120);
    const spineP2 = project(0, -24, 120);
    const spineP3 = project(0, -24, -120);
    const spineP4 = project(0, 0, -120);
    const spinePath = `M ${spineP1.x} ${spineP1.y} L ${spineP2.x} ${spineP2.y} L ${spineP3.x} ${spineP3.y} L ${spineP4.x} ${spineP4.y} Z`;

    return (
        <div
            className="relative flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            <svg
                viewBox="200 230 400 220"
                className="w-full h-full overflow-visible"
                style={{ filter: "drop-shadow(0 1px 2px rgba(91,33,182,0.25))" }}
            >
                <defs>
                    <linearGradient
                        id="abCoverGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                    >
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#5B21B6" />
                    </linearGradient>
                    <linearGradient
                        id="abCoverGradDark"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                    >
                        <stop offset="0%" stopColor="#6D28D9" />
                        <stop offset="100%" stopColor="#4C1D95" />
                    </linearGradient>
                </defs>

                <g transform="translate(0, 50)">
                    {/* Back Cover */}
                    <StaticBlock
                        yTop={-20}
                        yBottom={-24}
                        colorTop="url(#abCoverGradDark)"
                        colorSide="#4C1D95"
                        colorFront="#3B0764"
                    />

                    {/* Spine */}
                    <path d={spinePath} fill="url(#abCoverGradDark)" />

                    {/* Static Pages Block */}
                    <StaticBlock
                        yTop={-10}
                        yBottom={-18}
                        colorTop="#f3f4f6"
                        colorSide="#e5e7eb"
                        colorFront="#d1d5db"
                    />

                    {/* Left Stack */}
                    <CoverPage progress={coverP} rightY={0} leftY={-10} side="left" />
                    <AnimatedPage progress={p1P} rightY={-2} leftY={-8} side="left" isCover={false} fill="#f8f9fa" stroke="#e5e7eb" />
                    <AnimatedPage progress={p2P} rightY={-4} leftY={-6} side="left" isCover={false} fill="#f9fafb" stroke="#e5e7eb" />
                    <AnimatedPage progress={p3P} rightY={-6} leftY={-4} side="left" isCover={false} fill="#f3f4f6" stroke="#e5e7eb" />
                    <AnimatedPage progress={p4P} rightY={-8} leftY={-2} side="left" isCover={false} fill="#f9fafb" stroke="#e5e7eb" />
                    <AnimatedPage progress={p5P} rightY={-10} leftY={0} side="left" isCover={false} fill="#ffffff" stroke="#e5e7eb" />

                    {/* Right Stack */}
                    <AnimatedPage progress={p5P} rightY={-10} leftY={0} side="right" isCover={false} fill="#ffffff" stroke="#e5e7eb" />
                    <AnimatedPage progress={p4P} rightY={-8} leftY={-2} side="right" isCover={false} fill="#f9fafb" stroke="#e5e7eb" />
                    <AnimatedPage progress={p3P} rightY={-6} leftY={-4} side="right" isCover={false} fill="#f3f4f6" stroke="#e5e7eb" />
                    <AnimatedPage progress={p2P} rightY={-4} leftY={-6} side="right" isCover={false} fill="#f9fafb" stroke="#e5e7eb" />
                    <AnimatedPage progress={p1P} rightY={-2} leftY={-8} side="right" isCover={false} fill="#f8f9fa" stroke="#e5e7eb" />
                    <CoverPage progress={coverP} rightY={0} leftY={-10} side="right" />
                </g>
            </svg>
        </div>
    );
}
