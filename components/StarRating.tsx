"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    size?: "sm" | "md" | "lg" | "xl";
    readonly?: boolean;
    showValue?: boolean;
}

const sizeMap = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6", xl: "w-8 h-8" };

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const starVariants: Variants = {
    hidden: { opacity: 0, scale: 0.5, y: 10 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 20 },
    },
    hover: {
        scale: 1.25,
        transition: { type: "spring", stiffness: 400, damping: 15 },
    },
    tap: { scale: 0.8 },
};

export function StarRating({ value, onChange, size = "md", readonly = false, showValue = false }: StarRatingProps) {
    const [hover, setHover] = useState(0);
    const stars = [1, 2, 3, 4, 5];
    const iconSize = sizeMap[size];

    return (
        <motion.div
            className="flex items-center gap-1"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            onMouseLeave={() => !readonly && setHover(0)}
        >
            {stars.map((star) => {
                const filled = star <= (hover || value);
                return (
                    <motion.button
                        key={star}
                        type="button"
                        disabled={readonly}
                        className={`relative flex items-center justify-center transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
                        variants={starVariants}
                        whileHover={!readonly ? "hover" : undefined}
                        whileTap={!readonly ? "tap" : undefined}
                        onClick={() => onChange?.(star)}
                        onMouseEnter={() => !readonly && setHover(star)}
                        aria-label={`Rate ${star} stars`}
                    >
                        {/* Glowing background layer for active stars */}
                        <AnimatePresence>
                            {filled && !readonly && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="absolute inset-0 bg-amber-400 blur-md opacity-30 rounded-full"
                                />
                            )}
                        </AnimatePresence>
                        <motion.div
                            animate={{ color: filled ? "rgb(251, 191, 36)" : "rgba(156, 163, 175, 0.4)" }}
                            transition={{ duration: 0.2 }}
                        >
                            <Star
                                className={`${iconSize} transition-all duration-200 ${filled ? "fill-amber-400 drop-shadow-sm text-amber-500" : "fill-transparent text-muted-foreground/40"
                                    }`}
                            />
                        </motion.div>
                    </motion.button>
                );
            })}
            {showValue && value > 0 && (
                <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={value}
                    className="ml-2 text-sm font-extrabold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-md"
                >
                    {value.toFixed(1)}
                </motion.span>
            )}
        </motion.div>
    );
}

/** Compact inline display: ★ 4.2 (12) */
export function StarRatingBadge({ rating, count }: { rating: number; count: number }) {
    if (count === 0) return <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md font-medium">No reviews</span>;
    return (
        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-700/50 shadow-sm">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 drop-shadow-sm" />
            <span className="font-extrabold text-amber-700 dark:text-amber-300">{rating}</span>
            <span className="text-amber-600/70 dark:text-amber-400/70 font-medium">({count})</span>
        </span>
    );
}
