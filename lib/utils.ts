import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip LaTeX wrappers, braces, backslash commands, and collapse whitespace so
 *  AI-generated names like "Force: \\( F = \\frac{k q_1 q_2}{r^2} \\)" match
 *  the plain-text syllabus name "Force: F = kq1q2/r^2". */
export function fuzzySubtopicKey(raw: string): string {
  return raw
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, "")
    .replace(/\\frac\b/g, "")
    .replace(/\\(?:left|right|text|mathrm|mathbf)\b/g, "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}()^_]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}
