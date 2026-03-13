import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MeResponse } from '../models/auth.model';
import { User, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  createUser(email: string, password: string, role: UserRole): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, { email, password, role });
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<MeResponse>(`${this.apiUrl}/me`).pipe(map((response) => response.user));
  }
}