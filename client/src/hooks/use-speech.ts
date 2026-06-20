import { useAccessibility } from '../context/AccessibilityContext';
import { useCallback } from 'react';

export function useSpeech() {
  const { speak, stopSpeaking, speaking } = useAccessibility();

  const readElement = useCallback((elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      speak(el.innerText || el.textContent || '');
    }
  }, [speak]);

  const readPage = useCallback(() => {
    const mainContent = document.querySelector('main') || document.body;
    speak(mainContent.innerText || mainContent.textContent || '');
  }, [speak]);

  return {
    speak,
    stopSpeaking,
    speaking,
    readElement,
    readPage,
  };
}
