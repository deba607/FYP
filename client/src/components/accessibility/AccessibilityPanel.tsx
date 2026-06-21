"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccessibility, ttsEngine } from '../../context/AccessibilityContext';
import { Eye, Volume2, Mic, Settings, X } from 'lucide-react';
import { OPEN_ACCESSIBILITY_SETTINGS_EVENT } from '../../lib/accessibilityEvents';
import { useLanguage } from '../../hooks/use-language';
import { getSpeechLanguage, supportedSpeechLanguages, voiceSupportsLanguage } from '../../lib/speech';

export default function AccessibilityPanel() {
  const { config, updateConfig, speak, stopSpeaking } = useAccessibility();
  const { language: appLanguage, setLanguage: setAppLanguage } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedLanguage = getSpeechLanguage(config.language);
  const matchingVoices = useMemo(() => voices
    .filter((voice) => voiceSupportsLanguage(voice, selectedLanguage.locale))
    .sort((first, second) => {
      const firstExact = first.lang.toLowerCase() === selectedLanguage.locale.toLowerCase() ? 0 : 1;
      const secondExact = second.lang.toLowerCase() === selectedLanguage.locale.toLowerCase() ? 0 : 1;
      return firstExact - secondExact || first.name.localeCompare(second.name);
    }), [selectedLanguage.locale, voices]);
  const selectedVoiceName = matchingVoices.some((voice) => voice.name === config.voiceName)
    ? config.voiceName
    : '';

  useEffect(() => {
    router.prefetch('/booking/chat');
    router.prefetch('/booking/new');
    router.prefetch('/booking/directions');
  }, [router]);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(ttsEngine.getVoices());
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    }

    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
  }, []);

  // Keep speech output and microphone recognition aligned with the site's language.
  useEffect(() => {
    const appSpeechLanguage = getSpeechLanguage(appLanguage);
    if (selectedLanguage.code !== appSpeechLanguage.code) {
      void updateConfig({ language: appSpeechLanguage.locale, voiceName: '' });
    }
  }, [appLanguage, selectedLanguage.code, updateConfig]);

  const changeSpeechLanguage = (locale: string) => {
    const nextLanguage = getSpeechLanguage(locale);
    setAppLanguage(nextLanguage.code);
    void updateConfig({ language: nextLanguage.locale, voiceName: '' });
    stopSpeaking();
  };

  const togglePanel = useCallback(() => {
    const targetState = !isOpen;
    setIsOpen(targetState);
    if (targetState) {
      // Small timeout to allow state sync before speaking
      setTimeout(() => {
        speak("Accessibility options panel opened.");
      }, 100);
    }
  }, [isOpen, speak]);

  useEffect(() => {
    const openPanel = () => setIsOpen(true);
    window.addEventListener(OPEN_ACCESSIBILITY_SETTINGS_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_ACCESSIBILITY_SETTINGS_EVENT, openPanel);
  }, []);

  // Capture Escape key to close the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Listen for Alt shortcut commands globally
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'a') {
          e.preventDefault();
          togglePanel();
        } else if (key === 'v') {
          e.preventDefault();
          const targetVoice = !config.voiceEnabled;
          updateConfig({ voiceEnabled: targetVoice });
          if (targetVoice) {
            setTimeout(() => {
              // Ensure audio feedback is active
              const settings = {
                language: config.language,
                voiceName: config.voiceName,
                speed: config.speed,
                pitch: config.pitch,
                volume: config.volume,
              };
              ttsEngine.speak("Voice guidance enabled.", settings);
            }, 150);
          } else {
            ttsEngine.stop();
          }
        } else if (key === 'c') {
          e.preventDefault();
          router.push('/booking/chat');
        } else if (key === 'b') {
          e.preventDefault();
          router.push('/booking/new');
        } else if (key === 'd') {
          e.preventDefault();
          router.push('/booking/directions');
        } else if (key === 'm') {
          e.preventDefault();
          router.push('/');
        }
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [isOpen, config, updateConfig, togglePanel, router]);

  // Focus lock inside modal for screen readers
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    first.focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', trapFocus);
    return () => window.removeEventListener('keydown', trapFocus);
  }, [isOpen]);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={togglePanel}
        className={`${pathname === '/booking/chat' || pathname === '/booking/chatbot' ? 'hidden' : 'fixed'} bottom-6 right-6 z-50 h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:ring-4 focus:ring-primary/50 ${pathname === '/booking/chat' || pathname === '/booking/chatbot' ? '' : 'flex'}`}
        aria-label="Toggle accessibility options"
        aria-expanded={isOpen}
        title="Accessibility Settings (Alt + A)"
      >
        <Settings className="h-6 w-6" />
      </button>

      {/* Settings Modal Interface */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="access-title"
        >
          <div 
            ref={panelRef}
            className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 id="access-title" className="text-xl font-bold flex items-center gap-2">
                <Eye className="text-primary h-6 w-6" /> Accessibility Preferences
              </h2>
              <button
                onClick={togglePanel}
                className="rounded-lg p-2 hover:bg-muted focus:ring-2 focus:ring-primary"
                aria-label="Close accessibility options"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              
              {/* Voice Guidance Switch */}
              <div className="flex items-center justify-between">
                <label htmlFor="voice-guidance" className="font-semibold text-sm">Voice Guidance (Audio assistance)</label>
                <input
                  type="checkbox"
                  id="voice-guidance"
                  checked={config.voiceEnabled}
                  onChange={(e) => updateConfig({ voiceEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              {/* Speech To Text Switch */}
              <div className="flex items-center justify-between">
                <label htmlFor="voice-recognition" className="font-semibold text-sm">Voice Search & Booking (Mic input)</label>
                <input
                  type="checkbox"
                  id="voice-recognition"
                  checked={config.speechToText}
                  onChange={(e) => updateConfig({ speechToText: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              {/* High Contrast Mode */}
              <div className="flex items-center justify-between">
                <label htmlFor="high-contrast" className="font-semibold text-sm">High Contrast Mode</label>
                <input
                  type="checkbox"
                  id="high-contrast"
                  checked={config.highContrast}
                  onChange={(e) => updateConfig({ highContrast: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              {/* Large Text */}
              <div className="flex items-center justify-between">
                <label htmlFor="large-text" className="font-semibold text-sm">Enlarged Interface Text</label>
                <input
                  type="checkbox"
                  id="large-text"
                  checked={config.largeText}
                  onChange={(e) => updateConfig({ largeText: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              {/* Reduce Motion */}
              <div className="flex items-center justify-between">
                <label htmlFor="reduce-motion" className="font-semibold text-sm">Reduce Motion & Animations</label>
                <input
                  type="checkbox"
                  id="reduce-motion"
                  checked={config.reduceMotion}
                  onChange={(e) => updateConfig({ reduceMotion: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              {/* Voice Select */}
              {config.voiceEnabled && (
                <div className="space-y-2 border-t pt-3">
                  <label htmlFor="speech-language" className="block text-sm font-semibold">Speech Language</label>
                  <select
                    id="speech-language"
                    value={selectedLanguage.locale}
                    onChange={(event) => changeSpeechLanguage(event.target.value)}
                    className="w-full rounded-lg border bg-background p-2 text-sm focus:ring-primary"
                  >
                    {supportedSpeechLanguages.map((language) => (
                      <option key={language.code} value={language.locale}>
                        {language.label} — {language.nativeLabel}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="voice-select" className="block text-sm font-semibold">Select Speech Voice</label>
                  <select
                    id="voice-select"
                    value={selectedVoiceName}
                    onChange={(e) => updateConfig({ voiceName: e.target.value })}
                    className="w-full rounded-lg border bg-background p-2 text-sm focus:ring-primary"
                  >
                    <option value="">Automatic ({selectedLanguage.locale})</option>
                    {matchingVoices.map((voice) => (
                      <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                  {matchingVoices.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No installed {selectedLanguage.label} voice was reported. The browser will use its automatic {selectedLanguage.locale} voice when available.
                    </p>
                  )}

                  {/* Volume Slider */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <label htmlFor="voice-volume">Volume</label>
                      <span>{Math.round(config.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      id="voice-volume"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={config.volume}
                      onChange={(e) => updateConfig({ volume: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>

                  {/* Speed Rate Slider */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <label htmlFor="voice-speed">Speed Rate</label>
                      <span>{config.speed}x</span>
                    </div>
                    <input
                      type="range"
                      id="voice-speed"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={config.speed}
                      onChange={(e) => updateConfig({ speed: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-4 mt-4">
              <button
                onClick={stopSpeaking}
                className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Stop Audio
              </button>
              <button
                onClick={() => speak(selectedLanguage.testText)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Test Voice Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
