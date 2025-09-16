import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Inject } from '@angular/core';

declare var SpeechRecognition: any;
declare var webkitSpeechRecognition: any;
declare var Artyom: any;
declare const navigator: any;

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: any = null;
  private artyom: any = null;
  private isListening = false;
  private usingNative = false;
  private usingArtyom = false;

  transcript$ = new BehaviorSubject<string>('');

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);

      // Step 1: Try native Web Speech API first (skip on iOS due to unreliability)
      const SpeechRecognitionImpl = SpeechRecognition || webkitSpeechRecognition;
      if (SpeechRecognitionImpl && !isIOS) {
        this.usingNative = true;
        this.recognition = new SpeechRecognitionImpl();
        this.setupNativeRecognition();
      } else if (typeof Artyom !== 'undefined') {
        // Step 2: Fallback to Artyom.js on iOS or if native unsupported
        this.usingArtyom = true;
        this.setupArtyom();
      } else {
        console.error('Speech recognition not supported in this browser.');
        this.transcript$.next('Speech recognition not supported in this browser. Try typing instead.');
      }
    } else {
      console.warn('Speech recognition is not available on the server.');
    }
  }

  private setupNativeRecognition() {
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this.transcript$.next(transcript);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Native speech recognition error:', event.error);
      this.handleError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };
  }

  private setupArtyom() {
    this.artyom = new Artyom();
    this.artyom.initialize({
      lang: 'en-US',
      continuous: true,
      debug: true, // Enable debug logs for testing
      listen: false, // We'll control start/stop manually
      speed: 1,
      mode: 'continuous'
    }).then(() => {
      console.log('Artyom initialized successfully.');
    }).catch((err: any) => {
      console.error('Artyom initialization failed:', err);
      this.transcript$.next('Failed to initialize speech recognition.');
    });

    this.artyom.redirectRecognizedTextOutput((text: string, isFinal: boolean) => {
      if (isFinal) {
        this.transcript$.next(text);
      }
    });

    this.artyom.onError((error: any) => {
      console.error('Artyom error:', error);
      this.handleError(error.code || error);
    });

    // iOS-specific: Adjust restart interval to handle Safari timeouts
    if (/iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())) {
      this.artyom.restartInterval = 2000; // Restart every 2s to mitigate iOS issues
    }
  }

  private handleError(error: string) {
    if (error === 'not-allowed' || error === 'permission-denied') {
      this.transcript$.next('Microphone permission denied. Please allow access to continue.');
    } else if (error === 'no-speech') {
      this.transcript$.next('No speech detected. Try speaking again.');
    } else {
      this.transcript$.next('Speech recognition error: ' + error + '.');
    }
    this.isListening = false;
  }

  start() {
    if (isPlatformBrowser(this.platformId) && !this.isListening) {
      if (this.usingNative && this.recognition) {
        try {
          this.recognition.start();
          this.isListening = true;
          console.log('Native speech recognition started.');
        } catch (err) {
          console.error('Native start error:', err);
          if (err && typeof err === 'object' && 'message' in err) {
            this.handleError((err as { message: string }).message);
          } else {
            this.handleError(String(err));
          }
        }
      } else if (this.usingArtyom && this.artyom) {
        this.artyom.fatality().then(() => {
          this.artyom.start({
            continuous: true,
            onEnd: () => {
              this.isListening = false;
            }
          }).then(() => {
            this.isListening = true;
            console.log('Artyom speech recognition started.');
          }).catch((err: any) => {
            console.error('Artyom start error:', err);
            this.handleError(err);
          });
        });
      } else {
        this.transcript$.next('Speech recognition not available. Check browser support.');
      }
    }
  }

  stop() {
    if (isPlatformBrowser(this.platformId) && this.isListening) {
      if (this.usingNative && this.recognition) {
        this.recognition.stop();
        this.isListening = false;
        console.log('Native speech recognition stopped.');
      } else if (this.usingArtyom && this.artyom) {
        this.artyom.fatality().then(() => {
          this.isListening = false;
          console.log('Artyom speech recognition stopped.');
        });
      }
    }
  }
}