// Angular import
import { Component, OnDestroy, OnInit, input, output, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RouteSearchService } from 'src/app/theme/shared/service/route-search.service';

// icons
import { IconService } from '@ant-design/icons-angular';
import { MenuUnfoldOutline, MenuFoldOutline, SearchOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-nav-left',
  imports: [SharedModule],
  templateUrl: './nav-left.component.html',
  styleUrls: ['./nav-left.component.scss']
})
export class NavLeftComponent implements OnInit, OnDestroy {
  private iconService = inject(IconService);
  private router = inject(Router);
  private routeSearchService = inject(RouteSearchService);
  private routeSubscription?: Subscription;

  // public props
  readonly navCollapsed = input.required<boolean>();
  readonly NavCollapse = output();
  readonly NavCollapsedMob = output();
  // Constructor
  constructor() {
    this.iconService.addIcon(...[MenuUnfoldOutline, MenuFoldOutline, SearchOutline]);
  }

  ngOnInit() {
    this.routeSearchService.setContextFromUrl(this.router.url);
    this.routeSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.routeSearchService.setContextFromUrl(event.urlAfterRedirects);
      }
    });
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
  }

  // public method
  navCollapse() {
    this.NavCollapse.emit();
  }

  navCollapsedMob() {
    this.NavCollapsedMob.emit();
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.routeSearchService.setCurrentTerm(input?.value ?? '');
  }

  get searchValue(): string {
    return this.routeSearchService.currentTerm();
  }

  get searchPlaceholder(): string {
    const context = this.routeSearchService.activeContext();
    if (context === 'orders') {
      return 'Buscar pedidos por boleta, nombre o fecha';
    }
    return 'Buscar en esta vista';
  }
}
