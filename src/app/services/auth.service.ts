import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, tap, catchError, finalize, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginRequest, RegisterRequest, AuthResponse, RefreshTokenResponse, LogoutResponse } from '../models/auth.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private readonly accessTokenKey = 'access_token';
  private readonly refreshTokenKey = 'refresh_token';
  private readonly expiresInKey = 'expires_in';
  private readonly currentUserKey = 'current_user';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem(this.currentUserKey);
    if (storedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem(this.currentUserKey);
      }
    }

    const token = localStorage.getItem(this.accessTokenKey);
    if (token) {
      this.fetchCurrentUser().subscribe();
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap(response => {
        this.storeAuthSession(response.access_token, response.refresh_token, response.expires_in);
        this.setCurrentUser(response.user);
      })
    );
  }

  register(userData: RegisterRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, userData);
  }

  logout(): Observable<LogoutResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearSession();
      return of({ message: 'Logged out' });
    }

    return this.http.post<LogoutResponse>(`${this.apiUrl}/auth/logout`, { refresh_token: refreshToken }).pipe(
      catchError((error) => throwError(() => error)),
      finalize(() => this.clearSession())
    );
  }

  refreshToken(): Observable<RefreshTokenResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    return this.http.post<RefreshTokenResponse>(`${this.apiUrl}/auth/refresh`, { refresh_token: refreshToken }).pipe(
      tap(response => {
        this.storeAuthSession(response.access_token, response.refresh_token, response.expires_in);
        this.fetchCurrentUser().subscribe();
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  clearSession(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.expiresInKey);
    localStorage.removeItem(this.currentUserKey);
    this.currentUserSubject.next(null);
  }

  private fetchCurrentUser(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap(user => this.setCurrentUser(user)),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  private storeAuthSession(accessToken: string, refreshToken: string, expiresIn: number): void {
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
    localStorage.setItem(this.expiresInKey, String(expiresIn));
  }

  private setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(this.currentUserKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.currentUserKey);
    }
    this.currentUserSubject.next(user);
  }
}