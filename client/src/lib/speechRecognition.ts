export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export class SpeechRecognitionEngine {
  private recognition: any = null;
  private active = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public start(
    language: string,
    onResult: (result: string) => void,
    onEnd: () => void,
    onError: (err: string) => void
  ) {
    if (!this.recognition) {
      onError('Speech recognition not supported in this browser.');
      return;
    }

    if (this.active) {
      this.recognition.abort();
    }

    this.recognition.lang = language;
    this.recognition.onstart = () => {
      this.active = true;
    };

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      onError(event.error || 'Speech recognition error occurred.');
    };

    this.recognition.onend = () => {
      this.active = false;
      onEnd();
    };

    this.recognition.start();
  }

  public stop() {
    if (this.recognition && this.active) {
      this.recognition.stop();
    }
  }
}
