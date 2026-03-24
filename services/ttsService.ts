
import { AudioDramaCast } from "../types";

export interface VoiceParams {
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class TTSService {
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Chrome loads voices asynchronously
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
        this.isInitialized = true;
        console.log(`[TTSService] Loaded ${this.voices.length} voices.`);
      };
      // Try getting them immediately just in case
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  /**
   * Simple heuristic to pick a voice based on gender/description.
   */
  public getVoiceForCharacter(character: AudioDramaCast, language: 'zh' | 'en'): SpeechSynthesisVoice | null {
    if (!this.voices.length) return null;

    // Filter by language first
    const langPrefix = language === 'zh' ? 'zh' : 'en';
    const langVoices = this.voices.filter(v => v.lang.startsWith(langPrefix));
    
    // If no voices for this language, fallback to any
    const pool = langVoices.length > 0 ? langVoices : this.voices;

    // Simple keyword matching for gender/robot
    if (character.gender === 'robot' || character.role.toLowerCase().includes('ai')) {
        // Look for "Google" or "Microsoft" voices that might sound more synthetic, or just pick first
        return pool.find(v => v.name.includes('Google')) || pool[0];
    }

    if (character.gender === 'female') {
         // Try to find a female voice (heuristic: voice names often don't indicate gender, 
         // but some system voices do, or we just pick a specific index if known)
         // For now, on Mac/Win, we often just have "Google [Name]" or "Microsoft [Name]"
         // This is a rough guess.
         return pool.find(v => v.name.includes('Female') || v.name.includes('Lili') || v.name.includes('Samantha')) || pool[0];
    }
    
    if (character.gender === 'male') {
         return pool.find(v => v.name.includes('Male') || v.name.includes('Daniel') || v.name.includes('David')) || pool[pool.length - 1];
    }

    return pool[0];
  }

  public speak(text: string, voice: SpeechSynthesisVoice | null, params: VoiceParams = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!voice) {
        // Fallback or error? For now, resolve immediately to skip
        console.warn("[TTSService] No voice provided for:", text);
        resolve(); 
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.rate = params.rate || 1;
      utterance.pitch = params.pitch || 1;
      utterance.volume = params.volume || 1;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.error("TTS Error:", e);
        resolve(); // Resolve anyway to continue script
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  public stop() {
    window.speechSynthesis.cancel();
  }
}

export const ttsService = new TTSService();
