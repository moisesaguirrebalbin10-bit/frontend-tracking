import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAntIcons } from '@ant-design/icons-angular';
import {
  BarChartOutline,
  DashboardOutline,
  QuestionOutline,
  SearchOutline,
  TeamOutline,
  UnorderedListOutline
} from '@ant-design/icons-angular/icons';
import { routes } from './app-routing.module';
import { authInterceptor } from './services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAntIcons([
      DashboardOutline,
      UnorderedListOutline,
      TeamOutline,
      BarChartOutline,
      SearchOutline,
      QuestionOutline
    ])
  ]
};
