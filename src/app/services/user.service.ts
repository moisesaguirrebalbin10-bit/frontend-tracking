import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MeResponse } from '../models/auth.model';
import { User, UserRole, UsersListResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(filters?: { page?: number; search?: string }): Observable<UsersListResponse> {
    let params = new HttpParams();

    if (filters?.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters?.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    return this.http.get<UsersListResponse | User[] | Record<string, unknown>>(`${this.apiUrl}/users`, { params }).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return {
            data: response,
            active_users: response.filter((user) => user.is_active).length,
            total_users: response.length
          };
        }

        const nestedUsers = response['users'] as Record<string, unknown> | undefined;
        if (nestedUsers && Array.isArray(nestedUsers['data'])) {
          const data = nestedUsers['data'] as User[];
          const currentPage = typeof nestedUsers['current_page'] === 'number' ? nestedUsers['current_page'] : undefined;
          const lastPage = typeof nestedUsers['last_page'] === 'number' ? nestedUsers['last_page'] : undefined;
          const perPage = typeof nestedUsers['per_page'] === 'number' ? nestedUsers['per_page'] : undefined;
          const total = typeof nestedUsers['total'] === 'number' ? nestedUsers['total'] : undefined;
          const activeUsers = typeof response['active_users'] === 'number' ? response['active_users'] : data.filter((user) => user.is_active).length;
          const totalUsers = typeof response['total_users'] === 'number' ? response['total_users'] : total ?? data.length;

          return {
            data,
            current_page: currentPage,
            last_page: lastPage,
            per_page: perPage,
            total,
            active_users: activeUsers,
            total_users: totalUsers
          };
        }

        return {
          data: Array.isArray(response['data']) ? (response['data'] as User[]) : [],
          current_page: typeof response['current_page'] === 'number' ? response['current_page'] : undefined,
          last_page: typeof response['last_page'] === 'number' ? response['last_page'] : undefined,
          per_page: typeof response['per_page'] === 'number' ? response['per_page'] : undefined,
          total: typeof response['total'] === 'number' ? response['total'] : undefined,
          active_users: typeof response['active_users'] === 'number' ? response['active_users'] : undefined,
          total_users: typeof response['total_users'] === 'number' ? response['total_users'] : undefined
        };
      })
    );
  }

  createUser(name: string, email: string, password: string, role: UserRole): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, { name, email, password, role });
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<MeResponse>(`${this.apiUrl}/me`).pipe(map((response) => response.user));
  }

  heartbeat(): Observable<{ message?: string }> {
    return this.http.post<{ message?: string }>(`${this.apiUrl}/users/heartbeat`, {});
  }
}