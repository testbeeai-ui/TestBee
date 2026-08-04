"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "../styles";

export type DiveButtonVariant = "primary" | "outline" | "ghost" | "secondary" | "navPrimary" | "navSecondary";

type DiveButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: DiveButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
};

/** Variants that already include full chrome (not composed with `.btn`). */
const STANDALONE: DiveButtonVariant[] = ["secondary", "navPrimary", "navSecondary"];

const variantClass: Record<DiveButtonVariant, string> = {
  primary: styles.btnPrimary,
  outline: styles.btnOutline,
  ghost: styles.btnGhost,
  secondary: styles.undertakingCancel,
  navPrimary: styles.quizNavPrimary,
  navSecondary: styles.quizNavSecondary,
};

export default function DiveButton({
  variant = "primary",
  fullWidth = false,
  className,
  children,
  type = "button",
  ...rest
}: DiveButtonProps) {
  const standalone = STANDALONE.includes(variant);
  return (
    <button
      type={type}
      className={cn(
        !standalone && styles.btn,
        variantClass[variant],
        fullWidth && styles.btnFull,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
