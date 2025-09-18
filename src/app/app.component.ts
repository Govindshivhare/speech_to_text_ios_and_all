import { Component, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { SpeechRecognitionService } from './speech-recognition.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgIf],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnDestroy {
  title = signal('Speech-to-Text Transcript Generator');
  transcript = signal('');
  error = signal('');
  private subscription: Subscription;

 onclick(action: string) {
  if (action === 'start') {
    this.start();
  } else if (action === 'stop') {
    this.stop();
  }
}

  constructor(private speechService: SpeechRecognitionService) {
    this.subscription = this.speechService.transcript$.subscribe(text => {
      if (text.includes('error') || text.includes('denied') || text.includes('not supported') || text.includes('failed')) {
        this.error.set(text);
        this.transcript.set('');
      } else {
        this.transcript.set(text);
        this.error.set('');
      }
    });
  }

  start() {
    this.error.set('');
    this.speechService.start();
  }

  stop() {
    this.speechService.stop();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}