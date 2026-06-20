import { useAccessibility as useAccessContext } from '../context/AccessibilityContext';

export function useAccessibility() {
  const context = useAccessContext();
  return {
    config: context.config,
    updateConfig: context.updateConfig,
    speak: context.speak,
    stopSpeaking: context.stopSpeaking,
    listening: context.listening,
    speaking: context.speaking,
    startVoiceListening: context.startVoiceListening,
    stopVoiceListening: context.stopVoiceListening,
  };
}
