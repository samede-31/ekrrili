"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export type SiteLanguage = "ar" | "en" | "fr";

const languageKey = "ekrrili-language-v1";
const themeKey = "ekrrili-theme-v1";

export function setSiteLanguage(language: SiteLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(languageKey, language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  window.dispatchEvent(new CustomEvent("ekrrili-language-change", { detail: language }));
}

export function useSiteLanguage() {
  const [language, setLanguage] = useState<SiteLanguage>("ar");

  useEffect(() => {
    const saved = window.localStorage.getItem(languageKey);
    if (saved === "ar" || saved === "en" || saved === "fr") setLanguage(saved);
    const onLanguageChange = (event: Event) => {
      const selected = (event as CustomEvent<SiteLanguage>).detail;
      if (selected === "ar" || selected === "en" || selected === "fr") setLanguage(selected);
    };
    window.addEventListener("ekrrili-language-change", onLanguageChange);
    return () => window.removeEventListener("ekrrili-language-change", onLanguageChange);
  }, []);

  return language;
}

export function SitePreferences() {
  const [language, setLanguage] = useState<SiteLanguage>("ar");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(languageKey);
    const nextLanguage: SiteLanguage = savedLanguage === "en" || savedLanguage === "fr" || savedLanguage === "ar"
      ? savedLanguage
      : "ar";
    setLanguage(nextLanguage);
    setSiteLanguage(nextLanguage);

    const savedTheme = window.localStorage.getItem(themeKey);
    const nextDark = savedTheme === "dark" || (savedTheme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";

    const onLanguageChange = (event: Event) => {
      const selected = (event as CustomEvent<SiteLanguage>).detail;
      if (selected === "ar" || selected === "en" || selected === "fr") setLanguage(selected);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === languageKey && (event.newValue === "ar" || event.newValue === "en" || event.newValue === "fr")) {
        setLanguage(event.newValue);
        document.documentElement.lang = event.newValue;
        document.documentElement.dir = event.newValue === "ar" ? "rtl" : "ltr";
      }
      if (event.key === themeKey) {
        const useDark = event.newValue === "dark" ||
          (event.newValue !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        setDark(useDark);
        document.documentElement.classList.toggle("dark", useDark);
        document.documentElement.style.colorScheme = useDark ? "dark" : "light";
      }
    };
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem(themeKey) !== null) return;
      setDark(event.matches);
      document.documentElement.classList.toggle("dark", event.matches);
      document.documentElement.style.colorScheme = event.matches ? "dark" : "light";
    };
    window.addEventListener("ekrrili-language-change", onLanguageChange);
    window.addEventListener("storage", onStorage);
    systemTheme.addEventListener("change", onSystemThemeChange);
    return () => {
      window.removeEventListener("ekrrili-language-change", onLanguageChange);
      window.removeEventListener("storage", onStorage);
      systemTheme.removeEventListener("change", onSystemThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    window.localStorage.setItem(themeKey, nextDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
  };

  return (
    <aside aria-label="تفضيلات العرض واللغة" className="site-preferences fixed start-3 top-[84px] z-[60] flex items-center gap-1 rounded-full border border-[#dfe7e1] bg-white/95 p-1 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={dark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
        title={dark ? "الوضع النهاري" : "الوضع الليلي"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#52645a] hover:bg-[#edf4ee]"
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <select
        aria-label="لغة الموقع"
        value={language}
        onChange={(event) => setSiteLanguage(event.target.value as SiteLanguage)}
        className="h-9 rounded-full border-0 bg-transparent pe-2 ps-1 text-xs font-bold text-[#35463b] outline-none"
      >
        <option value="ar">العربية</option>
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
    </aside>
  );
}
