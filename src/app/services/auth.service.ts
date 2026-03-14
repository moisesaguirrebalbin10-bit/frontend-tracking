import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, catchError, finalize, throwError } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginRequest, RegisterRequest, AuthResponse, RefreshTokenResponse, LogoutResponse, MeResponse } from '../models/auth.model';
import { User, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private readonly accessTokenKey = 'access_token';
  private readonly refreshTokenKey = 'refresh_token';
  private readonly expiresInKey = 'expires_in';
  private readonly tokenExpiryKey = 'token_expiry';
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
      if (this.isTokenExpired()) {
        if (this.getRefreshToken()) {
          this.refreshToken().subscribe({
            error: () => this.clearSession()
          });
        } else {
          this.clearSession();
        }
      } else {
        this.fetchCurrentUser().subscribe();
      }
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      switchMap((response) => {
        this.storeAuthSession(response.access_token, response.refresh_token, response.expires_in);

        if (response.user) {
          this.setCurrentUser(response.user);
          return of(response);
        }

        return this.fetchCurrentUser().pipe(map(() => response));
      })
    );
  }

  register(userData: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, userData);
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
      switchMap((response) => {
        this.storeAuthSession(response.access_token, response.refresh_token ?? refreshToken, response.expires_in);
        return this.fetchCurrentUser().pipe(map(() => response));
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
    const token = this.getToken();
    if (!token) {
      return false;
    }

    if (!this.isTokenExpired()) {
      return true;
    }

    return !!this.getRefreshToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return !!user && (user.role === UserRole.ADMIN || user.is_admin);
  }

  clearSession(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.expiresInKey);
    localStorage.removeItem(this.tokenExpiryKey);
    localStorage.removeItem(this.currentUserKey);
    this.currentUserSubject.next(null);
  }

  private fetchCurrentUser(): Observable<User | null> {
    return this.http.get<MeResponse>(`${this.apiUrl}/me`).pipe(
      map((response) => response.user),
      tap((user) => this.setCurrentUser(user)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.clearSession();
          return of(null);
        }

        return of(this.currentUserSubject.value);
      })
    );
  }

  private storeAuthSession(accessToken: string, refreshToken?: string | null, expiresIn?: number): void {
    localStorage.setItem(this.accessTokenKey, accessToken);

    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    }

    if (typeof expiresIn === 'number') {
      localStorage.setItem(this.expiresInKey, String(expiresIn));
      localStorage.setItem(this.tokenExpiryKey, String(Date.now() + expiresIn * 1000));
    }
  }

  private isTokenExpired(): boolean {
    const storedExpiry = localStorage.getItem(this.tokenExpiryKey);
    if (!storedExpiry) {
      return false;
    }

    const expiry = Number(storedExpiry);
    if (!Number.isFinite(expiry)) {
      return false;
    }

    return Date.now() >= expiry;
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