"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme !== "dark") {
      setTheme("dark");
    }
  }, [theme, setTheme]);

  return null;
}
