import { useAccessibility } from '../context/AccessibilityContext';
import { useCallback } from 'react';

export function useSpeechRecognition() {
  const { startVoiceListening, stopVoiceListening, listening } = useAccessibility();

  const listen = useCallback((onCommandDetected: (command: string) => void) => {
    startVoiceListening((transcript) => {
      onCommandDetected(transcript);
    });
  }, [startVoiceListening]);

  return {
    listen,
    stopListening: stopVoiceListening,
    listening,
  };
}
