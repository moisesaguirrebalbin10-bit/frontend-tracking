// angular import
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// project import
import { SpinnerComponent } from './theme/shared/components/spinner/spinner.component';
import { ThemeModeService } from './theme/shared/service/theme-mode.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet, SpinnerComponent]
})
export class AppComponent {
  private readonly themeModeService = inject(ThemeModeService);

  // public props
  title = 'Ezzeta Sistema Tracking';

  constructor() {
    // Service injection at root ensures theme defaults are applied on startup.
    this.themeModeService.setMode('dark');
  }
}
