"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "../styles";

type DivePanelProps = HTMLAttributes<HTMLDivElement> & {
  solid?: boolean;
  children: ReactNode;
};

export default function DivePanel({ solid = false, className, children, ...rest }: DivePanelProps) {
  return (
    <div className={cn(solid ? styles.panelSolid : styles.panel, className)} {...rest}>
      {children}
    </div>
  );
}
