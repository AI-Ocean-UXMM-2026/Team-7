"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  parseShellLanguage,
  SHELL_LANGUAGE_STORAGE_KEY,
  type ShellLanguage,
} from "@/lib/shell-ui";

type ShellLanguageContextValue = {
  language: ShellLanguage;
  setLanguage: (language: ShellLanguage) => void;
};

const ShellLanguageContext = createContext<ShellLanguageContextValue | null>(null);
const listeners = new Set<() => void>();
let currentLanguage: ShellLanguage = "en";
let initialized = false;
let listeningForStorage = false;

function readSavedLanguage(): ShellLanguage {
  try {
    return parseShellLanguage(window.localStorage.getItem(SHELL_LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

function getLanguageSnapshot(): ShellLanguage {
  if (typeof window === "undefined") return "en";
  if (!initialized) {
    currentLanguage = readSavedLanguage();
    initialized = true;
  }
  return currentLanguage;
}

function getServerLanguageSnapshot(): ShellLanguage {
  return "en";
}

function notifyLanguageChange() {
  listeners.forEach((listener) => listener());
}

function syncOtherTab(event: StorageEvent) {
  if (event.key !== null && event.key !== SHELL_LANGUAGE_STORAGE_KEY) return;
  currentLanguage = parseShellLanguage(event.newValue);
  initialized = true;
  notifyLanguageChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listeningForStorage && typeof window !== "undefined") {
    window.addEventListener("storage", syncOtherTab);
    listeningForStorage = true;
  }
  return () => listeners.delete(listener);
}

function setSavedLanguage(language: ShellLanguage) {
  currentLanguage = language;
  initialized = true;
  if (typeof window !== "undefined") {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(SHELL_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The in-memory preference still applies when storage is unavailable.
    }
  }
  notifyLanguageChange();
}

export function ShellLanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, getServerLanguageSnapshot);
  const contextValue = useMemo(() => ({ language, setLanguage: setSavedLanguage }), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <ShellLanguageContext.Provider value={contextValue}>{children}</ShellLanguageContext.Provider>;
}

export function useShellLanguage() {
  const value = useContext(ShellLanguageContext);
  if (!value) throw new Error("Shell language controls must be rendered inside ShellLanguageProvider.");
  return value;
}

export function LanguagePreferenceField() {
  const { language, setLanguage } = useShellLanguage();

  return (
    <div className="language-preference">
      <label className="settings-field" htmlFor="workspace-language">
        Language
        <select
          id="workspace-language"
          value={language}
          onChange={(event) => setLanguage(parseShellLanguage(event.target.value))}
        >
          <option value="en">English</option>
          <option value="my">မြန်မာ (Burmese)</option>
        </select>
      </label>
      <p className="settings-note">
        This preference is saved in this browser. Burmese is available for workspace navigation and shell controls; page content and records remain in English.
      </p>
    </div>
  );
}
