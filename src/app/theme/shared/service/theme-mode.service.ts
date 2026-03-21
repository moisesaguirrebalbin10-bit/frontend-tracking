import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeModeService {
  private readonly document = inject(DOCUMENT);
  private readonly modeSignal = signal<ThemeMode>('dark');

  readonly mode = this.modeSignal.asReadonly();

  constructor() {
    // Keep dark mode as the default mode on every page load.
    this.applyMode('dark');
  }

  isDarkMode(): boolean {
    return this.modeSignal() === 'dark';
  }

  toggleMode(): void {
    this.applyMode(this.isDarkMode() ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.applyMode(mode);
  }

  private applyMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);

    const html = this.document.documentElement;
    const body = this.document.body;

    html.setAttribute('data-bs-theme', mode);
    body.setAttribute('data-bs-theme', mode);

    body.classList.toggle('light-mode', mode === 'light');
    body.classList.toggle('dark-mode', mode === 'dark');
  }
}