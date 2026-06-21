"use client";

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { getFirebaseClientAuth } from '../lib/config/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TextToSpeechEngine, SpeechSettings } from '../lib/speech';
import { SpeechRecognitionEngine } from '../lib/speechRecognition';

export interface AccessibilityConfig {
  voiceEnabled: boolean;
  speechToText: boolean;
  language: string;
  voiceName: string;
  speed: number;
  pitch: number;
  volume: number;
  highContrast: boolean;
  largeText: boolean;
  keyboardNavigation: boolean;
  reduceMotion: boolean;
  autoReadChatbot: boolean;
  autoReadBooking: boolean;
}

const defaultConfig: AccessibilityConfig = {
  voiceEnabled: false,
  speechToText: false,
  language: 'en-IN',
  voiceName: '',
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  highContrast: false,
  largeText: false,
  keyboardNavigation: true,
  reduceMotion: false,
  autoReadChatbot: true,
  autoReadBooking: true,
};

interface AccessibilityContextType {
  config: AccessibilityConfig;
  updateConfig: (updates: Partial<AccessibilityConfig>) => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  startVoiceListening: (onResult: (text: string) => void) => void;
  stopVoiceListening: () => void;
  listening: boolean;
  speaking: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const ttsEngine = new TextToSpeechEngine();
export const sttEngine = new SpeechRecognitionEngine();

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<AccessibilityConfig>(defaultConfig);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Sync state modifications to HTML classes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    
    if (config.highContrast) {
      root.classList.add('dark');
      root.style.setProperty('--contrast-ratio', 'high');
    } else {
      root.classList.remove('dark');
      root.style.removeProperty('--contrast-ratio');
    }

    if (config.largeText) {
      root.classList.add('text-lg-accessibility');
    } else {
      root.classList.remove('text-lg-accessibility');
    }

    if (config.reduceMotion) {
      root.classList.add('reduce-transitions');
    } else {
      root.classList.remove('reduce-transitions');
    }
  }, [config.highContrast, config.largeText, config.reduceMotion]);

  // Load preferences from Firestore after login
  useEffect(() => {
    const auth = getFirebaseClientAuth();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const { getFirestore } = await import('firebase/firestore');
          const db = getFirestore();
          const docRef = doc(db, 'users', user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().accessibility) {
            setConfigState({ ...defaultConfig, ...snap.data().accessibility });
          }
        } catch (err) {
          console.error("Failed to load user preferences", err);
        }
      }
    });
    return unsubscribe;
  }, []);

  const updateConfig = useCallback(async (updates: Partial<AccessibilityConfig>) => {
    const nextConfig = { ...config, ...updates };
    setConfigState(nextConfig);

    const auth = getFirebaseClientAuth();
    if (auth.currentUser) {
      try {
        const { getFirestore } = await import('firebase/firestore');
        const db = getFirestore();
        const docRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(docRef, { accessibility: nextConfig, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.error("Failed to persist user preferences", err);
      }
    }
  }, [config]);

  const speak = useCallback((text: string) => {
    if (!config.voiceEnabled) return;
    setSpeaking(true);
    const settings: SpeechSettings = {
      language: config.language,
      voiceName: config.voiceName,
      speed: config.speed,
      pitch: config.pitch,
      volume: config.volume,
    };
    ttsEngine.speak(text, settings, () => setSpeaking(false), () => setSpeaking(false));
  }, [config.language, config.pitch, config.speed, config.voiceEnabled, config.voiceName, config.volume]);

  const stopSpeaking = useCallback(() => {
    ttsEngine.stop();
    setSpeaking(false);
  }, []);

  const startVoiceListening = (onResult: (text: string) => void) => {
    if (!sttEngine.isSupported()) return;
    setListening(true);
    sttEngine.start(
      config.language,
      (text) => {
        onResult(text);
        setListening(false);
      },
      () => setListening(false),
      () => setListening(false)
    );
  };

  const stopVoiceListening = () => {
    sttEngine.stop();
    setListening(false);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        config,
        updateConfig,
        speak,
        stopSpeaking,
        startVoiceListening,
        stopVoiceListening,
        listening,
        speaking,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
