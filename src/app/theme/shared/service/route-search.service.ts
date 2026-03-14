import { Injectable, computed, signal } from '@angular/core';

type SearchContext = 'orders' | 'global';

@Injectable({ providedIn: 'root' })
export class RouteSearchService {
  private readonly context = signal<SearchContext>('global');
  private readonly terms = signal<Record<SearchContext, string>>({
    orders: '',
    global: ''
  });

  readonly activeContext = computed(() => this.context());
  readonly currentTerm = computed(() => this.terms()[this.context()] ?? '');
  readonly ordersTerm = computed(() => this.terms().orders ?? '');

  setContextFromUrl(url: string): void {
    const normalizedUrl = (url || '').toLowerCase();
    const newContext: SearchContext = normalizedUrl.startsWith('/orders') ? 'orders' : 'global';
    this.context.set(newContext);
  }

  setCurrentTerm(value: string): void {
    const term = value ?? '';
    const context = this.context();
    this.terms.update((current) => ({
      ...current,
      [context]: term
    }));
  }

  getTermForContext(context: SearchContext): string {
    return this.terms()[context] ?? '';
  }
}
