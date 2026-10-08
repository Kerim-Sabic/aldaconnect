"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
type Theme = "system" | "light" | "dark";
export default function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      let choice: Theme = "system";
      try {
        const saved = localStorage.getItem("alda-theme");
        if (saved === "light" || saved === "dark") choice = saved;
      } catch {}
      setTheme(choice);
      const dark = choice === "dark" || (choice === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#191815" : "#f6f3ed");
    };
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("storage", apply);
    window.addEventListener("alda-theme", apply);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", apply);
      window.removeEventListener("alda-theme", apply);
    };
  }, []);
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  return (
    <label className="theme-control">
      <Icon size={17} aria-hidden="true" />
      <span className="sr-only">Izgled aplikacije</span>
      <select
        aria-label="Izgled aplikacije"
        value={theme}
        onChange={(e) => {
          try {
            localStorage.setItem("alda-theme", e.target.value);
          } catch {}
          window.dispatchEvent(new Event("alda-theme"));
        }}
      >
        <option value="system">Sistem</option>
        <option value="light">Svijetlo</option>
        <option value="dark">Tamno</option>
      </select>
    </label>
  );
}
