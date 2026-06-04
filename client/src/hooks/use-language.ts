"use client";

import { useEffect, useState } from 'react';
import { LANGUAGE_STORAGE_KEY, LanguageCode, normalizeLanguage } from '../lib/i18n';

const LANGUAGE_EVENT = 'bharat_museum_language_changed';

export function setGlobalLanguage(language: LanguageCode) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: language }));
}

export function useLanguage() {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    const loadLanguage = () => {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      setLanguageState(normalizeLanguage(stored));
    };

    const handleLanguageChange = (event: Event) => {
      setLanguageState(normalizeLanguage((event as CustomEvent).detail));
    };

    loadLanguage();
    window.addEventListener('storage', loadLanguage);
    window.addEventListener(LANGUAGE_EVENT, handleLanguageChange);
    return () => {
      window.removeEventListener('storage', loadLanguage);
      window.removeEventListener(LANGUAGE_EVENT, handleLanguageChange);
    };
  }, []);

  return {
    language,
    setLanguage: setGlobalLanguage,
  };
}

