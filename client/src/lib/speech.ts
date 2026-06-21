export interface SpeechSettings {
  language: string;
  voiceName: string;
  speed: number;
  pitch: number;
  volume: number;
}

export const supportedSpeechLanguages = [
  {
    code: 'en',
    locale: 'en-IN',
    label: 'English',
    nativeLabel: 'English',
    testText: 'Voice settings are working correctly.'
  },
  {
    code: 'hi',
    locale: 'hi-IN',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    testText: 'वॉइस सेटिंग सही तरीके से काम कर रही है।'
  },
  {
    code: 'bn',
    locale: 'bn-IN',
    label: 'Bengali',
    nativeLabel: 'বাংলা',
    testText: 'ভয়েস সেটিংস সঠিকভাবে কাজ করছে।'
  },
  {
    code: 'ta',
    locale: 'ta-IN',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    testText: 'குரல் அமைப்புகள் சரியாக வேலை செய்கின்றன.'
  }
] as const;

export type SpeechLanguage = (typeof supportedSpeechLanguages)[number];

export function getSpeechLanguage(language: string): SpeechLanguage {
  const normalized = String(language || '').trim().toLowerCase();
  const baseLanguage = normalized.split('-')[0];
  return supportedSpeechLanguages.find((item) => (
    item.code === baseLanguage || item.locale.toLowerCase() === normalized
  )) ?? supportedSpeechLanguages[0];
}

export function normalizeSpeechLocale(language: string): string {
  return getSpeechLanguage(language).locale;
}

export function voiceSupportsLanguage(voice: SpeechSynthesisVoice, language: string): boolean {
  return voice.lang.toLowerCase().split('-')[0] === getSpeechLanguage(language).code;
}

export class TextToSpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public speak(text: string, settings: SpeechSettings, onEnd?: () => void, onError?: (err: any) => void) {
    if (!this.synth) {
      if (onError) onError('Speech synthesis not supported in this browser.');
      return;
    }

    this.stop();

    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const language = getSpeechLanguage(settings.language);
    utterance.rate = settings.speed;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    const voices = this.getVoices();
    const languageVoices = voices.filter((voice) => voiceSupportsLanguage(voice, language.locale));
    const selectedVoice = languageVoices.find((voice) => voice.name === settings.voiceName)
      ?? languageVoices.find((voice) => voice.lang.toLowerCase() === language.locale.toLowerCase())
      ?? languageVoices.find((voice) => voice.default)
      ?? languageVoices[0];

    utterance.lang = selectedVoice?.lang || language.locale;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
      this.currentUtterance = null;
      if (onError) onError(event);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause() {
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}
